import "server-only";
import { randomInt } from "crypto";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";

/** Generates a random credential password using a CSPRNG (not Math.random). */
export function generatePassword(length = 16): string {
  let out = "";
  for (let i = 0; i < length; i++) out += CHARS[randomInt(CHARS.length)];
  return out;
}
