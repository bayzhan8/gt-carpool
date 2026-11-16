export function placeKey(value: string): string {
  return value
    .normalize("NFC")
    .trim()
    .replace(/\s+/gu, " ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
