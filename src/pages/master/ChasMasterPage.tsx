import { ContactMasterPage } from './ContactMasterPage'

/** Master Data → CHAs (Customs House Agents). Printed on the Delivery Order
    ("PLEASE DELIVER FOLLOWING CARGO TO CHA M/S …") and the Off Loading
    Letter. A DO cannot be issued without one — it is blank in the sample. */
export function ChasMasterPage() {
  return (
    <ContactMasterPage
      table="chas"
      title="CHAs"
      description="Customs House Agents printed on the Delivery Order and Off Loading Letter."
      fields={[
        { key: 'name', label: 'Name', placeholder: 'CHA firm name' },
        { key: 'contact_name', label: 'Contact person', inSummary: true },
        { key: 'phone', label: 'Phone', inSummary: true },
        { key: 'address_line1', label: 'Address line 1' },
        { key: 'address_line2', label: 'Address line 2' },
        { key: 'city', label: 'City', inSummary: true },
        { key: 'pin_code', label: 'PIN code' },
        { key: 'email', label: 'Email' },
      ]}
    />
  )
}
