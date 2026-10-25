-- The BL backside is readable; the stamps are not.
--
-- company-assets was created with NO select policy so the signature and
-- stamp artwork could never reach a browser. That is right for those: they
-- are the instruments that make a BL binding.
--
-- The backside is different in kind. It is the Standard Conditions governing
-- Multimodal Transport Documents under the Multimodal Transportation of
-- Goods Act 1993, published by DG Shipping and printed on the reverse of
-- every BL the company issues. It is public text that every customer
-- receives. Keeping it unreadable bought no security and left the on-screen
-- preview permanently unable to show the page that print appends.
--
-- So: one narrow select policy for files named bl-backside* only. Everything
-- else in the bucket -- signature, stamp, surrender stamp -- stays
-- unreadable from any browser session, including an admin's.
drop policy if exists "company-assets read backside" on storage.objects;
create policy "company-assets read backside"
  on storage.objects for select
  using (
    bucket_id = 'company-assets'
    and (storage.foldername(name))[1] = public.auth_tenant_id()::text
    and name like '%/bl-backside%'
  );
