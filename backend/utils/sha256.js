import crypto from 'crypto';
export function hash(str) {
  return crypto.createHash("sha256").update(str).digest("hex");
}