-- Every other master defaults tenant_id, so a form can insert without knowing
-- which company it is in. container_types was created without that default,
-- which would make the "Add container type" control fail its not-null check.

alter table public.container_types
  alter column tenant_id set default default_tenant_id();
