import { ContactMasterPage } from './ContactMasterPage'

/** Master Data → Surveyors. Printed on the CRO above "Yours Faithfully".
    The blank format runs name, address and phone together on one line; we
    keep them apart so the template can print them on separate lines. */
export function SurveyorsMasterPage() {
  return (
    <ContactMasterPage
      table="surveyors"
      title="Surveyors"
      description="Container surveyors printed on the Container Release Order. bookings.surveyor_id resolves to these records."
      fields={[
        { key: 'name', label: 'Name', placeholder: 'Surveyor name' },
        { key: 'phone', label: 'Phone', placeholder: '+91 …', inSummary: true },
        { key: 'address_line1', label: 'Address line 1' },
        { key: 'address_line2', label: 'Address line 2' },
        { key: 'city', label: 'City', placeholder: 'Mumbai', inSummary: true },
        { key: 'pin_code', label: 'PIN code' },
        { key: 'email', label: 'Email' },
      ]}
    />
  )
}
