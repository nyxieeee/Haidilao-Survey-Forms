import ExcelJS from 'exceljs'
import { feedbackLabel, noFeedback, products } from '../survey'
import { brand, red, timestamp, title } from './data'
import type { Report, Table } from './data'

export async function spreadsheetReport(report: Report, logo: string) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Haidilao Food Sampling'
  const logoId = workbook.addImage({ base64: logo, extension: 'png' })

  function makeSheet(name: string, widths: number[]) {
    const sheet = workbook.addWorksheet(name)
    sheet.columns = widths.map(width => ({ width }))
    sheet.getRow(1).height = 37
    sheet.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 115, height: 43 } })
    sheet.mergeCells(2, 1, 2, widths.length)
    sheet.getCell('A2').value = title
    sheet.getCell('A2').font = { bold: true, size: 18, color: { argb: 'FF' + red } }
    sheet.getRow(2).height = 27
    sheet.mergeCells(3, 1, 3, widths.length)
    sheet.getCell('A3').value = report.subtitle + ' | Manila time'
    sheet.getCell('A3').alignment = { wrapText: true }
    sheet.getRow(3).height = 29
    sheet.addRow([])
    return sheet
  }

  function table(sheet: ExcelJS.Worksheet, section: Table) {
    sheet.addRow([section.title]).font = { bold: true, color: { argb: 'FF' + red } }
    const header = sheet.addRow(section.headings)
    header.height = 32
    header.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + red } }
      cell.alignment = { wrapText: true, vertical: 'middle' }
    })
    section.rows.forEach((values, index) => {
      const row = sheet.addRow(values)
      row.alignment = { vertical: 'top', wrapText: true }
      if (index % 2 === 0) row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAF3F3' } }
      })
    })
    return header.number
  }

  const summary = makeSheet('Summary', [55, 24, 19])
  table(summary, report.metrics)
  summary.addRow([])
  table(summary, report.productResults)

  const daily = makeSheet('Daily results', [20, 15, 15, 15, 15])
  table(daily, report.daily)

  const responses = makeSheet('Responses', [13, 25, 56, 26, 26, 24, 24, 28, 26, 15, 16])
  const header = table(responses, {
    title: 'Individual responses',
    headings: ['Response #', 'Submitted (Manila)', feedbackLabel, ...products.map(([name]) => name), 'Favorite', 'Would buy', 'Status'],
    rows: report.rows.map((row, index) => [report.rows.length - index, timestamp.format(new Date(row.created_at)),
      row.comment?.trim() || noFeedback, ...row.ratings, products[row.favorite - 1][1], row.intent,
      row.reviewed ? 'Reviewed' : 'New']),
  })
  report.rows.forEach((row, index) => {
    const lines = (row.comment ?? '').split(/\r?\n/).reduce((total, line) => total + Math.max(1, Math.ceil(line.length / 48)), 0)
    responses.getRow(header + index + 1).height = Math.min(390, Math.max(30, 16 * lines + 6))
  })
  responses.views = [{ state: 'frozen', ySplit: header }]
  if (report.rows.length) responses.autoFilter = { from: { row: header, column: 1 }, to: { row: header + report.rows.length, column: 11 } }
  responses.headerFooter.oddFooter = '&L' + brand + '&RPage &P of &N'

  return new Blob([await workbook.xlsx.writeBuffer()], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}
