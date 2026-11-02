import { VendorGroupMasterPage } from './VendorGroupMasterPage'

/** Master Data -> Vendors -> CFS (spec v2). Container freight stations, with
    the port or ICD location code the old list carried (for example
    INNSA1MSW1) kept on the branch. */
export function CfsMasterPage() {
  return (
    <VendorGroupMasterPage
      config={{
        table: 'cfs',
        branchTable: 'cfs_branches',
        contactTable: 'cfs_contacts',
        parentKey: 'cfs_id',
        title: 'CFS',
        description:
          'Container freight stations. Shared by both companies as identity data only. Gate timings and the port or ICD location code live on each branch.',
        backTo: '/master/vendors',
      }}
    />
  )
}
