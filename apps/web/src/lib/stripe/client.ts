import Stripe from 'stripe'

if (!process.env['STRIPE_SECRET_KEY']) {
  throw new Error('STRIPE_SECRET_KEY is required')
}

export const stripe = new Stripe(process.env['STRIPE_SECRET_KEY'], {
  apiVersion: '2024-06-20',
  typescript: true,
})

// Price IDs — set these in Stripe dashboard, then add to env
export const PRICE_IDS = {
  individual_monthly: process.env['STRIPE_PRICE_INDIVIDUAL_MONTHLY'] ?? '',
  pro_monthly:        process.env['STRIPE_PRICE_PRO_MONTHLY'] ?? '',
  business_monthly:   process.env['STRIPE_PRICE_BUSINESS_MONTHLY'] ?? '',
  individual_annual:  process.env['STRIPE_PRICE_INDIVIDUAL_ANNUAL'] ?? '',
  pro_annual:         process.env['STRIPE_PRICE_PRO_ANNUAL'] ?? '',
  business_annual:    process.env['STRIPE_PRICE_BUSINESS_ANNUAL'] ?? '',
} as const

export type PriceKey = keyof typeof PRICE_IDS

export const PLAN_METADATA: Record<string, { id: string; name: string; price: number; annualPrice: number }> = {
  individual: { id: 'individual', name: 'Individual', price: 9,   annualPrice: 86 },
  pro:        { id: 'pro',        name: 'Pro',        price: 29,  annualPrice: 278 },
  business:   { id: 'business',   name: 'Business',   price: 299, annualPrice: 2870 },
}
