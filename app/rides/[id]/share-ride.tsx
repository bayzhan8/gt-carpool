"use client";

import { useState } from "react";

export function ShareRide({ title }: { title: string }) {
  const [status, setStatus] = useState("");

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    setStatus("Link copied");
  }

  return (
    <>
      <button
        className="min-h-11 rounded-[10px] border border-hairline px-4 text-sm font-medium"
        onClick={share}
        type="button"
      >
        Share
      </button>
      <span aria-live="polite" className="text-sm text-muted">
        {status}
      </span>
    </>
  );
}
