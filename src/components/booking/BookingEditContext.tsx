import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useDataStore } from '../../store/useDataStore'
import { useAuthStore, useCurrentUser } from '../../store/useAuthStore'
import type { Booking } from '../../lib/types'

/**
 * Edit / Save for a saved booking.
 *
 * Fields used to commit the moment they lost focus, one at a time. That made
 * a half-finished correction live immediately -- change the consignee, get
 * distracted, and the booking already says something nobody approved -- and
 * it wrote a separate audit entry per keystroke-group rather than one entry
 * for the change someone actually made.
 *
 * Now a booking is read-only until an Admin presses Edit. Changes collect in
 * a draft, nothing reaches the database until Save, and Cancel discards the
 * lot. Save writes every changed column in a single update and logs one
 * activity line naming the fields that moved.
 *
 * Non-admins are unchanged: they never enter edit mode, and their edits
 * still go through the approval request path.
 */

type Draft = Partial<Record<keyof Booking, unknown>>

interface BookingEditValue {
  /** True while the Admin has the booking open for editing. */
  editing: boolean
  /** Fields may be typed into right now. */
  canType: boolean
  isAdmin: boolean
  /** False for a booking that only exists in the seeded list -- there is no
      database row to save into, so offering Edit would promise a save that
      cannot happen. */
  editable: boolean
  dirtyCount: number
  saving: boolean
  error: string | null
  begin: () => void
  cancel: () => void
  save: () => Promise<void>
  /** Current value for a field: the draft if touched, else the booking. */
  valueOf: <K extends keyof Booking>(field: K) => Booking[K]
  setField: <K extends keyof Booking>(field: K, value: Booking[K]) => void
}

const Ctx = createContext<BookingEditValue | null>(null)

export function BookingEditProvider({
  booking,
  children,
}: {
  booking: Booking
  children: ReactNode
}) {
  const saveBookingEdits = useDataStore((s) => s.saveBookingEdits)
  const user = useCurrentUser()
  const viewAsRole = useAuthStore((s) => s.viewAsRole)
  const isAdmin = (viewAsRole ?? user?.role) === 'admin'

  const editable = !!booking.dbId
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Draft>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const begin = useCallback(() => {
    setDraft({})
    setError(null)
    setEditing(true)
  }, [])

  const cancel = useCallback(() => {
    setDraft({})
    setError(null)
    setEditing(false)
  }, [])

  const setField = useCallback(
    <K extends keyof Booking>(field: K, value: Booking[K]) => {
      setDraft((d) => {
        // Typing a value back to what it already was un-dirties the field,
        // so Save never writes a column that did not actually change.
        if ((booking[field] ?? '') === ((value as unknown) ?? '')) {
          const { [field]: _dropped, ...rest } = d
          return rest as Draft
        }
        return { ...d, [field]: value }
      })
    },
    [booking],
  )

  const valueOf = useCallback(
    <K extends keyof Booking>(field: K): Booking[K] =>
      (field in draft ? (draft[field] as Booking[K]) : booking[field]),
    [draft, booking],
  )

  const save = useCallback(async () => {
    const fields = Object.keys(draft) as (keyof Booking)[]
    if (fields.length === 0) {
      setEditing(false)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await saveBookingEdits(booking.id, draft, user?.name ?? 'Admin')
      setDraft({})
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
    }
    setSaving(false)
  }, [draft, booking.id, saveBookingEdits, user])

  const dirtyCount = Object.keys(draft).length

  /* Unsaved changes must not disappear silently. Reloading, closing the tab
     or following a link away from the booking all discard the draft, so the
     browser asks first while anything is uncommitted. */
  useEffect(() => {
    if (dirtyCount === 0) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirtyCount])

  const value = useMemo<BookingEditValue>(
    () => ({
      editing,
      canType: editing && isAdmin,
      isAdmin,
      editable,
      dirtyCount,
      saving,
      error,
      begin,
      cancel,
      save,
      valueOf,
      setField,
    }),
    [editing, isAdmin, editable, dirtyCount, saving, error, begin, cancel, save, valueOf, setField],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/**
 * Inside the provider this drives edit mode. Outside it (Freight Forwarding,
 * which shares some of these components) it degrades to "not editing", so
 * those screens keep their existing behaviour.
 */
export function useBookingEdit(): BookingEditValue {
  const ctx = useContext(Ctx)
  if (ctx) return ctx
  return {
    editing: false,
    canType: false,
    isAdmin: false,
    editable: false,
    dirtyCount: 0,
    saving: false,
    error: null,
    begin: () => {},
    cancel: () => {},
    save: async () => {},
    valueOf: (() => undefined) as unknown as BookingEditValue['valueOf'],
    setField: () => {},
  }
}

/**
 * One binding for every editable booking field.
 *
 * `value` reads the draft while editing and the saved booking otherwise.
 * `commit` decides where a change goes:
 *   - Admin mid-edit  -> the draft, written only when Save is pressed
 *   - anyone else     -> the existing approval-request path, unchanged
 * `canType` is what the inputs use for `disabled`, so a booking is plainly
 * read-only until someone chooses to edit it.
 */
export function useFieldBinding<B extends { id: string }>(
  booking: B,
  fallbackCommit: (field: string, label: string, value: string) => void,
) {
  const { editing, canType, isAdmin, valueOf, setField } = useBookingEdit()

  return {
    canType: isAdmin ? canType : true,
    editing,
    value: (field: string): string => {
      const v = editing
        ? (valueOf as unknown as (f: string) => unknown)(field)
        : (booking as unknown as Record<string, unknown>)[field]
      return v === null || v === undefined ? '' : String(v)
    },
    commit: (field: string, label: string, value: string) => {
      if (editing && isAdmin) {
        ;(setField as unknown as (f: string, v: unknown) => void)(field, value)
        return
      }
      fallbackCommit(field, label, value)
    },
  }
}
