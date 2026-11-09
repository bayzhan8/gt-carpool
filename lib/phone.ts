export function normalizeUsPhone(raw: string): string | null {
  let digits = raw.replace(/[ \-.()]/g, "");

  if (digits.startsWith("+1")) {
    digits = digits.slice(2);
  } else if (digits.startsWith("1")) {
    digits = digits.slice(1);
  }

  return /^[2-9]\d{2}[2-9]\d{6}$/.test(digits) ? `+1${digits}` : null;
}
