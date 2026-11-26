import { dayBounds, dayLabel } from './results'

export type DateMode = 'day' | 'range' | 'dates' | 'all'

export function responseDateFilter(mode: DateMode, day: string, start: string, end: string, dates: string[]) {
  if (mode === 'all') return ''
  if (mode === 'range' && (!start || !end || start > end)) return null
  if (mode === 'dates' && !dates.length) return null

  const bounds = mode === 'dates'
    ? [...new Set(dates)].sort().map(date => dayBounds(date))
    : [mode === 'range' ? [dayBounds(start)[0], dayBounds(end)[1]] : dayBounds(day)]
  const ranges: string[][] = []
  for (const [from, to] of bounds) {
    const last = ranges.at(-1)
    if (last?.[1] === from) last[1] = to
    else ranges.push([from, to])
  }
  return ranges.map(([from, to]) => `and(created_at.gte.${from},created_at.lt.${to})`).join(',')
}

export function responseDateLabel(mode: DateMode, day: string, start: string, end: string, dates: string[]) {
  if (mode === 'all') return 'All survey dates'
  if (mode === 'day') return dayLabel(day)
  if (mode === 'range') return start && end && start <= end ? `${dayLabel(start)} – ${dayLabel(end)}` : 'Choose a valid date range'
  if (dates.length === 1) return dayLabel(dates[0])
  return dates.length ? `${dates.length} selected dates` : 'Choose at least one date'
}
