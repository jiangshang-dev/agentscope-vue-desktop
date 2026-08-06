#!/usr/bin/env node
/**
 * 签发桌面端激活密钥（与 src/main/license.ts 算法一致）。
 *
 * 用法：
 *   LICENSE_HMAC_SECRET=your-secret node scripts/gen-license.mjs
 *   node scripts/gen-license.mjs --days 365 --plan pro --uid acme
 *
 * 生产环境务必与打包时的 LICENSE_HMAC_SECRET 保持一致。
 */

import { createHmac } from 'crypto'

function parseArgs(argv) {
  const out = { days: 365, plan: 'standard', uid: '', note: '', forever: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--days') out.days = Number(argv[++i] || 365)
    else if (a === '--plan') out.plan = String(argv[++i] || 'standard')
    else if (a === '--uid') out.uid = String(argv[++i] || '')
    else if (a === '--note') out.note = String(argv[++i] || '')
    else if (a === '--forever') out.forever = true
  }
  return out
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64url')
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const secret =
    (process.env.LICENSE_HMAC_SECRET || '').trim() ||
    'agentscope-desktop-dev-secret-change-me'

  const payload = {
    v: 1,
    plan: args.plan,
    uid: args.uid || undefined,
    note: args.note || undefined,
    exp: args.forever ? 0 : Math.floor(Date.now() / 1000) + args.days * 86400,
  }
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k])

  const payloadB64 = b64url(JSON.stringify(payload))
  const sig = createHmac('sha256', secret).update(payloadB64).digest('base64url')
  const key = `AGOS.${payloadB64}.${sig}`

  console.log('--- License ---')
  console.log(JSON.stringify(payload, null, 2))
  console.log(
    'secret:',
    secret === 'agentscope-desktop-dev-secret-change-me' ? '(default DEV)' : '(custom)',
  )
  console.log('key:')
  console.log(key)
}

main()
