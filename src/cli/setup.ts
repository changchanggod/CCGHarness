import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT = "ccg-harness-credential-salt-v1";

function getCredsDir(): string {
  return process.env.CCG_CREDS_DIR ?? path.join(os.homedir(), ".ccg");
}

function getCredsFilePath(): string {
  return process.env.CCG_CREDS_FILE ?? path.join(getCredsDir(), "credentials.json");
}

function deriveKey(): Buffer {
  const hostname = os.hostname();
  return crypto.pbkdf2Sync(hostname, SALT, 100_000, KEY_LENGTH, "sha256");
}

function encrypt(plaintext: string): string {
  const key = deriveKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, tag, encrypted]);
  return combined.toString("base64");
}

function decrypt(encoded: string): string {
  const key = deriveKey();
  const combined = Buffer.from(encoded, "base64");
  const iv = combined.subarray(0, IV_LENGTH);
  const tag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf-8");
}

interface CredentialStore {
  [provider: string]: string;
}

function readStore(): CredentialStore {
  const filePath = getCredsFilePath();
  if (!fs.existsSync(filePath)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);
    const store: CredentialStore = {};
    for (const [provider, encrypted] of Object.entries(data)) {
      if (typeof encrypted === "string") {
        store[provider] = decrypt(encrypted);
      }
    }
    return store;
  } catch {
    return {};
  }
}

function writeStore(store: CredentialStore): void {
  const dir = getCredsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const encrypted: Record<string, string> = {};
  for (const [provider, key] of Object.entries(store)) {
    encrypted[provider] = encrypt(key);
  }
  const filePath = getCredsFilePath();
  fs.writeFileSync(filePath, JSON.stringify(encrypted, null, 2), "utf-8");
}

export async function storeApiKey(provider: string, key: string): Promise<void> {
  const store = readStore();
  store[provider] = key;
  writeStore(store);
}

export async function getApiKey(provider: string): Promise<string | null> {
  const store = readStore();
  return store[provider] ?? null;
}

export async function removeApiKey(provider: string): Promise<void> {
  const store = readStore();
  delete store[provider];
  writeStore(store);
}

export async function checkApiKey(provider: string): Promise<boolean> {
  const key = await getApiKey(provider);
  return key !== null;
}