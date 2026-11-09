export function groupSmsHref(
  numbers: string[],
  body: string,
  ua: string,
): string {
  const addresses = numbers.join(",");
  const encodedBody = encodeURIComponent(body);
  return /iPhone|iPad|iPod/.test(ua)
    ? `sms://open?addresses=${addresses}&body=${encodedBody}`
    : `sms:${addresses}?body=${encodedBody}`;
}
