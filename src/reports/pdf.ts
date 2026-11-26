import { jsPDF } from 'jspdf'
import { products } from '../survey'
import { red, timestamp, title } from './data'
import type { Report, Table } from './data'

export function pdfReport(report: Report, logo: string) {
  const doc = new jsPDF()
  const margin = 17
  const width = 176
  let y = 33

  function frame() {
    doc.addImage(logo, 'PNG', margin, 10, 34, 12.85)
    doc.setDrawColor('#' + red)
    doc.setLineWidth(.6)
    doc.line(margin, 26, margin + width, 26)
  }

  function room(height: number) {
    if (y + height > 277) {
      doc.addPage()
      frame()
      y = 35
    }
  }

  function line(text: string, size = 10, bold = false) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    doc.setTextColor('#222222')
    const height = size * .46
    for (const part of doc.splitTextToSize(text, width) as string[]) {
      room(height)
      doc.text(part, margin, y)
      y += height
    }
  }

  function comment(text: string) {
    // Rasterize non-Latin comments with the browser's font fallback.
    if (!/[^\u0000-\u00ff]/u.test(text)) {
      line(text)
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = 1056
    canvas.height = 30
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not render comment')
    context.font = '20px sans-serif'
    context.textBaseline = 'middle'
    for (const paragraph of text.split(/\r?\n/)) {
      let current = ''
      function render() {
        room(5)
        context!.clearRect(0, 0, canvas.width, canvas.height)
        context!.fillStyle = '#222222'
        context!.fillText(current, 0, 15)
        if (current) doc.addImage(canvas.toDataURL('image/png'), 'PNG', margin, y - 4, width, 5)
        y += 5
      }
      for (const character of paragraph) {
        if (context.measureText(current + character).width > canvas.width && current) {
          render()
          current = ''
        }
        current += character
      }
      render()
    }
  }

  function table(section: Table, columns: number[]) {
    function row(values: (string | number)[], heading = false) {
      doc.setFont('helvetica', heading ? 'bold' : 'normal')
      doc.setFontSize(9)
      const wrapped = values.map((value, index) => doc.splitTextToSize(String(value), columns[index] - 5) as string[])
      const height = Math.max(...wrapped.map(value => value.length)) * 4 + 4
      if (!heading && y + height > 277) {
        room(height)
        row(section.headings, true)
        doc.setFont('helvetica', 'normal')
      } else room(height)
      doc.setFillColor(heading ? '#' + red : '#F8F3F2')
      doc.rect(margin, y - 3, width, height - .4, 'F')
      doc.setTextColor(heading ? '#FFFFFF' : '#222222')
      let x = margin
      wrapped.forEach((value, index) => {
        value.forEach((part, lineIndex) => doc.text(part, x + 2.5, y + 2.4 + lineIndex * 4))
        x += columns[index]
      })
      y += height
    }
    room(19)
    line(section.title, 13, true)
    y += 3
    row(section.headings, true)
    section.rows.forEach(values => row(values))
    y += 8
  }

  frame()
  y = 36
  line(title, 21, true)
  line(report.subtitle)
  line('Dates and times use Manila time.')
  y += 7
  table(report.metrics, [128, 48])
  table(report.productResults, [94, 41, 41])
  table(report.daily, [60, 29, 29, 29, 29])
  room(22)
  line('Individual responses', 14, true)
  for (const row of report.rows) {
    room(23)
    line(`#${row.id} | ${timestamp.format(new Date(row.created_at))} | ${row.reviewed ? 'Reviewed' : 'New'}`, 11, true)
    line(`Favorite: ${products[row.favorite - 1][1]} | Would buy: ${row.intent}`)
    line(`Ratings (in product order above): ${row.ratings.join(' / ')}`)
    if (row.comment) comment(row.comment)
    y += 5
  }
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor('#555555')
    doc.text(`Haidilao Food Sampling  |  ${page} of ${pages}`, margin, 288)
  }
  return doc.output('blob')
}
