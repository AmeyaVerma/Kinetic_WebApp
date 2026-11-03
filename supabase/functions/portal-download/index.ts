// Hands out a short-lived download link for a released document.
//
// WHY A FUNCTION AT ALL
// The generated-documents bucket has no policy that lets a customer or agent
// read it, deliberately: a document is only theirs once it has been approved,
// invoiced, paid and released, and a storage policy cannot express that chain.
// The chain lives in the database as document_release_blocked_reason(), and
// this function is the one place that asks it and, only on a clean answer,
// uses the service role to sign a link.
//
// The caller is identified by THEIR token, and the request is read with that
// token, so row-level security decides whether they may even see it. The
// service role is used for one thing only: signing the link.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const LINK_SECONDS = 60

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader) return fail(401, 'Not signed in')

    const asUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await asUser.auth.getUser()
    if (userErr || !userData?.user) return fail(401, 'Not signed in')

    const body = await req.json().catch(() => ({}))

    // A draft BL a customer asked for is released once Kinetic has approved the
    // inputs and attached the draft. It has no invoice, so the chain is shorter:
    // the submission must be Approved and carry a file.
    if (body.draft_input_id !== undefined) {
      const draftId = String(body.draft_input_id ?? '')
      if (!/^[0-9a-f-]{36}$/i.test(draftId)) return fail(400, 'A draft id is needed')
      const { data: d } = await asUser
        .from('bl_draft_inputs')
        .select('id, tenant_id, status, file_path, file_name')
        .eq('id', draftId)
        .maybeSingle()
      if (!d) return fail(404, 'That draft was not found')
      if (d.status !== 'Approved') return fail(403, 'This draft has not been approved yet.')
      if (!d.file_path) return fail(403, 'The draft BL has not been prepared yet.')
      return await sign(userData.user.id, d.tenant_id, 'bl_draft_inputs', draftId, d.file_path, d.file_name)
    }

    const requestId = String(body.request_id ?? '')
    if (!/^[0-9a-f-]{36}$/i.test(requestId)) return fail(400, 'A request id is needed')

    // Read with the caller's own token: RLS lets a portal user see only
    // their own requests, and staff only their company's.
    const { data: reqRow } = await asUser
      .from('document_requests')
      .select('id, tenant_id, released_file_path, released_file_name')
      .eq('id', requestId)
      .maybeSingle()
    if (!reqRow) return fail(404, 'That request was not found')

    const { data: why, error: whyErr } = await asUser.rpc('document_release_blocked_reason', {
      p_request: requestId,
    })
    if (whyErr) return fail(500, whyErr.message)
    if (why) return fail(403, String(why))
    if (!reqRow.released_file_path) return fail(403, 'The document has not been generated yet.')

    return await sign(
      userData.user.id,
      reqRow.tenant_id,
      'document_requests',
      requestId,
      reqRow.released_file_path,
      reqRow.released_file_name,
    )
  } catch (e) {
    return fail(500, e instanceof Error ? e.message : 'Unexpected error')
  }
})

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

/** Signs a short-lived link and records the download. The service role is used
    for this and nothing else. */
async function sign(
  userId: string,
  tenantId: string,
  table: string,
  recordId: string,
  path: string,
  fileName: string | null,
) {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY)
  const { data: signed, error: signErr } = await admin.storage
    .from('generated-documents')
    .createSignedUrl(path, LINK_SECONDS, { download: fileName ?? true })
  if (signErr || !signed?.signedUrl) return fail(500, 'Could not prepare the download')

  const { error: auditErr } = await admin.from('audit_log').insert({
    tenant_id: tenantId,
    table_name: table,
    record_id: recordId,
    action: 'DOCUMENT_DOWNLOADED',
    actor_id: userId,
    actor_role: null,
    new_data: { file: fileName ?? path },
  })
  if (auditErr) {
    // Refuse rather than hand out a document nobody can later trace.
    console.error('audit write failed', auditErr.message)
    return fail(500, 'Could not record the download, so it was not released')
  }
  return ok({ url: signed.signedUrl, expires_in: LINK_SECONDS })
}
