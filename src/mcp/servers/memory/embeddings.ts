import crypto from "node:crypto"

/**
 * Детерминированный embedding:
 * одинаковый текст -> одинаковый вектор
 * разный текст -> другой, но стабильный вектор
 */
export async function embed(text: string): Promise<number[]> {
  const hash = crypto.createHash("sha256").update(text).digest()

  const vector = Array.from({ length: 384 }, (_, i) => {
    return hash[i % hash.length] / 255
  })

  return vector
}
