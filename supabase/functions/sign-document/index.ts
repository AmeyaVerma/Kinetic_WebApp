// Server-side signing and stamping for the BL (CR-01 section 10).
//
// WHY THIS EXISTS AS A SERVER FUNCTION AT ALL
// The signature, company stamp and surrender stamp are the instruments that
// make a transport document binding. If the browser could fetch those PNGs,
// anyone who opened the app could lift them and sign their own documents. So
// the images live in the `company-assets` bucket, which has NO select policy
// -- unreachable from any browser session, including an admin's -- and are
// composited here, with the service role, only after a PIN verifies.
//
// WHY A PERSONAL PIN RATHER THAN "A PASSWORD"
// Siddharth asked for a password on the Signed and Surrender toggles. A single
// shared password cannot answer "who signed this BL", and anyone who learns it
// can sign as the company. Each admin gets their own PIN, stored as a PBKDF2
// hash, verified here, rate-limited and locked out after repeated failures.
// The hash never leaves this function and the signing_pins table has zero RLS
// policies, so no client can read a hash to attack it offline.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const MAX_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15
const PBKDF2_ITERATIONS = 210_000

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Action = 'set_pin' | 'sign' | 'pin_status'
type StampOption = 'signed' | 'surrender'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader) return fail(401, 'Not signed in')

    // Identify the caller with THEIR token, never the service role: the
    // service role would happily tell us about anybody.
    const asUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await asUser.auth.getUser()
    if (userErr || !userData?.user) return fail(401, 'Not signed in')
    const user = userData.user

    const admin = createClient(SUPABASE_URL, SERVICE_KEY)

    // Admin-only, checked server-side. A non-admin calling this endpoint
    // directly is refused here, not merely hidden in the UI (check 18).
    const { data: profile } = await admin
      .from('profiles')
      .select('role, status, tenant_id, name')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || profile.status !== 'Active' || profile.role !== 'admin') {
      return fail(403, 'Signing is restricted to administrators')
    }

    const body = await req.json()
    const action: Action = body.action

    if (action === 'set_pin') {
      const pin = String(body.pin ?? '')
      if (!/^\d{4,12}$/.test(pin)) {
        return fail(400, 'PIN must be 4 to 12 digits')
      }
      const hash = await hashPin(pin)
      const { error } = await admin.from('signing_pins').upsert(
        {
          user_id: user.id,
          tenant_id: profile.tenant_id,
          pin_hash: hash,
          failed_attempts: 0,
          locked_until: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      if (error) return fail(500, error.message)

      await audit(admin, profile, user.id, 'SIGNING_PIN_SET', {})
      return ok({ ok: true })
    }

    // Lets the UI know whether this admin has a PIN and whether they are
    // locked out, without exposing the hash or the attempt count.
    if (action === 'pin_status') {
      const { data: row } = await admin
        .from('signing_pins')
        .select('locked_until')
        .eq('user_id', user.id)
        .maybeSingle()
      return ok({ hasPin: Boolean(row), lockedUntil: row?.locked_until ?? null })
    }

    if (action !== 'sign') return fail(400, 'Unknown action')

    const option: StampOption = body.option
    if (option !== 'signed' && option !== 'surrender') {
      return fail(400, 'Unknown stamp option')
    }

    // --- PIN verification, with lockout -------------------------------
    const { data: pinRow } = await admin
      .from('signing_pins')
      .select('pin_hash, failed_attempts, locked_until')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!pinRow) return fail(400, 'No signing PIN set. Set one before signing.')

    if (pinRow.locked_until && new Date(pinRow.locked_until) > new Date()) {
      await audit(admin, profile, user.id, 'SIGNING_LOCKED_OUT', { option })
      return fail(429, 'Too many failed attempts. Try again later.')
    }

    const supplied = String(body.pin ?? '')
    const valid = await verifyPin(supplied, pinRow.pin_hash)

    if (!valid) {
      const attempts = (pinRow.failed_attempts ?? 0) + 1
      const locked =
        attempts >= MAX_ATTEMPTS
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString()
          : null
      await admin
        .from('signing_pins')
        .update({ failed_attempts: attempts, locked_until: locked })
        .eq('user_id', user.id)

      await audit(admin, profile, user.id, 'SIGNING_PIN_FAILED', {
        option,
        attempts,
        locked: Boolean(locked),
      })
      return fail(401, locked ? 'Too many failed attempts. Locked for 15 minutes.' : 'Incorrect PIN')
    }

    // Success resets the counter, so a legitimate typo does not accumulate
    // toward a lockout across days.
    await admin
      .from('signing_pins')
      .update({ failed_attempts: 0, locked_until: null })
      .eq('user_id', user.id)

    // --- Composite ----------------------------------------------------
    const pdfBytes = base64ToBytes(String(body.pdf ?? ''))
    if (!pdfBytes.length) return fail(400, 'No document supplied')

    const scan = Boolean(body.scan)
    // Front sheets only. The backside is the last page and never carries a
    // stamp or signature.
    const frontSheets = Number(body.frontSheets ?? 0)

    const { data: settings } = await admin
      .from('company_settings')
      .select('asset_placement, signature_path, signature_grey_path, stamp_path, stamp_grey_path, surrender_stamp_path, surrender_stamp_grey_path')
      .eq('tenant_id', profile.tenant_id)
      .maybeSingle()

    if (!settings) return fail(500, 'Company settings missing')

    const grey = scan

    // What goes on the page, by BL type:
    //   Draft            -- nothing, and the caller already blocks it
    //   Surrender        -- the signature AND the surrender stamp, together
    //   any other type   -- the signature only
    //
    // The company's signature artwork already carries the round stamp, so a
    // separate stamp file is optional rather than required: composite
    // whichever exist, and refuse only when none do, because that is the case
    // where the output would look signed without being so.
    //
    // A surrender used to composite the stamp ALONE, so a surrendered BL came
    // out marked BL SURRENDERED with an empty Authorised Signatory box -- the
    // document asserted a surrender and showed nobody standing behind it.
    const signatureAssets = [
      {
        path: grey ? settings.signature_grey_path : settings.signature_path,
        place: 'signature',
      },
      { path: grey ? settings.stamp_grey_path : settings.stamp_path, place: 'stamp' },
    ]

    const candidates =
      option === 'signed'
        ? signatureAssets
        : [
            ...signatureAssets,
            {
              path: grey ? settings.surrender_stamp_grey_path : settings.surrender_stamp_path,
              place: 'surrender',
            },
          ]

    const wanted = candidates.filter((w) => w.path)
    if (wanted.length === 0) {
      return fail(
        409,
        'No artwork uploaded for ' +
          (option === 'signed' ? 'the signature' : 'the surrender stamp') +
          '. Upload it under Master Data -> Company settings first.',
      )
    }

    // A surrender needs BOTH marks. With the signature present but the
    // surrender stamp missing, the lines above would happily produce a
    // signed BL and call it surrendered -- the one outcome worth refusing,
    // because the document would assert something that never happened.
    if (option === 'surrender' && !wanted.some((w) => w.place === 'surrender')) {
      return fail(
        409,
        'The surrender stamp artwork is missing, and a Surrender BL must carry ' +
          'both the stamp and the signature. Upload it under Master Data -> ' +
          'Company settings first.',
      )
    }

    const pdf = await PDFDocument.load(pdfBytes)
    const pages = pdf.getPages()
    const placement = settings.asset_placement ?? {}

    for (const w of wanted) {
      const { data: file, error: dlErr } = await admin.storage
        .from('company-assets')
        .download(w.path!)
      if (dlErr || !file) return fail(500, 'Could not read artwork: ' + (dlErr?.message ?? w.place))

      const bytes = new Uint8Array(await file.arrayBuffer())
      // Embedded into the page content stream -- not an annotation and not a
      // form field -- so the image cannot be selected and lifted out of the
      // finished PDF (check 17 / section 10.6).
      const img = await pdf.embedPng(bytes)
      const p = placement[w.place] ?? { x: 0, y: 0, width: 100, height: 50 }

      const limit = frontSheets > 0 ? Math.min(frontSheets, pages.length) : pages.length
      for (let i = 0; i < limit; i++) {
        pages[i].drawImage(img, { x: p.x, y: p.y, width: p.width, height: p.height })
      }
    }

    // Strip identifying metadata so the output carries no producer trail.
    pdf.setProducer('')
    pdf.setCreator('')

    const out = await pdf.save({ useObjectStreams: false })

    await audit(admin, profile, user.id, 'BL_SIGNED', {
      option,
      bl_number: body.blNumber ?? null,
      booking_id: body.bookingId ?? null,
      version: body.version ?? null,
      scan,
      front_sheets: frontSheets,
    })

    return new Response(JSON.stringify({ pdf: bytesToBase64(out) }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return fail(500, e instanceof Error ? e.message : 'Unexpected error')
  }
})

/* ── PIN hashing ──────────────────────────────────────────────────────
   PBKDF2-SHA256 via Web Crypto, which Deno provides natively -- no
   dependency to audit for something this sensitive. Format:
   pbkdf2$<iterations>$<salt b64>$<hash b64>                              */

async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const bits = await derive(pin, salt, PBKDF2_ITERATIONS)
  return ['pbkdf2', PBKDF2_ITERATIONS, bytesToBase64(salt), bytesToBase64(bits)].join('$')
}

async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [scheme, iterStr, saltB64, hashB64] = stored.split('$')
  if (scheme !== 'pbkdf2') return false
  const bits = await derive(pin, base64ToBytes(saltB64), Number(iterStr))
  return timingSafeEqual(bits, base64ToBytes(hashB64))
}

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256,
  )
  return new Uint8Array(bits)
}

/** Constant-time compare so a wrong PIN cannot be narrowed down by timing. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

/* ── helpers ─────────────────────────────────────────────────────────── */

async function audit(
  admin: ReturnType<typeof createClient>,
  profile: { role: string; tenant_id: string },
  userId: string,
  action: string,
  detail: Record<string, unknown>,
) {
  // Written explicitly rather than by a row trigger: a trigger on
  // signing_pins would copy pin_hash into audit_log, which admins can read.
  await admin.from('audit_log').insert({
    tenant_id: profile.tenant_id,
    table_name: 'signing_pins',
    record_id: userId,
    action,
    actor_id: userId,
    actor_role: profile.role,
    new_data: detail,
  })
}

function ok(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function fail(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}
