#!/usr/bin/env node
/**
 * Usage:
 *   node scripts/create-user.mjs --email user@example.com --password abc123
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnv() {
  try {
    const env = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    for (const line of env.split('\n')) {
      const [key, ...rest] = line.split('=')
      if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
    }
  } catch {
    // already set in environment
  }
}

loadEnv()

const args = process.argv.slice(2)
const email = args[args.indexOf('--email') + 1]
const password = args[args.indexOf('--password') + 1]

if (!email || !password) {
  console.error('Usage: node scripts/create-user.mjs --email <email> --password <password>')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
})

if (error) {
  console.error('Failed to create user:', error.message)
  process.exit(1)
}

console.log(`User created: ${data.user.email} (${data.user.id})`)
