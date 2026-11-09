export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isGatechEmail(raw: string): boolean {
  const email = normalizeEmail(raw);
  const atIndex = email.indexOf("@");

  if (atIndex <= 0 || atIndex !== email.lastIndexOf("@")) {
    return false;
  }

  const localPart = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);

  if (!localPart || /\s/.test(localPart)) {
    return false;
  }

  if (domain === "gatech.edu") {
    return true;
  }

  return (
    domain.endsWith(".gatech.edu") &&
    domain.split(".").every((label) => /^[a-z0-9-]+$/.test(label))
  );
}
