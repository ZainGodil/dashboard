/**
 * Corrects Google Ads monthly spend totals in Supabase by proportionally
 * scaling all daily campaign rows to match the known-correct figures.
 *
 * Usage:
 *   node scripts/fix-google-ads-spend.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env — check several candidate paths
const ENV_CANDIDATES = [
  resolve(__dirname, '../.env.local'),
  resolve(__dirname, '../.env'),
  resolve(__dirname, '../../.env.local'),
  resolve(__dirname, '../../.env'),
  resolve(__dirname, '../../../.env.local'),
  resolve(__dirname, '../../../.env'),
]

const envVars = {}
let loaded = false
for (const envPath of ENV_CANDIDATES) {
  try {
    const raw = readFileSync(envPath, 'utf8')
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx < 0) continue
      const key = trimmed.slice(0, idx).trim()
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
      envVars[key] = val
    }
    console.log(`Loaded env from: ${envPath}`)
    loaded = true
    break
  } catch {
    // try next
  }
}
if (!loaded) console.error('No .env file found — falling back to process.env')

const SUPABASE_URL = envVars.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
const DRY_RUN = process.argv.includes('--dry-run')

// Correct monthly totals (per user's known-good figures)
const CORRECTIONS = [
  { prefix: '2026-05', target: 10472.54 },
  { prefix: '2026-06', target: 4021.63 },
]

function monthEnd(prefix) {
  const [yr, mo] = prefix.split('-').map(Number)
  return new Date(yr, mo, 0).toISOString().split('T')[0] // last day of month
}

async function fetchRows(prefix) {
  const { data, error } = await supabase
    .from('ad_spend')
    .select('date, campaign_name, spend, university, course, segment, impressions, clicks, synced_at')
    .eq('platform', 'google')
    .gte('date', `${prefix}-01`)
    .lte('date', monthEnd(prefix))

  if (error) throw new Error(`Fetch error for ${prefix}: ${error.message}`)
  return data ?? []
}

async function run() {
  for (const { prefix, target } of CORRECTIONS) {
    const rows = await fetchRows(prefix)
    if (!rows.length) {
      console.log(`[${prefix}] No Google Ads rows found — skipping.`)
      continue
    }

    const currentTotal = rows.reduce((s, r) => s + Number(r.spend), 0)
    console.log(`\n[${prefix}]`)
    console.log(`  Rows:    ${rows.length}`)
    console.log(`  Current: $${currentTotal.toFixed(2)}`)
    console.log(`  Target:  $${target.toFixed(2)}`)

    if (Math.abs(currentTotal - target) < 0.01) {
      console.log('  ✓ Already correct — no changes needed.')
      continue
    }

    const scale = target / currentTotal
    console.log(`  Scale:   ${scale.toFixed(6)}`)

    const corrected = rows.map((r) => ({
      date: r.date,
      platform: 'google',
      campaign_name: r.campaign_name,
      university: r.university,
      course: r.course,
      segment: r.segment,
      spend: Math.round(Number(r.spend) * scale * 100) / 100,
      impressions: r.impressions,
      clicks: r.clicks,
      synced_at: new Date().toISOString(),
    }))

    // Verify the corrected total rounds correctly
    const correctedTotal = corrected.reduce((s, r) => s + r.spend, 0)
    console.log(`  Corrected total: $${correctedTotal.toFixed(2)} (rounding diff: ${(correctedTotal - target).toFixed(4)})`)

    if (DRY_RUN) {
      console.log('  [DRY RUN] No changes written.')
      continue
    }

    const BATCH = 500
    for (let i = 0; i < corrected.length; i += BATCH) {
      const { error } = await supabase
        .from('ad_spend')
        .upsert(corrected.slice(i, i + BATCH), { onConflict: 'date,platform,campaign_name' })
      if (error) throw new Error(`Upsert error for ${prefix}: ${error.message}`)
    }

    console.log(`  ✓ Updated ${corrected.length} rows.`)
  }

  console.log('\nDone.')
}

run().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
