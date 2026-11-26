import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { configured, intents, products, submitSurvey, surveyStatus } from './survey'
import hotPotPhoto from './haidilao-hotpot.webp'

const scores = [1, 2, 3, 4, 5]

export function Guest() {
  const [accepting, setAccepting] = useState<boolean | null>(null)
  const [statusError, setStatusError] = useState(false)
  const [statusAttempt, setStatusAttempt] = useState(0)
  const [sending, setSending] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const submissionId = useRef('')
  const confirmation = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (!configured) return
    const request = new AbortController()
    surveyStatus(request.signal).then(value => {
      if (!request.signal.aborted) { setAccepting(value); setStatusError(false) }
    }).catch(() => { if (!request.signal.aborted) setStatusError(true) })
    return () => request.abort()
  }, [statusAttempt])

  useEffect(() => {
    if (submitted) confirmation.current?.focus()
  }, [submitted])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sending || !configured || accepting !== true) return
    const fields = new FormData(event.currentTarget)
    setSending(true)
    setError('')
    try {
      submissionId.current ||= crypto.randomUUID()
      const data = await submitSurvey({
        p_submission_id: submissionId.current,
        p_ratings: products.map((_, index) => Number(fields.get(`rating-${index}`))),
        p_favorite: Number(fields.get('favorite')),
        p_intent: fields.get('intent'),
        p_comment: String(fields.get('comment') ?? '').trim(),
      })
      if (data === 'paused') {
        setError('The survey was paused before your response could be saved. Try again when it reopens.')
      } else if (data === 'accepted') {
        setSubmitted(true)
      } else {
        throw new Error('Unexpected submission result')
      }
    } catch {
      setError('We couldn’t save your feedback. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return <main className="guest page-width">
    <aside className="hero">
      <div className="hero-intro">
        <p className="eyebrow">FOOD SAMPLING</p>
        <h1>What did<br /> you <em>taste?</em></h1>
        <p className="hero-copy">Tell us what you thought of the Haidilao samples.</p>
        <p className="hero-meta">About 2 minutes <span>·</span> No name or email required</p>
      </div>
      <div className="hero-art" aria-hidden="true">
        <img src={hotPotPhoto} alt="" width={1000} height={520} />
      </div>
    </aside>
    <div className="form-column">
      {submitted ? <section className="card notice">
        <p className="eyebrow">FEEDBACK RECEIVED</p>
        <h2 ref={confirmation} tabIndex={-1}>Thanks for tasting with us!</h2>
        <p>Your response has been saved.</p>
      </section> : statusError ? <section className="card notice">
        <h2>Survey temporarily unavailable</h2><p>We couldn’t load the survey status.</p>
        <button onClick={() => setStatusAttempt(statusAttempt + 1)}>Try again</button>
      </section> : accepting === false ? <section className="card notice">
          <h2>Survey paused</h2><p>We’re taking a break from collecting tasting feedback.</p>
          <button onClick={() => setStatusAttempt(statusAttempt + 1)}>Check again</button>
        </section> : <form onSubmit={submit}>
          {!configured && <p className="alert">Preview mode. Connect Supabase to accept responses.</p>}
          <section className="card">
            <h2>Rate the samples</h2>
            <p className="muted">Choose a rating for each product.</p>
            <div className="scale"><span>1 · Poor</span><span>5 · Excellent</span></div>
            {products.map(([name], index) => <fieldset className="rating" key={name}>
              <legend>{name}</legend>
              <div className="options scores">{scores.map(score => <label key={score}>
                <input required type="radio" name={`rating-${index}`} value={score} aria-label={`${score} out of 5`} />
                <span>{score}</span>
              </label>)}</div>
            </fieldset>)}
          </section>
          <section className="card">
            <h2>Pick your favorite</h2>
            <fieldset><legend className="sr-only">Which sample was your favorite?</legend>
              <div className="options">{products.map(([, short], index) => <label key={short}>
                <input required type="radio" name="favorite" value={index + 1} /><span>{short}</span>
              </label>)}</div>
            </fieldset>
            <fieldset className="purchase"><legend>Would you buy your favorite?</legend>
              <div className="options">{intents.map(intent => <label key={intent}>
                <input required type="radio" name="intent" value={intent} /><span>{intent}</span>
              </label>)}</div>
            </fieldset>
          </section>
          <section className="card">
            <h2><label htmlFor="comment">Comments or suggestions</label></h2>
            <p className="muted" id="comment-help">Optional. Tell us what you liked or what could be better.</p>
            <textarea id="comment" name="comment" maxLength={1500} rows={4} aria-describedby="comment-help" placeholder="Share your thoughts…" />
          </section>
          {error && <p role="alert" className="alert">{error}</p>}
          {configured && accepting === null && <p role="status" className="muted">Checking whether the survey is open…</p>}
          <button type="submit" className="primary submit" disabled={sending || !configured || accepting !== true}>{sending ? 'Saving…' : 'Submit feedback'}</button>
        </form>}
    </div>
  </main>
}
