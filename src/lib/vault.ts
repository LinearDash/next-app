import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// GEMINI_KEY_ENCRYPTION_KEYS="v2:<base64 32 bytes>,v1:<base64 32 bytes>" — first entry encrypts,
// all entries decrypt (rotation). Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
export type SealedKey = {
  ciphertext: string;
  nonce: string;
  auth_tag: string;
  key_version: string;
};

export class VaultError extends Error {
  code: "configuration" | "undecryptable";
  constructor(code: VaultError["code"]) {
    super("Key vault operation failed");
    this.code = code;
  }
}

function keys() {
  const entries = (process.env.GEMINI_KEY_ENCRYPTION_KEYS || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [version, encoded] = entry.split(":");
      const key = Buffer.from(encoded || "", "base64");
      if (!/^v\d{1,4}$/.test(version) || key.length !== 32) throw new VaultError("configuration");
      return [version, key] as const;
    });
  if (!entries.length) throw new VaultError("configuration");
  return entries;
}

// Binding to owner and provider means a row copied to another account (or provider) fails authentication.
const aad = (owner: string, version: string) => Buffer.from(`iiwi:gemini:${owner}:${version}`);

export function seal(owner: string, plaintext: string): SealedKey {
  const [version, key] = keys()[0];
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce).setAAD(aad(owner, version));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    nonce: nonce.toString("base64"),
    auth_tag: cipher.getAuthTag().toString("base64"),
    key_version: version,
  };
}

export function unseal(owner: string, sealed: SealedKey) {
  const key = new Map(keys()).get(sealed.key_version);
  if (!key) throw new VaultError("undecryptable");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(sealed.nonce, "base64"), {
      authTagLength: 16,
    })
      .setAAD(aad(owner, sealed.key_version))
      .setAuthTag(Buffer.from(sealed.auth_tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(sealed.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new VaultError("undecryptable");
  }
}

export const vaultConfigured = () => {
  try {
    return keys().length > 0;
  } catch {
    return false;
  }
};
