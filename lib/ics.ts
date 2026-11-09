const CRLF = "\r\n";

export type IcsEvent = {
  uid: string;
  start: string;
  minutes: number;
  summary: string;
  location: string;
  description: string;
  url: string;
};

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

function utcDate(value: Date): string {
  return value
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function foldLine(line: string): string {
  let folded = "";
  let octets = 0;

  for (const character of line) {
    const characterOctets = new TextEncoder().encode(character).length;
    if (octets + characterOctets > 75) {
      folded += `${CRLF} `;
      octets = 1;
    }
    folded += character;
    octets += characterOctets;
  }

  return folded;
}

export function buildIcs({
  uid,
  start,
  minutes,
  summary,
  location,
  description,
  url,
}: IcsEvent): string {
  const startDate = new Date(start);
  const endDate = new Date(startDate.getTime() + minutes * 60_000);
  const timestamp = utcDate(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GT Carpool//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${timestamp}`,
    `DTSTART:${utcDate(startDate)}`,
    `DTEND:${utcDate(endDate)}`,
    `SUMMARY:${escapeText(summary)}`,
    `LOCATION:${escapeText(location)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return `${lines.map(foldLine).join(CRLF)}${CRLF}`;
}
