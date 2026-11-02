-- Merging two depots that are the same yard (spec v2: duplicates are flagged,
-- then a person decides).
--
-- Nothing is deleted. The depot being merged away stays as a record marked
-- Merged, Inactive and pointing at the one that was kept, so the decision can
-- be seen and traced. Its branches, contacts and documents move to the kept
-- depot, and every booking that pointed at it is repointed. An Admin does it,
-- one pair at a time, from the depot's own screen.

alter table public.empty_depots add column if not exists merged_into uuid references public.empty_depots(id);

alter table public.empty_depots drop constraint if exists empty_depots_review_status_check;
alter table public.empty_depots add constraint empty_depots_review_status_check
  check (review_status in ('Ready', 'Needs review', 'Merged'));

create or replace function public.merge_empty_depots(p_keep uuid, p_remove uuid)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $fn$
declare
  v_keep   public.empty_depots%rowtype;
  v_remove public.empty_depots%rowtype;
  v_br int; v_ct int; v_dc int; v_bk int;
  v_me text;
begin
  if not public.is_admin() then
    raise exception 'Only an Admin can merge depots.' using errcode = 'insufficient_privilege';
  end if;
  if p_keep = p_remove then
    raise exception 'Choose two different depots.' using errcode = 'restrict_violation';
  end if;

  select * into v_keep   from public.empty_depots where id = p_keep   and tenant_id = public.auth_tenant_id() for update;
  select * into v_remove from public.empty_depots where id = p_remove and tenant_id = public.auth_tenant_id() for update;
  if v_keep.id is null or v_remove.id is null then
    raise exception 'One of those depots does not exist.' using errcode = 'no_data_found';
  end if;
  if v_keep.review_status = 'Merged' or v_remove.review_status = 'Merged' then
    raise exception 'A depot that has already been merged cannot take part in another merge.'
      using errcode = 'restrict_violation';
  end if;

  select name into v_me from public.profiles where id = auth.uid();

  -- The kept depot already has its own primary branch; the incoming ones are
  -- not primary, so there is still exactly one.
  update public.empty_depot_branches set depot_id = p_keep, is_primary = false where depot_id = p_remove;
  get diagnostics v_br = row_count;
  update public.empty_depot_contacts set depot_id = p_keep where depot_id = p_remove;
  get diagnostics v_ct = row_count;
  update public.empty_depot_documents set depot_id = p_keep where depot_id = p_remove;
  get diagnostics v_dc = row_count;

  update public.bookings set depot_id = p_keep where depot_id = p_remove;
  get diagnostics v_bk = row_count;
  update public.bookings set return_depot_id = p_keep where return_depot_id = p_remove;

  update public.empty_depots
     set status = 'Inactive',
         review_status = 'Merged',
         merged_into = p_keep,
         review_note = 'Merged into ' || v_keep.name || ' by ' || coalesce(v_me, 'an Admin') || ' on '
                       || to_char(now(), 'DD Mon YYYY') || '. Earlier note: ' || coalesce(v_remove.review_note, 'none')
   where id = p_remove;

  return jsonb_build_object('branches', v_br, 'contacts', v_ct, 'documents', v_dc, 'bookings', v_bk);
end
$fn$;
