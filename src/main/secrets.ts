import { app, safeStorage } from 'electron'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const KEY_FILE = 'provider-key.bin'
const MASTER_FILE = 'master.key'

function keyPath(): string {
  return path.join(app.getPath('userData'), KEY_FILE)
}

function masterPath(): string {
  return path.join(app.getPath('userData'), MASTER_FILE)
}

function masterKey(): Buffer {
  const file = masterPath()
  if (fs.existsSync(file)) return fs.readFileSync(file)
  const created = crypto.randomBytes(32)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, created, { mode: 0o600 })
  return created
}

function aesEncrypt(plain: string): Buffer {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey(), iv)
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, body])
}

function aesDecrypt(payload: Buffer): string {
  const iv = payload.subarray(0, 12)
  const tag = payload.subarray(12, 28)
  const body = payload.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8')
}

export type SecretStorage = 'safeStorage' | 'aes'

export function secretStatus(): { saved: boolean; storage: SecretStorage | null } {
  if (!fs.existsSync(keyPath())) return { saved: false, storage: null }
  const raw = fs.readFileSync(keyPath())
  if (raw.subarray(0, 5).toString() === 'safe:') return { saved: true, storage: 'safeStorage' }
  if (raw.subarray(0, 4).toString() === 'aes:') return { saved: true, storage: 'aes' }
  return { saved: false, storage: null }
}

export function saveSecret(plain: string): SecretStorage {
  const trimmed = plain.trim()
  if (!trimmed) throw new Error('API key trống.')
  fs.mkdirSync(app.getPath('userData'), { recursive: true })
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(trimmed)
    fs.writeFileSync(keyPath(), Buffer.concat([Buffer.from('safe:'), encrypted]), { mode: 0o600 })
    return 'safeStorage'
  }
  fs.writeFileSync(keyPath(), Buffer.concat([Buffer.from('aes:'), aesEncrypt(trimmed)]), { mode: 0o600 })
  return 'aes'
}

export function readSecret(): string | undefined {
  if (!fs.existsSync(keyPath())) return undefined
  const raw = fs.readFileSync(keyPath())
  if (raw.subarray(0, 5).toString() === 'safe:') {
    if (!safeStorage.isEncryptionAvailable()) return undefined
    return safeStorage.decryptString(raw.subarray(5))
  }
  if (raw.subarray(0, 4).toString() === 'aes:') return aesDecrypt(raw.subarray(4))
  return undefined
}

export function clearSecret(): void {
  if (fs.existsSync(keyPath())) fs.rmSync(keyPath())
}
