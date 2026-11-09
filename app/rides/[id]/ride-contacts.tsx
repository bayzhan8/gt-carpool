"use client";

import { useState } from "react";
import { formatUsPhone } from "@/lib/phone";
import type { RideContact } from "@/lib/rides";

export function RideContacts({ members }: { members: RideContact[] }) {
  const [copied, setCopied] = useState(false);

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
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted">
              <a href={`sms:${member.phone}`}>{formatUsPhone(member.phone)}</a>
              <a href={`tel:${member.phone}`}>Call</a>
              <a href={`mailto:${member.email}`}>{member.email}</a>
              {member.venmo ? (
                <a
                  href={`https://venmo.com/u/${encodeURIComponent(member.venmo)}`}
                  rel="noopener"
                  target="_blank"
                >
                  Venmo
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
