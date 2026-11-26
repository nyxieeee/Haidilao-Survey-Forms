import { countDay, dayLabel } from '../results'
import type { DailySummary } from '../results'
import { products } from '../survey'
import type { ResponseRow } from '../survey'

export const brand = 'HAIDILAO HOT POT'
export const title = 'Food Sampling Survey Results'
export const red = 'A4000E'
export const timestamp = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila',
})

export type Table = { title: string; headings: string[]; rows: (number | string)[][] }

export function makeReport(rows: ResponseRow[], dateLabel: string, intent: string, status: string, selectedDates: string[] = []) {
  const grouped = new Map<string, DailySummary>()
  rows.forEach(row => countDay(grouped, row))
  const days = [...grouped.values()].sort((a, b) => a.day.localeCompare(b.day))
  const period = days.length > 1 ? `${dayLabel(days[0].day)} – ${dayLabel(days[days.length - 1].day)}`
    : days.length ? dayLabel(days[0].day) : ''
  const subtitle = [
    dateLabel || ['All survey dates', period].filter(Boolean).join(' · '),
    intent && `Purchase intent: ${intent}`,
    status && `Review status: ${status === 'new' ? 'New' : 'Reviewed'}`,
  ].filter(Boolean).join(' | ')
  const yes = rows.filter(row => row.intent === 'Yes').length
  const maybe = rows.filter(row => row.intent === 'Maybe').length
  const metrics: Table = {
    title: 'Response summary', headings: ['Metric', 'Value'],
    rows: [['Total responses', rows.length], ['Would buy: Yes', yes], ['Would buy: Maybe', maybe],
      ['Would buy: No', rows.length - yes - maybe],
      ['Would buy: Yes (%)', rows.length ? `${Math.round(yes / rows.length * 100)}%` : '—'],
      ['Awaiting review', rows.filter(row => !row.reviewed).length]],
  }
  const productResults: Table = {
    title: 'Product results', headings: ['Product', 'Average rating / 5', 'Favorite votes'],
    rows: products.map(([name], index) => [
      name,
      rows.length ? Number((rows.reduce((sum, row) => sum + row.ratings[index], 0) / rows.length).toFixed(2)) : '—',
      rows.filter(row => row.favorite === index + 1).length,
    ]),
  }
  const daily: Table = {
    title: 'Daily response counts', headings: ['Manila date', 'Responses', 'Yes', 'Maybe', 'No'],
    rows: selectedDates.length ? selectedDates.map(day => {
      const item = grouped.get(day)
      return [day, item?.total ?? 0, item?.wouldBuy ?? 0, item?.maybe ?? 0, item?.no ?? 0]
    }) : days.map(item => [item.day, item.total, item.wouldBuy, item.maybe, item.no]),
  }
  return { subtitle, rows, metrics, productResults, daily }
}

export type Report = ReturnType<typeof makeReport>

export async function logoPng() {
  const image = new Image()
  image.src = import.meta.env.BASE_URL + 'haidilao-logo.svg'
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = 328
  canvas.height = 124
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not render logo')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}
