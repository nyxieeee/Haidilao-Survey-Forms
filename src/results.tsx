import { intents, products } from './survey'
import type { ResponseRow, Summary } from './survey'

export type DailySummary = Summary & { day: string; maybe: number; no: number }
export type ResultRow = Pick<ResponseRow, 'created_at' | 'ratings' | 'favorite' | 'intent' | 'reviewed'>

const manilaDate = new Intl.DateTimeFormat('en', {
  timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
})
const readableDate = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'UTC' })
export const dayLabel = (day: string) => readableDate.format(new Date(day + 'T00:00:00Z'))

export function manilaDay(date = new Date()) {
  const parts = Object.fromEntries(manilaDate.formatToParts(date).map(part => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function countDay(days: Map<string, DailySummary>, row: ResultRow) {
  const day = manilaDay(new Date(row.created_at))
  let summary = days.get(day)
  if (!summary) {
    summary = { day, total: 0, unreviewed: 0, wouldBuy: 0, maybe: 0, no: 0,
      averages: products.map(() => 0), favorites: products.map(() => 0) }
    days.set(day, summary)
  }
  summary.total++
  summary.unreviewed += Number(!row.reviewed)
  summary.wouldBuy += Number(row.intent === 'Yes')
  summary.maybe += Number(row.intent === 'Maybe')
  summary.no += Number(row.intent === 'No')
  summary.favorites[row.favorite - 1]++
  row.ratings.forEach((rating, index) => { summary.averages[index] = (summary.averages[index] ?? 0) + rating })
}

export function dayBounds(day: string) {
  const start = new Date(day + 'T00:00:00+08:00')
  return [start.toISOString(), new Date(start.getTime() + 86_400_000).toISOString()]
}

export function Metrics({ summary }: { summary: Summary | null }) {
  const top = summary?.total ? products
    .filter((_, index) => summary.favorites[index] === Math.max(...summary.favorites))
    .map(([, name]) => name).join(', ') : '—'
  const metrics = [
    ['Total responses', summary?.total ?? '—'],
    ['Awaiting review', summary?.unreviewed ?? '—'],
    ['Would buy their favorite', summary?.total ? `${Math.round(summary.wouldBuy / summary.total * 100)}%` : '—'],
    ['Top favorite', top],
  ]
  return <div className="metrics">{metrics.map(([label, value]) =>
    <div className="card" key={label}><span>{label}</span><strong className={label === 'Top favorite' ? 'top-favorite' : ''}>{value}</strong></div>
  )}</div>
}

export function Ratings({ summary }: { summary: Summary | null }) {
  return <>{products.map(([name], index) => <div className="bar-row" key={name}>
    <span>{name}</span><progress max={5} value={summary?.averages[index] ?? 0} aria-label={name} />
    <strong>{summary?.averages[index]?.toFixed(2) ?? '—'}</strong>
  </div>)}</>
}

export function DailyResults({ days, day, selectDay, failed }: {
  days: DailySummary[] | null, day: string, selectDay: (day: string) => void, failed: boolean,
}) {
  const selected = days?.find(item => item.day === day)
  return <section className="card daily-results">
    <div className="response-head">
      <div><h2>Daily results</h2><p className="muted">Dates use Manila time.</p></div>
      <div className="buttons">
        <label className="day-picker">Survey date <input type="date" value={day} max={manilaDay()} onChange={event => {
          const value = event.target.value
          if (!value || event.target.validity.valid) selectDay(value || manilaDay())
        }} /></label>
        {day !== manilaDay() && <button onClick={() => selectDay(manilaDay())}>Back to today</button>}
      </div>
    </div>
    {failed ? <p role="alert">Couldn’t load daily results. Use Refresh to try again.</p>
      : !days ? <p role="status">Loading daily results…</p>
      : selected ? <>
        <dl className="daily-counts">{[
          ['Responses', selected.total], ...intents.map((intent, index) => [`Would buy · ${intent}`, [selected.wouldBuy, selected.maybe, selected.no][index]]),
        ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <div className="dash-grid daily-breakdown">
          <div><h3>Average ratings</h3><Ratings summary={selected} /></div>
          <div><h3>Favorite picks</h3><dl className="favorites">{products.map(([, name], index) =>
            <div key={name}><dt>{name}</dt><dd>{selected.favorites[index]}</dd></div>)}</dl></div>
        </div>
      </> : <p>No responses for {dayLabel(day)}.</p>}
    {!!days?.length && <details className="day-history">
      <summary>Response counts by date</summary>
      <ul>{days.map(item => <li key={item.day}>
        <button aria-pressed={day === item.day} onClick={() => selectDay(item.day)}>{dayLabel(item.day)}</button>
        <span>{item.total} {item.total === 1 ? 'response' : 'responses'}</span>
      </li>)}</ul>
    </details>}
  </section>
}
