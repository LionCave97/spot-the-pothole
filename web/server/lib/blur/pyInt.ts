/** Match Python 3 `int(x)` (truncate toward zero). */
export function pyInt(value: number): number {
  return Math.trunc(value)
}
