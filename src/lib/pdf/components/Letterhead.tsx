import { Image, Text, View, StyleSheet } from '@react-pdf/renderer'
import { FONT_SIZE, palette } from '../theme'

/**
 * The company block that heads the five operational documents.
 *
 * All five blank formats carry the same block with small differences: the
 * CRO, Onboard and Off Loading letters set it to the right of a Date/To
 * column, while the CAN and DO centre it. `align` covers that rather than
 * five near-identical copies drifting apart.
 *
 * The GST address is printed together with "MUMBAI 400072" exactly as the
 * blanks do -- it reads oddly, but it is the registered wording and is not
 * ours to tidy.
 */
export interface LetterheadCompany {
  /**
   * Signed URL for the logo artwork. It prints above the legal name, as on
   * the printed letterhead; without it the block is text only.
   */
  logoSrc?: string
  legalName: string
  corporateAddress: string
  gstAddress: string
  tel: string
  email: string
  website: string
}

export function Letterhead({
  company,
  align = 'left',
  scan = false,
  upper = false,
}: {
  company: LetterheadCompany
  align?: 'left' | 'center'
  scan?: boolean
  upper?: boolean
}) {
  const c = palette(scan)
  const s = StyleSheet.create({
    wrap: { alignItems: align === 'center' ? 'center' : 'flex-start' },
    logo: {
      // 6.36:1 artwork. Width drives height so it never distorts.
      width: 132,
      height: 21,
      objectFit: 'contain',
      marginBottom: 3,
      alignSelf: align === 'center' ? 'center' : 'flex-start',
    },
    name: {
      fontSize: FONT_SIZE.label,
      fontFamily: 'Helvetica-Bold',
      textAlign: align,
      color: c.text,
    },
    line: { fontSize: FONT_SIZE.tiny, textAlign: align, color: c.text },
  })

  const t = (v: string) => (upper ? v.toUpperCase() : v)

  return (
    <View style={s.wrap}>
      {company.logoSrc ? <Image src={company.logoSrc} style={s.logo} /> : null}
      <Text style={s.name}>{t(company.legalName)}</Text>
      <Text style={s.line}>{t('Corporate Address- ' + company.corporateAddress)}</Text>
      <Text style={s.line}>{t('GST ADD - ' + company.gstAddress + ' MUMBAI 400072')}</Text>
      <Text style={s.line}>
        {t(
          'Tel: ' + company.tel + ' Fax: , Email: ' + company.email + ', website: ' + company.website,
        )}
      </Text>
    </View>
  )
}

/**
 * "Label : value" on one line, the layout every one of these documents uses
 * for its header fields. Blank values print the label and an empty colon,
 * matching the blank formats rather than hiding the row.
 */
export function LabeledField({
  label,
  value,
  width = '50%',
  scan = false,
  bold = false,
  labelWidth = '42%',
}: {
  label: string
  value?: string
  width?: string
  scan?: boolean
  bold?: boolean
  labelWidth?: string
}) {
  const c = palette(scan)
  return (
    <View style={{ width, flexDirection: 'row', paddingVertical: 1.5 }}>
      <Text style={{ width: labelWidth, fontSize: FONT_SIZE.small, color: c.text }}>{label}</Text>
      <Text style={{ fontSize: FONT_SIZE.small, color: c.text }}>: </Text>
      <Text
        style={{
          flex: 1,
          fontSize: FONT_SIZE.small,
          color: c.text,
          fontFamily: bold ? 'Helvetica-Bold' : 'Helvetica',
        }}
      >
        {value ?? ''}
      </Text>
    </View>
  )
}

/** Sign-off block shared by four of the five documents. */
export function SignOff({
  legalName,
  scan = false,
  thanking = 'Thanking you',
  upper = false,
}: {
  legalName: string
  scan?: boolean
  thanking?: string
  upper?: boolean
}) {
  const c = palette(scan)
  const t = (v: string) => (upper ? v.toUpperCase() : v)
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={{ fontSize: FONT_SIZE.small, color: c.text }}>{t(thanking)}</Text>
      <Text style={{ fontSize: FONT_SIZE.small, fontFamily: 'Helvetica-Bold', color: c.text }}>
        {t('For ' + legalName)}
      </Text>
      <Text style={{ marginTop: 22, fontSize: FONT_SIZE.small, color: c.text }}>
        {t('Authorised Signatory')}
      </Text>
    </View>
  )
}
