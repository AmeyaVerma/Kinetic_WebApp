import { Download } from 'lucide-react'
import { Button } from './Button'
import { downloadCsv } from '../../lib/csv'

interface Props {
  filename: string
  rows: Record<string, unknown>[]
  label?: string
}

/** Small secondary button that exports the given rows as a CSV file — sits beside a table/dashboard. */
export function CsvButton({ filename, rows, label = 'Download CSV' }: Props) {
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={rows.length === 0}
      className="disabled:opacity-50"
      onClick={() => downloadCsv(filename, rows)}
    >
      <Download size={13} /> {label}
    </Button>
  )
}
