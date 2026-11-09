"use client";

import { useState } from "react";
import { formatUsPhone } from "@/lib/phone";
import type { RideContact } from "@/lib/rides";
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
  const otherNumbers = members
    .filter((member) => !member.is_viewer && member.phone)
    .map((member) => member.phone);

  async function copyNumbers() {
    const numbers = members
      .filter((member) => !member.is_viewer)
      .map((member) => member.phone);
    await navigator.clipboard.writeText(numbers.join(", "));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Passengers</h2>
        <button
          className="min-h-11 rounded-[10px] border border-hairline px-3 text-sm"
          onClick={copyNumbers}
          type="button"
        >
          Copy all numbers
        </button>
      </div>
      {otherNumbers.length >= 2 ? (
        <TextEveryone
          departsAt={departsAt}
          numbers={otherNumbers}
          rideUrl={rideUrl}
          route={route}
        />
      ) : null}
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
