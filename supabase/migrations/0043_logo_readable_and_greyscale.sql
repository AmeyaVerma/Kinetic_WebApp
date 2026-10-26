-- The logo joins the backside as readable, and gains a greyscale variant.
--
-- Readability: same reasoning as 0041. The logo is public branding -- it is
-- on the website, the letterhead and every document the company sends out.
-- There is nothing to protect, and the BL has to draw it in the browser
-- preview as well as in print. The signature, company stamp and surrender
-- stamp stay unreadable from any browser session; those are the instruments
-- that make a BL binding, and they are composited server-side after a PIN.
--
-- Greyscale: Scan Copy prints the entire BL black and white. Without a mono
-- masthead a Scan Copy would come out monochrome except for a full-colour
-- logo, which is the one thing that would give it away as not a photocopy.

drop policy if exists "company-assets read backside" on storage.objects;
drop policy if exists "company-assets read public art" on storage.objects;
create policy "company-assets read public art"
  on storage.objects for select
  using (
    bucket_id = 'company-assets'
    and (storage.foldername(name))[1] = public.auth_tenant_id()::text
    and (name like '%/bl-backside%' or name like '%/logo%')
  );

alter table public.company_settings
  add column if not exists logo_grey_path text;
