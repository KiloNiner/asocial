/**
 * Minimal RFC 5545 (iCalendar) serializer for all-day events. Pure — no DB,
 * no clock — so it is unit-tested directly.
 */

export type IcsEvent = {
  uid: string;
  /** All-day start, YYYY-MM-DD. */
  start: string;
  /** All-day end, YYYY-MM-DD, exclusive (RFC 5545 DTEND semantics). */
  end: string;
  summary: string;
  description?: string;
  url?: string;
  /** RRULE value without the "RRULE:" prefix, e.g. "FREQ=YEARLY". */
  rrule?: string;
};

export type IcsCalendar = {
  name: string;
  /** Stamped as DTSTAMP on every event. */
  now: Date;
  events: IcsEvent[];
};

/** TEXT value escaping (RFC 5545 §3.3.11). */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

const encoder = new TextEncoder();

/**
 * Folds a content line to at most 75 octets per physical line (§3.1).
 * Splits on code point boundaries so a multi-byte character (emoji, æøå) is
 * never cut in half; continuation lines start with a single space, which
 * counts toward their 75.
 */
export function foldLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;
  let limit = 75;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (currentBytes + bytes > limit) {
      parts.push(current);
      current = "";
      currentBytes = 0;
      limit = 74; // the leading space takes one octet
    }
    current += char;
    currentBytes += bytes;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

function icsDate(date: string): string {
  return date.replaceAll("-", "");
}

function icsTimestamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function buildIcs(calendar: IcsCalendar): string {
  const stamp = icsTimestamp(calendar.now);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//asocial//calendar feed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendar.name)}`,
    // Hints for subscribing clients; most pick their own poll rate anyway.
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
  ];
  for (const event of calendar.events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(event.start)}`,
      `DTEND;VALUE=DATE:${icsDate(event.end)}`,
    );
    if (event.rrule) lines.push(`RRULE:${event.rrule}`);
    lines.push(`SUMMARY:${escapeText(event.summary)}`);
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    }
    if (event.url) lines.push(`URL:${event.url}`);
    // Free, not busy: a nudge shouldn't block anyone's availability.
    lines.push("TRANSP:TRANSPARENT", "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
