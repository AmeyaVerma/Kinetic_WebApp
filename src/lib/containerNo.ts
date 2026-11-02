/**
 * ISO 6346 container number check.
 *
 * Four letters (owner code plus category letter), six digits, and a check
 * digit that is computed from the first ten characters. A mistyped container
 * number almost always fails the check, which is what makes it worth showing.
 *
 * Letter values skip multiples of 11 (so A=10, B=12, ..., K=21, L=23 ...);
 * each character's value is weighted by 2^position and the sum mod 11 (and mod
 * 10, since 10 reads as 0) is the check digit.
 */

const LETTER_VALUES: Record<string, number> = (() => {
  const out: Record<string, number> = {}
  let value = 10
  for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    if (value % 11 === 0) value += 1
    out[ch] = value
    value += 1
  }
  return out
})()

/** What is wrong with a container number, or null when it is valid. */
export function containerNoProblem(raw: string): string | null {
  const no = raw.replace(/[\s-]/g, '').toUpperCase()
  if (!no) return null
  if (!/^[A-Z]{4}\d{7}$/.test(no)) {
    return 'A container number is four letters then seven digits, for example CSQU3054383.'
  }
  let sum = 0
  for (let i = 0; i < 10; i++) {
    const ch = no[i]
    const v = i < 4 ? LETTER_VALUES[ch] : Number(ch)
    sum += v * 2 ** i
  }
  const check = (sum % 11) % 10
  if (check !== Number(no[10])) {
    return `The check digit does not match (it should be ${check}). This number may be mistyped.`
  }
  return null
}
