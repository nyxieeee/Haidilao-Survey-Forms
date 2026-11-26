import { logoPng, makeReport } from './data'
import type { ResponseRow } from '../survey'

export type ReportFormat = 'pdf' | 'docx' | 'xlsx' | 'csv'

export async function downloadReport(format: Exclude<ReportFormat, 'csv'>, rows: ResponseRow[], day: string, intent: string, status: string) {
  const report = makeReport(rows, day, intent, status)
  const logo = await logoPng()
  switch (format) {
    case 'pdf': return (await import('./pdf')).pdfReport(report, logo)
    case 'docx': return (await import('./word')).wordReport(report, logo)
    case 'xlsx': return (await import('./spreadsheet')).spreadsheetReport(report, logo)
  }
}
