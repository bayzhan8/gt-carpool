"use client";

import { useEffect, useState, type CSSProperties } from "react";
import "./celebration.css";

type CelebrationKind = "posted" | "joined";

const confettiDestinations = [
  [-160, -36],
  [-150, -88],
  [-140, -8],
  [-128, 34],
  [-116, -56],
  [-104, 10],
  [-92, -90],
  [-80, -22],
  [-68, 40],
  [-56, -68],
  [-44, 18],
  [-32, -42],
  [32, -28],
  [44, -84],
  [56, 30],
  [68, -56],
  [80, 8],
  [92, -90],
  [104, 38],
  [116, -36],
  [128, -72],
  [140, 16],
  [150, -48],
  [160, 40],
] as const;
const confettiColors = ["#B3A369", "#003057", "#F472B6", "#60A5FA"] as const;
const confettiPieces = confettiDestinations.map(([x, peakY], index) => ({
  x: `${x}px`,
  peakY: `${peakY}px`,
  endY: `${peakY + 40}px`,
  rotation: `${(index * 47) % 360}deg`,
  delay: `${(index % 7) * 20}ms`,
  color: confettiColors[index % confettiColors.length],
}));

export function Celebration({
  kind,
  calendarHref,
  hasRiders,
}: {
  kind: CelebrationKind;
  calendarHref: string;
  hasRiders: boolean;
}) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("welcome");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, []);

  if (dismissed) return null;

  const posted = kind === "posted";

  return (
    <section className="celebration-card relative overflow-hidden rounded-[12px] border border-hairline bg-surface p-4 sm:p-5">
      <div aria-hidden="true" className="celebration-confetti">
        {confettiPieces.map((piece, index) => (
          <span
            className="celebration-confetti__piece"
            key={index}
            style={
              {
                "--confetti-x": piece.x,
                "--confetti-peak-y": piece.peakY,
                "--confetti-end-y": piece.endY,
                "--confetti-rotation": piece.rotation,
                "--confetti-delay": piece.delay,
                "--confetti-color": piece.color,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <button
        aria-label="Dismiss"
        className="absolute top-1 right-1 z-20 flex size-11 items-center justify-center rounded-full text-xl text-muted hover:bg-white"
        onClick={() => setDismissed(true)}
        type="button"
      >
        ×
      </button>
      <div className="relative z-10 pr-9" role="status">
        <h2 className="celebration-heading text-lg font-semibold">
          <span aria-hidden="true" className="celebration-check">
            <svg
              aria-hidden="true"
              className="size-4"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                d="m5 12 4 4L19 6"
                stroke="white"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
              />
            </svg>
          </span>
          {posted ? "Your ride is up!" : "You're in!"}
        </h2>
        <p className="celebration-copy mt-1 text-sm">
          {posted
            ? "We'll email you when someone joins. Save the date now, and text your riders once they join to set up a group chat."
            : "Save the date, then text your riders now to start a group chat and agree where to meet before the ride."}
        </p>
      </div>
      <div className="relative z-10 mt-4 flex flex-wrap gap-2">
        <a
          className="inline-flex min-h-11 items-center justify-center rounded-[10px] bg-primary px-4 text-sm font-medium text-white"
          href={calendarHref}
        >
          Save the date
        </a>
        {!posted && hasRiders ? (
          <a
            className="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-hairline bg-white px-4 text-sm font-medium"
            href="#riders"
          >
            Message riders
          </a>
        ) : null}
      </div>
    </section>
  );
}
