"use client";

import { useSyncExternalStore } from "react";
import { groupSmsHref } from "@/lib/group-sms";
import { formatDayHeader, formatTime } from "@/lib/time";

const subscribe = () => () => {};

export function TextEveryone({
  numbers,
  departsAt,
  route,
  rideUrl,
}: {
  numbers: string[];
  departsAt: string;
  route: string;
  rideUrl: string;
}) {
  const userAgent = useSyncExternalStore(
    subscribe,
    () => navigator.userAgent,
    () => "",
  );

  const body = `Hey! Carpool for ${formatDayHeader(departsAt)} ${formatTime(departsAt)} <${route}>: ${rideUrl}`;
  const href = groupSmsHref(numbers, body, userAgent);

  return (
    <a
      className="inline-flex min-h-11 items-center rounded-[10px] border border-hairline px-3 text-sm"
      href={href}
    >
      Text everyone
    </a>
  );
}
