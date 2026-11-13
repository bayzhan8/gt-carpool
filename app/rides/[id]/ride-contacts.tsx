"use client";

import { useState } from "react";
import { formatUsPhone } from "@/lib/phone";
import type { RideContact } from "@/lib/rides";
import { formatDayHeader, formatTime } from "@/lib/time";
import { TextEveryone } from "./text-everyone";

export function RideContacts({
  members,
  departsAt,
  route,
  rideUrl,
}: {
  members: RideContact[];
  departsAt: string;
  route: string;
  rideUrl: string;
}) {
  const [copied, setCopied] = useState(false);
  const otherMembers = members.filter((member) => !member.is_viewer);
  const otherNumbers = members.flatMap((member) =>
    !member.is_viewer && member.show_phone && member.phone
      ? [member.phone]
      : [],
  );
  const subject = `Carpool ${formatDayHeader(departsAt)} ${formatTime(departsAt)} ${route}`;
  const emailHref = `mailto:${otherMembers.map((member) => member.email).join(",")}?subject=${encodeURIComponent(subject)}`;

  async function copyNumbers() {
    await navigator.clipboard.writeText(otherNumbers.join(", "));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="scroll-mt-20 space-y-4" id="riders">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Passengers</h2>
        {otherNumbers.length > 0 ? (
          <button
            className="min-h-11 rounded-[10px] border border-hairline px-3 text-sm"
            onClick={copyNumbers}
            type="button"
          >
            Copy all numbers
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {otherMembers.length > 0 ? (
          <a
            className="inline-flex min-h-11 items-center rounded-[10px] border border-hairline px-3 text-sm"
            href={emailHref}
          >
            Email everyone
          </a>
        ) : null}
        {otherNumbers.length >= 2 ? (
          <TextEveryone
            departsAt={departsAt}
            numbers={otherNumbers}
            rideUrl={rideUrl}
            route={route}
          />
        ) : null}
      </div>
      {copied ? (
        <p className="text-sm text-muted" role="status">
          Copied
        </p>
      ) : null}
      <ul className="divide-y divide-hairline rounded-[12px] border border-hairline">
        {members.map((member) => (
          <li className="space-y-2 px-4 py-3" key={member.email}>
            <div className="flex flex-wrap items-center gap-2 font-medium">
              <span>{member.name}</span>
              {member.is_owner ? (
                <span className="rounded-full bg-surface px-2 py-1 text-xs">
                  Owner
                </span>
              ) : null}
              {member.is_viewer ? (
                <span className="rounded-full bg-surface px-2 py-1 text-xs">
                  You
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-x-2 gap-y-1 text-sm text-muted">
              {member.phone && (member.is_viewer || member.show_phone) ? (
                <>
                  <a
                    aria-label={`${formatUsPhone(member.phone)}. Text ${member.name}`}
                    className="inline-flex min-h-11 items-center"
                    href={`sms:${member.phone}`}
                  >
                    {formatUsPhone(member.phone)}
                  </a>
                  <a
                    className="inline-flex min-h-11 items-center"
                    href={`tel:${member.phone}`}
                  >
                    Call
                  </a>
                  {member.is_viewer && !member.show_phone ? (
                    <span className="inline-flex min-h-11 items-center">
                      (hidden from others)
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="inline-flex min-h-11 items-center">
                  Number hidden
                </span>
              )}
              <a
                className="inline-flex min-h-11 items-center"
                href={`mailto:${member.email}`}
              >
                {member.email}
              </a>
              {member.venmo ? (
                <a
                  className="inline-flex min-h-11 items-center"
                  href={`https://venmo.com/u/${encodeURIComponent(member.venmo)}`}
                  rel="noopener"
                  target="_blank"
                >
                  @{member.venmo}
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
