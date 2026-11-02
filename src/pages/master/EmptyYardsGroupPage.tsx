import { VendorGroupMasterPage } from './VendorGroupMasterPage'

/**
 * Master Data -> Vendors -> Empty Container Yards (spec v2).
 *
 * This is the depot master. v2 says it "replaces the hard-coded list of 13
 * depots" -- those 13 became real rows back in migration 0045, so the 28
 * supplied yards were added alongside them. TEN of the 28 name-match an
 * existing row, and v2 says flag duplicates rather than merge them, so both
 * sides are listed and the Possible duplicates tab puts them together for a
 * person to decide. Six live bookings point at the existing rows, so nothing
 * may be repointed quietly.
 */
export function EmptyYardsGroupPage() {
  return (
    <VendorGroupMasterPage
      config={{
        table: 'empty_depots',
        branchTable: 'empty_depot_branches',
        contactTable: 'empty_depot_contacts',
        parentKey: 'depot_id',
        title: 'Empty Container Yards',
        description:
          'The depot master. Read by the Empty Pickup Depot and Empty Drop-off Depot fields on a booking and printed on the CRO. Shared by both companies as identity data only.',
        backTo: '/master/vendors',
      }}
    />
  )
}
