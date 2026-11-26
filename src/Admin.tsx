import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { createClient } from '@supabase/supabase-js'
import { intents, products, supabaseKey, supabaseUrl, surveyStatus } from './survey'
import type { ResponseRow, Summary } from './survey'
import { countDay, DailyResults, dayBounds, dayLabel, Metrics, Ratings } from './results'
import type { DailySummary, ResultRow } from './results'

const PAGE_SIZE = 25
const db = createClient(supabaseUrl, supabaseKey)
const dateFormat = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila',
})

function getResponses(intent: string, status: string, day: string) {
  let query = db.from('tasting_responses').select(
    'id, created_at, ratings, favorite, intent, comment, reviewed', { count: 'exact' },
  )
  if (intent) query = query.eq('intent', intent)
  if (status) query = query.eq('reviewed', status === 'reviewed')
  if (day) {
    const [start, end] = dayBounds(day)
    query = query.gte('created_at', start).lt('created_at', end)
  }
  return query.order('id', { ascending: false })
}

function csvCell(value: string | number) {
  const text = String(value)
  const safe = /^[\s\uFEFF]*[=+\-@＝＋－＠]|^[\t\r\n]/u.test(text) ? "'" + text : text
  return '"' + safe.replaceAll('"', '""') + '"'
}

export function Admin() {
  const [session, setSession] = useState<Session | null>()
  const [staff, setStaff] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [signingIn, setSigningIn] = useState(false)
  const userId = session?.user.id

  useEffect(() => {
    const { data } = db.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    let current = true
    setStaff(null)
    if (userId) {
      setChecking(true)
      db.rpc('is_tasting_admin').then(({ data, error }) => {
        if (!current) return
        setStaff(!error && data === true)
        setChecking(false)
        if (error) setError('Couldn’t verify staff access. Sign out and try again.')
      })
    }
    return () => { current = false }
  }, [userId])

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    setSigningIn(true)
    setError('')
    try {
      const { error } = await db.auth.signInWithPassword({
        email: String(fields.get('email')).trim(), password: String(fields.get('password')),
      })
      if (error) throw error
    } catch {
      setError('Sign-in failed. Check your credentials and try again.')
    } finally {
      setSigningIn(false)
    }
  }

  async function signOut() {
    setError('')
    const { error } = await db.auth.signOut({ scope: 'local' })
    if (error) setError('Couldn’t sign out. Please try again.')
  }

  if (session === undefined) return <main className="page-width"><p role="status">Loading staff access…</p></main>
  if (session && staff === true) return <Dashboard signOut={signOut} authError={error} />

  return <main className="page-width"><section className="card notice login">
    <p className="eyebrow">STAFF ACCESS</p>
    <h1>{session ? 'Staff access' : 'Staff sign-in'}</h1>
    {error && <p className="alert" role="alert">{error}</p>}
    {session ? <>
      <p>{checking || staff === null ? 'Verifying staff access…' : 'This account does not have staff access.'}</p>
      <button onClick={signOut}>Sign out</button>
    </> : <form onSubmit={signIn}>
      <p className="muted">Sign in to view responses and manage the tasting survey.</p>
      <label htmlFor="email">Work email</label>
      <input id="email" name="email" type="email" autoComplete="username" required />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required />
      <button className="primary" disabled={signingIn}>{signingIn ? 'Signing in…' : 'Sign in'}</button>
    </form>}
  </section></main>
}

function Dashboard({ signOut, authError }: { signOut: () => Promise<void>, authError: string }) {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [days, setDays] = useState<DailySummary[] | null>(null)
  const [dailyError, setDailyError] = useState(false)
  const [day, setDay] = useState('')
  const [rows, setRows] = useState<ResponseRow[]>([])
  const [accepting, setAccepting] = useState<boolean | null>(null)
  const [intent, setIntent] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const [count, setCount] = useState(0)
  const [version, setVersion] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const refresh = () => setVersion(value => value + 1)

  useEffect(() => {
    const request = new AbortController()
    setDailyError(false)

    async function loadDailyResults() {
      const grouped = new Map<string, DailySummary>()
      let before: number | undefined
      while (!request.signal.aborted) {
        let query = db.from('tasting_responses').select('id, created_at, ratings, favorite, intent, reviewed')
          .order('id', { ascending: false }).limit(500)
        if (before !== undefined) query = query.lt('id', before)
        const { data, error } = await query.abortSignal(request.signal)
        if (error) throw error
        const batch = data as (ResultRow & { id: number })[]
        if (!batch.length) break
        batch.forEach(row => countDay(grouped, row))
        before = batch[batch.length - 1].id
      }
      if (request.signal.aborted) return
      const result = [...grouped.values()].sort((a, b) => b.day.localeCompare(a.day))
      result.forEach(item => { item.averages = item.averages.map(sum => (sum ?? 0) / item.total) })
      setDays(result)
      if (version === 0) setDay(value => value || result[0]?.day || '')
    }

    void loadDailyResults().catch(() => { if (!request.signal.aborted) setDailyError(true) })
    return () => request.abort()
  }, [version])

  useEffect(() => {
    let current = true
    setLoading(true)
    setLoadError(false)

    async function load() {
      try {
        const start = page * PAGE_SIZE
        const [stats, list, open] = await Promise.all([
          db.rpc('tasting_summary'),
          getResponses(intent, status, day).range(start, start + PAGE_SIZE - 1),
          surveyStatus(),
        ])
        if (!current) return
        if (page > 0 && list.status === 416) {
          setPage(0)
          return
        }
        if (stats.error || list.error) throw new Error('Dashboard query failed')
        const total = list.count ?? 0
        if (page > 0 && start >= total) {
          setPage(Math.max(0, Math.ceil(total / PAGE_SIZE) - 1))
          return
        }
        setRows(list.data as ResponseRow[])
        setCount(total)
        setSummary(stats.data as Summary)
        setAccepting(open)
        setLoading(false)
      } catch {
        if (current) { setLoadError(true); setLoading(false) }
      }
    }
    void load()
    return () => { current = false }
  }, [page, intent, status, day, version])

  async function action(run: () => Promise<void>, message: string, reload = true) {
    setBusy(true)
    setError('')
    try {
      await run()
      if (reload) refresh()
    } catch {
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  function updateStatus(next: boolean) {
    return action(async () => {
      const { error } = await db.from('tasting_settings').update({ accepting: next }).eq('id', 1).select('id').single()
      if (error) throw error
    }, 'Couldn’t update the survey status.')
  }

  function review(row: ResponseRow) {
    return action(async () => {
      const { error } = await db.from('tasting_responses').update({ reviewed: !row.reviewed }).eq('id', row.id).select('id').single()
      if (error) throw error
    }, 'Couldn’t update this response.')
  }

  function download() {
    return action(async () => {
      const fields = ['ID', 'Submitted (UTC)', ...products.map(([name]) => name), 'Favorite', 'Would buy', 'Comment', 'Status']
      const lines = [fields.map(csvCell).join(',')]
      let before: number | undefined
      while (true) {
        let query = getResponses(intent, status, day).limit(250)
        if (before !== undefined) query = query.lt('id', before)
        const { data, error } = await query
        if (error) throw error
        const batch = data as ResponseRow[]
        if (!batch.length) break
        for (const row of batch) {
          lines.push([row.id, row.created_at, ...row.ratings, products[row.favorite - 1][1], row.intent, row.comment,
            row.reviewed ? 'Reviewed' : 'New'].map(csvCell).join(','))
        }
        before = batch[batch.length - 1].id
      }
      const file = new Blob(['\uFEFF', lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
      const href = URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = href
      link.download = day ? `haidilao-tasting-responses-${day}.csv` : 'haidilao-tasting-responses.csv'
      link.click()
      setTimeout(() => URL.revokeObjectURL(href), 1000)
    }, 'Couldn’t export responses. Please try again.', false)
  }

  const total = summary?.total ?? 0
  return <main className="page-width dashboard">
    <div className="dash-head">
      <div><p className="eyebrow">STAFF DASHBOARD</p><h1>Tasting feedback</h1></div>
      <button onClick={signOut}>Sign out</button>
    </div>
    {(authError || error) && <p className="alert" role="alert">{authError || error}</p>}
    {loadError && <p className="alert" role="alert">Couldn’t load the dashboard. <button onClick={refresh}>Retry</button></p>}
    <section className="survey-overview" aria-labelledby="overview-title">
      <h2 id="overview-title">Full survey summary</h2>
      <p className="muted">{days?.length ? `All responses · ${dayLabel(days[days.length - 1].day)} – ${dayLabel(days[0].day)}` : 'All responses across the survey'}</p>
      <Metrics summary={summary} />
    </section>
    <div className="dash-grid">
      <section className="card"><h2>Average ratings</h2><p className="muted">All responses · out of 5</p>
        <Ratings summary={summary} />
      </section>
      <section className="card"><h2>Survey controls</h2>
        <p><span className={`status ${accepting ? 'active' : ''}`}>{accepting === null ? 'Loading status' : accepting ? 'Accepting responses' : 'Paused'}</span></p>
        <button disabled={accepting === null || busy || loading || loadError} onClick={() => updateStatus(!accepting)}>
          {accepting === false ? 'Reopen survey' : 'Pause survey'}
        </button>
      </section>
    </div>
    <DailyResults days={days} day={day} failed={dailyError} selectDay={value => { setDay(value); setPage(0) }} />
    <section className="card">
      <div className="response-head"><h2>Responses <span className="muted">({count})</span></h2>
        <div className="buttons"><button disabled={loading || busy} onClick={refresh}>Refresh</button>
          <button className="primary" disabled={loading || busy || !count || loadError} onClick={download}>Export CSV</button></div>
      </div>
      {day && <p className="response-date">Showing {dayLabel(day)} <button onClick={() => { setDay(''); setPage(0) }}>Show all dates</button></p>}
      <div className="filters">
        <select value={intent} aria-label="Purchase intent" onChange={event => { setIntent(event.target.value); setPage(0) }}>
          <option value="">Any purchase intent</option>{intents.map(value => <option key={value}>{value}</option>)}
        </select>
        <select value={status} aria-label="Review status" onChange={event => { setStatus(event.target.value); setPage(0) }}>
          <option value="">Any review status</option><option value="new">New</option><option value="reviewed">Reviewed</option>
        </select>
      </div>
      {loading ? <p role="status">Loading responses…</p> : !loadError && (rows.length ? rows.map(row =>
        <details className="response" key={row.id}>
          <summary><span>#{row.id} <small>{dateFormat.format(new Date(row.created_at))}</small></span>
            <span>{products[row.favorite - 1][1]}</span><span>Buy · {row.intent}</span>
            <span className={`status ${row.reviewed ? '' : 'active'}`}>{row.reviewed ? 'Reviewed' : 'New'}</span></summary>
          <div className="response-body"><ul>{products.map(([name], index) =>
            <li key={name}>{name} <strong>{row.ratings[index]}/5</strong></li>
          )}</ul>
            <p className="comment">{row.comment || 'No comments provided.'}</p>
            <button disabled={busy} onClick={() => review(row)}>{row.reviewed ? 'Mark new' : 'Mark reviewed'}</button>
          </div>
        </details>
      ) : <p className="empty">{total ? 'No responses match these filters.' : 'Responses will appear here after guests submit feedback.'}</p>)}
      {count > PAGE_SIZE && !loadError && <div className="pages">
        <button disabled={loading || page === 0} onClick={() => setPage(page - 1)}>Previous</button>
        <span>Page {page + 1} of {Math.ceil(count / PAGE_SIZE)}</span>
        <button disabled={loading || (page + 1) * PAGE_SIZE >= count} onClick={() => setPage(page + 1)}>Next</button>
      </div>}
    </section>
  </main>
}
