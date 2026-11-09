export function safeNextPath(raw: string | null | undefined): string {
  if (
    typeof raw !== "string" ||
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    raw.includes("\\") ||
    /[\u0000-\u001f\u007f-\u009f]|\s/u.test(raw)
  ) {
    return "/";
  }

  try {
    return new URL(raw, "http://x").origin === "http://x" ? raw : "/";
  } catch {
    return "/";
  }
}
