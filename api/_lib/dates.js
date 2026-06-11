// JSON bodies carry dates as strings (often yyyy-mm-dd from <input type="date">).
// Prisma DateTime columns need Date objects; empty strings mean "not set".
export function coerceDates(body, keys) {
  const out = { ...body }
  for (const key of keys) {
    if (out[key] === '' || out[key] == null) {
      delete out[key]
      continue
    }
    out[key] = new Date(out[key])
  }
  return out
}
