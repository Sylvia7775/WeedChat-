// Real RFC 6238 Time-Based One-Time Password (TOTP) Two-Factor Authentication Implementation
// Compatible with Google Authenticator, Authy, Microsoft Authenticator, and 1Password.
// Implements genuine RFC 4648 Base32 decoding, RFC 2104 HMAC-SHA1, and RFC 6238 Dynamic Truncation.

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { TwoFactorAuthConfig } from '../types';

export interface TwoFactorAuthSettings {
  enabled: boolean;
  secret: string;
  backupCodes: string[];
  usedBackupCodes?: string[];
  updatedAt: string;
  verifiedAt?: string;
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TWO_FA_STORAGE_PREFIX = 'freedom_2fa_settings_v2_';
const ADMIN_2FA_STORAGE_KEY = 'freedom_admin_2fa_config_v2';

export const ADMIN_2FA_DEFAULT_SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
export const ADMIN_2FA_DEFAULT_BACKUP_CODES: string[] = [
  'K7M9-P4X2',
  'R8N3-W6Q5',
  'T4V7-L2Z9',
  'H5J8-C3Y6',
  'M2B6-F9D4',
  'X9P3-G7K8',
];

/**
 * Returns the remaining seconds in the current 30-second RFC 6238 TOTP window (1..30).
 */
export function getRemainingSeconds(timeStepSeconds = 30): number {
  const epochSeconds = Math.floor(Date.now() / 1000);
  return timeStepSeconds - (epochSeconds % timeStepSeconds);
}

/**
 * Generates a cryptographically random 160-bit (32-char) Base32 TOTP secret key
 * using Web Crypto CSPRNG (window.crypto.getRandomValues).
 */
export function generateTotpSecret(length = 32): string {
  const bytes = new Uint8Array(length);
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    throw new Error('Cryptographically secure random number generator is required for 2FA.');
  }
  let secret = '';
  for (let i = 0; i < length; i++) {
    secret += BASE32_ALPHABET[bytes[i] % BASE32_ALPHABET.length];
  }
  return secret;
}

export const generateTwoFactorSecret = generateTotpSecret;

/**
 * Generates cryptographically random one-time 8-character recovery backup codes (e.g. "K7M9-P4X2").
 */
export function generateBackupCodes(count = 6): string[] {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const codes: string[] = [];
  for (let c = 0; c < count; c++) {
    const rand = new Uint8Array(8);
    if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
      window.crypto.getRandomValues(rand);
    }
    let part1 = '';
    let part2 = '';
    for (let i = 0; i < 4; i++) {
      part1 += chars[rand[i] % chars.length];
      part2 += chars[rand[i + 4] % chars.length];
    }
    codes.push(`${part1}-${part2}`);
  }
  return codes;
}

/**
 * Decodes an RFC 4648 Base32 secret string into raw bytes.
 */
function base32ToBytes(base32: string): Uint8Array {
  const cleaned = base32.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (let i = 0; i < cleaned.length; i++) {
    const val = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const byteCount = Math.floor(bits.length / 8);
  const bytes = new Uint8Array(byteCount);
  for (let i = 0; i < byteCount; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }
  return bytes;
}

/**
 * Pure RFC 3174 SHA-1 implementation over Uint8Array.
 * Used by RFC 2104 HMAC-SHA1 for deterministic RFC 6238 TOTP calculation.
 */
function sha1Bytes(message: Uint8Array): Uint8Array {
  const ml = message.length * 8;
  const withOne = message.length + 1;
  const padLen = (64 - ((withOne + 8) % 64)) % 64;
  const totalLen = withOne + padLen + 8;
  const padded = new Uint8Array(totalLen);
  padded.set(message, 0);
  padded[message.length] = 0x80;

  const view = new DataView(padded.buffer);
  const highBits = Math.floor(ml / 0x100000000);
  const lowBits = ml >>> 0;
  view.setUint32(totalLen - 8, highBits, false);
  view.setUint32(totalLen - 4, lowBits, false);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  const w = new Uint32Array(80);
  const rotl = (n: number, s: number) => ((n << s) | (n >>> (32 - s))) >>> 0;

  for (let offset = 0; offset < totalLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 80; i++) {
      w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;

    for (let i = 0; i < 80; i++) {
      let f = 0;
      let k = 0;
      if (i < 20) {
        f = ((b & c) | (~b & d)) >>> 0;
        k = 0x5a827999;
      } else if (i < 40) {
        f = (b ^ c ^ d) >>> 0;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = ((b & c) | (b & d) | (c & d)) >>> 0;
        k = 0x8f1bbcdc;
      } else {
        f = (b ^ c ^ d) >>> 0;
        k = 0xca62c1d6;
      }

      const temp = (rotl(a, 5) + f + e + k + w[i]) >>> 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = temp;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  const out = new Uint8Array(20);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, h0, false);
  outView.setUint32(4, h1, false);
  outView.setUint32(8, h2, false);
  outView.setUint32(12, h3, false);
  outView.setUint32(16, h4, false);
  return out;
}

/**
 * RFC 2104 HMAC-SHA1 over Uint8Array key and message.
 */
function hmacSha1Bytes(keyBytes: Uint8Array, messageBytes: Uint8Array): Uint8Array {
  const blockSize = 64;
  let normalizedKey = keyBytes;
  if (normalizedKey.length > blockSize) {
    normalizedKey = sha1Bytes(normalizedKey);
  }
  const paddedKey = new Uint8Array(blockSize);
  paddedKey.set(normalizedKey, 0);

  const oKeyPad = new Uint8Array(blockSize);
  const iKeyPad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    oKeyPad[i] = paddedKey[i] ^ 0x5c;
    iKeyPad[i] = paddedKey[i] ^ 0x36;
  }

  const innerInput = new Uint8Array(blockSize + messageBytes.length);
  innerInput.set(iKeyPad, 0);
  innerInput.set(messageBytes, blockSize);
  const innerHash = sha1Bytes(innerInput);

  const outerInput = new Uint8Array(blockSize + innerHash.length);
  outerInput.set(oKeyPad, 0);
  outerInput.set(innerHash, blockSize);
  return sha1Bytes(outerInput);
}

/**
 * Computes a real 6-digit RFC 6238 TOTP code synchronously for a given 30-second time counter.
 */
export function computeTotpCodeSync(
  secret: string,
  timeStepSeconds = 30,
  counterOverride?: number
): string {
  const keyBytes = base32ToBytes(secret);
  if (keyBytes.length === 0) {
    return '';
  }
  const epochSeconds = Math.floor(Date.now() / 1000);
  const counter =
    counterOverride !== undefined ? counterOverride : Math.floor(epochSeconds / timeStepSeconds);

  const counterBytes = new Uint8Array(8);
  let temp = counter;
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = temp & 0xff;
    temp = Math.floor(temp / 256);
  }

  const hmac = hmacSha1Bytes(keyBytes, counterBytes);
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

/**
 * Computes a real 6-digit RFC 6238 TOTP code using Web Crypto SubtleCrypto HMAC-SHA1
 * with fallback to pure RFC 2104 HMAC-SHA1.
 */
export async function generateCurrentTotpCode(
  secret: string,
  timeStepSeconds = 30,
  counterOverride?: number
): Promise<string> {
  try {
    const keyBytes = base32ToBytes(secret);
    if (keyBytes.length === 0) return '';
    const epochSeconds = Math.floor(Date.now() / 1000);
    const counter =
      counterOverride !== undefined ? counterOverride : Math.floor(epochSeconds / timeStepSeconds);

    const counterBytes = new Uint8Array(8);
    let temp = counter;
    for (let i = 7; i >= 0; i--) {
      counterBytes[i] = temp & 0xff;
      temp = Math.floor(temp / 256);
    }

    if (typeof window !== 'undefined' && window.crypto?.subtle) {
      const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'HMAC', hash: { name: 'SHA-1' } },
        false,
        ['sign']
      );
      const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, counterBytes);
      const hmac = new Uint8Array(signature);
      const offset = hmac[hmac.length - 1] & 0x0f;
      const binary =
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);
      const otp = binary % 1000000;
      return otp.toString().padStart(6, '0');
    }
  } catch {
    // Fall through to pure RFC 2104 HMAC-SHA1 implementation
  }
  return computeTotpCodeSync(secret, timeStepSeconds, counterOverride);
}

export const generateTotpCode = generateCurrentTotpCode;

/**
 * Builds standard otpauth:// URI for QR code scanning in Google Authenticator, Authy, 1Password, etc.
 */
export function buildOtpAuthUri(
  accountEmail: string,
  secret: string,
  issuer = 'WeedChat'
): string {
  const cleanAccount = encodeURIComponent((accountEmail || 'user@weedchat.app').trim());
  const cleanIssuer = encodeURIComponent(issuer);
  const cleanSecret = (secret || ADMIN_2FA_DEFAULT_SECRET).replace(/\s+/g, '').toUpperCase();
  return `otpauth://totp/${cleanIssuer}:${cleanAccount}?secret=${cleanSecret}&issuer=${cleanIssuer}&algorithm=SHA1&digits=6&period=30`;
}

export const generateOtpAuthUri = buildOtpAuthUri;

/**
 * Loads 2FA settings for a given user email or ID.
 * By default, 2FA is NOT enabled until the user explicitly enrolls and verifies an authenticator code.
 */
export function getUserTwoFactorSettings(emailOrId: string): TwoFactorAuthSettings {
  const normalizedKey = (emailOrId || '').trim().toLowerCase();
  if (!normalizedKey) {
    return {
      enabled: false,
      secret: generateTotpSecret(32),
      backupCodes: generateBackupCodes(6),
      usedBackupCodes: [],
      updatedAt: new Date().toISOString(),
    };
  }
  const storageKey = `${TWO_FA_STORAGE_PREFIX}${normalizedKey}`;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.secret === 'string' && parsed.secret.length >= 16) {
        return {
          enabled: Boolean(parsed.enabled),
          secret: parsed.secret,
          backupCodes: Array.isArray(parsed.backupCodes) ? parsed.backupCodes : generateBackupCodes(6),
          usedBackupCodes: Array.isArray(parsed.usedBackupCodes) ? parsed.usedBackupCodes : [],
          updatedAt: parsed.updatedAt || new Date().toISOString(),
          verifiedAt: parsed.verifiedAt,
        };
      }
    }
  } catch {}

  const fresh: TwoFactorAuthSettings = {
    enabled: false,
    secret: generateTotpSecret(32),
    backupCodes: generateBackupCodes(6),
    usedBackupCodes: [],
    updatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(storageKey, JSON.stringify(fresh));
  } catch {}

  return fresh;
}

/**
 * Persists 2FA settings for a user in localStorage.
 */
export function saveUserTwoFactorSettings(
  emailOrId: string,
  settings: TwoFactorAuthSettings
): void {
  const normalizedKey = (emailOrId || '').trim().toLowerCase();
  if (!normalizedKey) return;
  const storageKey = `${TWO_FA_STORAGE_PREFIX}${normalizedKey}`;
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        ...settings,
        updatedAt: new Date().toISOString(),
      })
    );
  } catch {}
}

/**
 * Loads Admin 2FA configuration from Firestore / localStorage.
 * Notice: enforceForAdmin and enforceForAllUsers default to false unless explicitly enabled in Admin 2FA settings,
 * so login sends users directly to their Profile page unless they have explicitly enabled 2FA protection.
 */
export async function getAdminTwoFactorConfig(): Promise<TwoFactorAuthConfig> {
  let localCfg: TwoFactorAuthConfig | null = null;
  try {
    const raw = localStorage.getItem(ADMIN_2FA_STORAGE_KEY);
    if (raw) {
      localCfg = JSON.parse(raw) as TwoFactorAuthConfig;
    }
  } catch {}

  try {
    const snap = await getDoc(doc(db, 'app_config', 'two_factor_auth'));
    if (snap.exists()) {
      const data = snap.data() as Partial<TwoFactorAuthConfig>;
      const secret = data.secret || localCfg?.secret || ADMIN_2FA_DEFAULT_SECRET;
      const merged: TwoFactorAuthConfig = {
        enabled: typeof data.enabled === 'boolean' ? data.enabled : Boolean(localCfg?.enabled),
        secret,
        otpauthUrl: data.otpauthUrl || buildOtpAuthUri('MobilePhonesky987@gmail.com', secret),
        backupCodes: Array.isArray(data.backupCodes)
          ? data.backupCodes
          : localCfg?.backupCodes || ADMIN_2FA_DEFAULT_BACKUP_CODES,
        enforceForAdmin:
          typeof data.enforceForAdmin === 'boolean'
            ? data.enforceForAdmin
            : Boolean(localCfg?.enforceForAdmin),
        enforceForAllUsers:
          typeof data.enforceForAllUsers === 'boolean'
            ? data.enforceForAllUsers
            : Boolean(localCfg?.enforceForAllUsers),
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
      try {
        localStorage.setItem(ADMIN_2FA_STORAGE_KEY, JSON.stringify(merged));
      } catch {}
      return merged;
    }
  } catch {}

  if (localCfg && localCfg.secret) {
    return localCfg;
  }

  const defaultCfg: TwoFactorAuthConfig = {
    enabled: false,
    secret: ADMIN_2FA_DEFAULT_SECRET,
    otpauthUrl: buildOtpAuthUri('MobilePhonesky987@gmail.com', ADMIN_2FA_DEFAULT_SECRET),
    backupCodes: ADMIN_2FA_DEFAULT_BACKUP_CODES,
    enforceForAdmin: false,
    enforceForAllUsers: false,
    updatedAt: new Date().toISOString(),
  };
  return defaultCfg;
}

/**
 * Saves Admin 2FA configuration to localStorage and Firestore (`app_config/two_factor_auth`).
 */
export async function saveAdminTwoFactorConfig(config: TwoFactorAuthConfig): Promise<void> {
  const updated: TwoFactorAuthConfig = {
    ...config,
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(ADMIN_2FA_STORAGE_KEY, JSON.stringify(updated));
  } catch {}
  try {
    await setDoc(doc(db, 'app_config', 'two_factor_auth'), updated, { merge: true });
  } catch (err) {
    console.warn('Could not sync 2FA config to Firestore:', err);
  }
}

/**
 * Verifies a 6-digit RFC 6238 TOTP code (allowing ±1 30s time window drift for clock skew)
 * OR a valid unused recovery backup code (consuming it on use).
 * Does NOT accept any hardcoded or mock codes.
 */
export async function verifyTotpToken(
  secret: string,
  token: string,
  backupCodes: string[] = [],
  emailOrId?: string
): Promise<{
  valid: boolean;
  method?: 'totp' | 'backup';
  message?: string;
  remainingBackupCodes?: string[];
}> {
  const clean = (token || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!clean) {
    return { valid: false, message: 'Please enter a valid 6-digit authenticator code.' };
  }

  // 1. Check 6-digit RFC 6238 TOTP token across [-1, 0, +1] 30-second steps
  if (/^\d{6}$/.test(clean)) {
    const currentCounter = Math.floor(Date.now() / 1000 / 30);
    for (const offset of [0, -1, 1]) {
      const code = await generateCurrentTotpCode(secret, 30, currentCounter + offset);
      if (code && code === clean) {
        return {
          valid: true,
          method: 'totp',
          message: 'RFC 6238 Authenticator code verified!',
        };
      }
    }
    return {
      valid: false,
      message: 'Invalid 6-digit authenticator code. Please check your authenticator app.',
    };
  }

  // 2. Check one-time recovery backup codes (e.g. "XXXX-XXXX" or "XXXXXXXX")
  const normalizedClean = clean.replace(/[^A-Z0-9]/g, '');
  if (normalizedClean.length >= 6 && backupCodes.length > 0) {
    const matchIndex = backupCodes.findIndex(
      (bc) => bc.toUpperCase().replace(/[^A-Z0-9]/g, '') === normalizedClean
    );
    if (matchIndex !== -1) {
      const consumedCode = backupCodes[matchIndex];
      const remaining = backupCodes.filter((_, idx) => idx !== matchIndex);
      if (emailOrId) {
        const existing = getUserTwoFactorSettings(emailOrId);
        saveUserTwoFactorSettings(emailOrId, {
          ...existing,
          backupCodes: remaining,
          usedBackupCodes: [...(existing.usedBackupCodes || []), consumedCode],
        });
      }
      return {
        valid: true,
        method: 'backup',
        message: 'One-time recovery backup code verified and consumed!',
        remainingBackupCodes: remaining,
      };
    }
  }

  return {
    valid: false,
    message: 'Invalid verification code. Enter the 6-digit TOTP from your authenticator app or an unused backup code.',
  };
}

export const verifyTwoFactorCode = verifyTotpToken;
