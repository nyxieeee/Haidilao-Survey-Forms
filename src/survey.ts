export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
export const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const configured = Boolean(supabaseUrl && supabaseKey)

export const products = [
  ['Sesame & Spicy Vermicelli', 'Sesame & Spicy'],
  ['White Pepper Chicken Vermicelli', 'White Pepper Chicken'],
  ['Hi Cup – Tom Yum Flavor Powder', 'Tom Yum'],
  ['Hi Cup – Yijin Flavor Powder', 'Yijin'],
  ['Hi Cup – Pork Belly & Chicken Flavor Powder', 'Pork Belly & Chicken'],
] as const

export const intents = ['Yes', 'Maybe', 'No'] as const
export const feedbackLabel = 'Feedback and suggestions'
export const noFeedback = 'No feedback provided.'

async function publicRequest(path: string, options?: { body?: object; signal?: AbortSignal }) {
  const response = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/rest/v1/${path}`, {
    method: options?.body ? 'POST' : 'GET',
    headers: {
      apikey: supabaseKey,
      ...(supabaseKey.startsWith('eyJ') && { Authorization: `Bearer ${supabaseKey}` }),
      ...(options?.body && { 'Content-Type': 'application/json' }),
    },
    body: options?.body && JSON.stringify(options.body),
    signal: options?.signal,
  })
  if (!response.ok) throw new Error(`Survey request failed (${response.status})`)
  return response.json()
}

export async function surveyStatus(signal?: AbortSignal) {
  const rows = await publicRequest('tasting_settings?select=accepting&id=eq.1', { signal })
  if (typeof rows?.[0]?.accepting !== 'boolean') throw new Error('Missing survey status')
  return rows[0].accepting as boolean
}

export function submitSurvey(body: {
  p_submission_id: string
  p_ratings: number[]
  p_favorite: number
  p_intent: FormDataEntryValue | null
  p_comment: FormDataEntryValue | null
}) {
  return publicRequest('rpc/submit_tasting', { body })
}

export type ResponseRow = {
  id: number
  created_at: string
  ratings: number[]
  favorite: number
  intent: typeof intents[number]
  comment: string
  reviewed: boolean
}

export type Summary = {
  total: number
  unreviewed: number
  wouldBuy: number
  averages: (number | null)[]
  favorites: number[]
}
