export type NormalizedVenmo =
  { ok: true; value: string | null } | { ok: false };

export function normalizeVenmo(raw: string): NormalizedVenmo {
  const handle = raw.trim().replace(/^@/, "");

  if (!handle) {
    return { ok: true, value: null };
  }

  return /^[A-Za-z0-9_-]{5,30}$/.test(handle)
    ? { ok: true, value: handle }
    : { ok: false };
}
