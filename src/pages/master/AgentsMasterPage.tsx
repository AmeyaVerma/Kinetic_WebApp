import { VendorGroupMasterPage } from './VendorGroupMasterPage'

/**
 * Master Data -> Agents (spec v2).
 *
 * v2 puts every agent here "and only here": Parties keeps its customers,
 * shippers and consignees, and no agent is kept in Parties. This master feeds
 * the POD Agent picker, the BL's Overseas Agent box, the Arrival Notice, the
 * Delivery Order, pre-alerts, the Agent portal login and Accounts.
 *
 * Sanctions screening is shown because four of the seven agents supplied are
 * Iranian or Iran-connected, and v2 asks for the check to be recorded before
 * a booking is approved against them.
 */
export function AgentsMasterPage() {
  return (
    <VendorGroupMasterPage
      config={{
        table: 'agents',
        branchTable: 'agent_branches',
        contactTable: 'agent_contacts',
        parentKey: 'agent_id',
        compliance: true,
        title: 'Agents',
        description:
          'Overseas and origin agents. Shared by both companies as identity data only — payment terms, credit and bookings stay inside each company. Every agent picker reads this master and nothing else.',
      }}
    />
  )
}
