/**
 * 桌面端激活密钥（离线 HMAC 校验）。
 *
 * 密钥格式：AGOS.<base64url(payload)>.<base64url(hmac-sha256)>
 * payload JSON 例：{ "v": 1, "plan": "standard", "exp": 1893456000, "uid": "acme" }
 *   - exp：Unix 秒，缺省或 0 表示永不过期
 *   - plan / uid：展示用
 *
 * 密钥签发见 scripts/gen-license.mjs。
 * 激活状态落盘：app.getPath('userData')/license.json
 *
 * TODO(license): 生产环境改为服务端签发 + 定期在线校验；更换 LICENSE_HMAC_SECRET。
 */

import { createHmac, createHash, timingSafeEqual } from 'crypto'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { hostname, platform, userInfo } from 'os'
import { join } from 'path'
import { app } from 'electron'

export type LicensePayload = {
  v: number
  plan?: string
  exp?: number
  uid?: string
  note?: string
}

export type LicenseStatus = {
  activated: boolean
  plan: string
  uid: string
  exp: number | null
  expLabel: string
  machineId: string
  message: string
}

type StoredLicense = {
  key: string
  activatedAt: string
  machineId: string
  payload: LicensePayload
}

/** 生产务必用环境变量覆盖；打包前设置 LICENSE_HMAC_SECRET（会写入主进程） */
const DEFAULT_SECRET = 'agentscope-desktop-dev-secret-change-me'

declare const __LICENSE_HMAC_SECRET__: string | undefined

function licenseSecret(): string {
  if (typeof __LICENSE_HMAC_SECRET__ === 'string' && __LICENSE_HMAC_SECRET__.trim()) {
    return __LICENSE_HMAC_SECRET__.trim()
  }
  return (process.env.LICENSE_HMAC_SECRET || DEFAULT_SECRET).trim() || DEFAULT_SECRET
}

function b64urlEncode(buf: Buffer | string): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf, 'utf8')
  return b.toString('base64url')
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s, 'base64url')
}

export function machineFingerprint(): string {
  const raw = `${platform()}|${hostname()}|${userInfo().username}`
  return createHash('sha256').update(raw).digest('hex').slice(0, 16)
}

function signPayload(payloadB64: string): string {
  return createHmac('sha256', licenseSecret()).update(payloadB64).digest('base64url')
}

function safeEqualStr(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

export function parseAndVerifyKey(key: string): { ok: true; payload: LicensePayload } | { ok: false; error: string } {
  const raw = key.trim().replace(/\s+/g, '')
  const parts = raw.split('.')
  if (parts.length !== 3 || parts[0] !== 'AGOS') {
    return { ok: false, error: '密钥格式无效（期望 AGOS.<payload>.<签名>）' }
  }
  const [, payloadB64, sig] = parts
  if (!payloadB64 || !sig) {
    return { ok: false, error: '密钥不完整' }
  }
  const expect = signPayload(payloadB64)
  if (!safeEqualStr(expect, sig)) {
    return { ok: false, error: '密钥签名校验失败' }
  }
  let payload: LicensePayload
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString('utf8')) as LicensePayload
  } catch {
    return { ok: false, error: '密钥内容无法解析' }
  }
  if (!payload || payload.v !== 1) {
    return { ok: false, error: '不支持的密钥版本' }
  }
  const exp = Number(payload.exp || 0)
  if (exp > 0 && Math.floor(Date.now() / 1000) > exp) {
    return { ok: false, error: '密钥已过期' }
  }
  return { ok: true, payload }
}

function licenseFilePath(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'license.json')
}

function readStored(): StoredLicense | null {
  const p = licenseFilePath()
  if (!existsSync(p)) return null
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as StoredLicense
  } catch {
    return null
  }
}

function writeStored(data: StoredLicense): void {
  writeFileSync(licenseFilePath(), JSON.stringify(data, null, 2), 'utf8')
}

function clearStored(): void {
  const p = licenseFilePath()
  try {
    if (existsSync(p)) unlinkSync(p)
  } catch {
    /* ignore */
  }
}

function formatExp(exp?: number): string {
  if (!exp) return '永久'
  return new Date(exp * 1000).toLocaleString('zh-CN')
}

export function getLicenseStatus(): LicenseStatus {
  const mid = machineFingerprint()
  const stored = readStored()
  if (!stored?.key) {
    return {
      activated: false,
      plan: '',
      uid: '',
      exp: null,
      expLabel: '',
      machineId: mid,
      message: '未激活：请输入激活密钥后才能使用对话功能',
    }
  }
  // 本机绑定：防止直接拷贝 license.json 到其它机器
  if (stored.machineId && stored.machineId !== mid) {
    return {
      activated: false,
      plan: '',
      uid: '',
      exp: null,
      expLabel: '',
      machineId: mid,
      message: '激活信息与当前设备不匹配，请重新输入密钥',
    }
  }
  const verified = parseAndVerifyKey(stored.key)
  if (!verified.ok) {
    return {
      activated: false,
      plan: '',
      uid: '',
      exp: null,
      expLabel: '',
      machineId: mid,
      message: verified.error,
    }
  }
  const exp = Number(verified.payload.exp || 0) || null
  return {
    activated: true,
    plan: verified.payload.plan || 'standard',
    uid: verified.payload.uid || '',
    exp,
    expLabel: formatExp(verified.payload.exp),
    machineId: mid,
    message: '已激活',
  }
}

export function activateLicense(key: string): LicenseStatus {
  const verified = parseAndVerifyKey(key)
  if (!verified.ok) {
    return {
      activated: false,
      plan: '',
      uid: '',
      exp: null,
      expLabel: '',
      machineId: machineFingerprint(),
      message: verified.error,
    }
  }
  const mid = machineFingerprint()
  writeStored({
    key: key.trim().replace(/\s+/g, ''),
    activatedAt: new Date().toISOString(),
    machineId: mid,
    payload: verified.payload,
  })
  return getLicenseStatus()
}

export function deactivateLicense(): LicenseStatus {
  clearStored()
  return getLicenseStatus()
}

export function issueLicenseKey(payload: Omit<LicensePayload, 'v'> & { v?: number }): string {
  const body: LicensePayload = {
    v: 1,
    plan: payload.plan,
    exp: payload.exp,
    uid: payload.uid,
    note: payload.note,
  }
  const payloadB64 = b64urlEncode(JSON.stringify(body))
  const sig = signPayload(payloadB64)
  return `AGOS.${payloadB64}.${sig}`
}
