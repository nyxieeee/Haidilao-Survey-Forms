import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase = url && key ? createClient(url, key) : null

export const products = [
  ['Sesame & Spicy Vermicelli', 'Sesame & Spicy'],
  ['White Pepper Chicken Vermicelli', 'White Pepper Chicken'],
  ['Hi Cup – Tom Yum Flavor Powder', 'Tom Yum'],
  ['Hi Cup – Yijin Flavor Powder', 'Yijin'],
  ['Hi Cup – Pork Belly & Chicken Flavor Powder', 'Pork Belly & Chicken'],
] as const

export const intents = ['Yes', 'Maybe', 'No'] as const

export async function surveyStatus() {
  const result = await supabase!.from('tasting_settings').select('accepting').eq('id', 1).single()
  if (result.error) throw result.error
  return result.data.accepting as boolean
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
