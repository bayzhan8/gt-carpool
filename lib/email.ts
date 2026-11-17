export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isEmailShaped(raw: string): boolean {
  const email = normalizeEmail(raw);
  const atIndex = email.indexOf("@");

  if (atIndex <= 0 || atIndex !== email.lastIndexOf("@")) {
    return false;
  }

  return atIndex < email.length - 1 && !/\s/.test(email);
}
