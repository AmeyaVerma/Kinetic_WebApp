-- Siddharth, asked whether every Admin should see both companies: "Yes admin
-- can also choose who can login to which company." So Admins get a membership
-- in RKS as well; everyone else stays where they are until an Admin grants
-- them access from Users and Roles.

insert into public.memberships (user_id, tenant_id, role)
select p.id, t.id, 'admin'
from public.profiles p
cross join public.tenants t
where p.role = 'admin'
  and t.name = 'RKS Global Logistics'
  and not exists (
    select 1 from public.memberships m where m.user_id = p.id and m.tenant_id = t.id
  );
