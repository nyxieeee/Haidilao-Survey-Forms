import {
  Document, Header, ImageRun, Packer, Paragraph, Table as WordTable, TableCell, TableRow,
  TextRun, WidthType,
} from 'docx'
import { feedbackLabel, noFeedback, products } from '../survey'
import { red, timestamp, title } from './data'
import type { Report, Table } from './data'

export function wordReport(report: Report, logo: string) {
  function paragraph(text: string, size = 21, bold = false, color = '222222') {
    return new Paragraph({
      spacing: { after: 120 },
      keepNext: bold,
      children: text.split(/\r?\n/).map((line, index) =>
        new TextRun({ text: line, break: index ? 1 : 0, size, bold, color })),
    })
  }

  function table(section: Table) {
    return new WordTable({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [section.headings, ...section.rows].map((values, index) => new TableRow({
        tableHeader: index === 0,
        cantSplit: true,
        children: values.map(value => new TableCell({
          shading: { fill: index === 0 ? red : index % 2 ? 'FAF3F3' : 'FFFFFF' },
          margins: { top: 90, bottom: 50, left: 130, right: 130 },
          children: [paragraph(String(value), 21, false, index === 0 ? 'FFFFFF' : '222222')],
        })),
      })),
    })
  }

  const doc = new Document({
    title,
    description: report.subtitle,
    sections: [{
      headers: { default: new Header({
        children: [new Paragraph({
          children: [new ImageRun({ type: 'png', data: logo, transformation: { width: 123, height: 47 } })],
        })],
      }) },
      children: [
        paragraph(title, 42, true, red),
        paragraph(report.subtitle),
        paragraph('Dates and times use Manila time.'),
        ...[report.metrics, report.productResults, report.daily].flatMap(section => [
          paragraph(section.title, 27, true, red), table(section), paragraph(''),
        ]),
        paragraph('Individual responses', 27, true, red),
        ...report.rows.flatMap((row, index) => [
          paragraph(`#${report.rows.length - index} | ${timestamp.format(new Date(row.created_at))} | ${row.reviewed ? 'Reviewed' : 'New'}`, 22, true),
          paragraph(`Favorite: ${products[row.favorite - 1][1]} | Would buy: ${row.intent}`),
          paragraph(`Ratings (in product order above): ${row.ratings.join(' / ')}`),
          paragraph(feedbackLabel, 21, true),
          paragraph(row.comment?.trim() || noFeedback),
          paragraph(''),
        ]),
      ],
    }],
  })
  return Packer.toBlob(doc)
}
