import { useState } from 'react'
import { Building2, ArrowRight, LogOut } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { ROLE_LABELS } from '../lib/rbac'

/**
 * Which company am I working in?
 *
 * Kinetic and RKS are separate GST-registered businesses that happen to share
 * a login and a master-data set. Raising an invoice or a BL in the wrong one
 * is a tax and legal problem, not a tidiness problem, so the choice is made
 * deliberately at the start rather than inferred.
 *
 * Someone who belongs to one company never sees this — there is nothing to
 * decide — and their company is selected for them.
 */

const BLURB: Record<string, string> = {
  'Kinetic Line': 'NVOCC and carrier of record — bookings, containers, MNR, and our own Bill of Lading.',
  'RKS Global Logistics': 'Freight forwarding — quotations, shipments across sea, air and road, and invoicing.',
}

export function CompanyChooserPage() {
  const { companies, setActiveCompany, signOut, profile } = useAuthStore()
  const [busy, setBusy] = useState<string | null>(null)

  const choose = async (id: string) => {
    setBusy(id)
    await setActiveCompany(id)
    setBusy(null)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-heading">Choose a company</h1>
          <p className="mt-1.5 text-sm text-muted">
            {profile ? `Signed in as ${profile.name}. ` : ''}
            Everything you do — bookings, documents, invoices and numbering — belongs to the
            company you pick. You can switch from the user menu at any time.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {companies.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={busy !== null}
              onClick={() => choose(c.id)}
              className="group flex flex-col rounded-card border border-line bg-surface p-5 text-left shadow-card transition hover:border-primary disabled:opacity-60"
            >
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Building2 size={19} />
              </span>
              <span className="text-[15px] font-semibold text-heading">{c.name}</span>
              <span className="mt-1 flex-1 text-xs text-muted">{BLURB[c.name] ?? ''}</span>
              <span className="mt-4 flex items-center gap-1.5 text-xs font-medium text-primary">
                {busy === c.id ? 'Opening…' : `Enter as ${ROLE_LABELS[c.role] ?? c.role}`}
                {busy !== c.id && (
                  <ArrowRight size={13} className="transition group-hover:translate-x-0.5" />
                )}
              </span>
            </button>
          ))}
        </div>

        {companies.length === 0 && (
          <div className="rounded-card border border-line bg-surface p-6 text-center">
            <p className="text-sm text-heading">You have not been given access to a company yet.</p>
            <p className="mt-1 text-xs text-muted">
              An Admin can grant it from Users and Roles.
            </p>
          </div>
        )}

        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => signOut()}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-heading"
          >
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
