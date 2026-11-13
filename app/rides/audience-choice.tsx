"use client";

import { useState } from "react";
import type { Gender } from "@/lib/auth";
import type { RideAudience } from "@/lib/rides";
import { GenderSheet } from "@/app/components/gender-sheet";

export function AudienceChoice({
  ownerGender,
  value,
  onChange,
}: {
  ownerGender: Gender | null;
  value: RideAudience;
  onChange: (value: RideAudience) => void;
}) {
  const [gender, setGender] = useState<Gender | null>(ownerGender);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingAudience, setPendingAudience] = useState<Exclude<
    RideAudience,
    "anyone"
  > | null>(null);
  const [mismatch, setMismatch] = useState("");
  const ownAudience: Exclude<RideAudience, "anyone"> | null =
    gender === "woman" ? "women" : gender === "man" ? "men" : null;
  const restrictedAudiences: Exclude<RideAudience, "anyone">[] = ownAudience
    ? [ownAudience]
    : gender === null
      ? ["women", "men"]
      : [];
  const options: {
    value: RideAudience;
    label: string;
    hint: string;
    selected: string;
  }[] = [
    {
      value: "anyone" as const,
      label: "Anyone",
      hint: "Any GT student can join.",
      selected: "border-primary bg-surface",
    },
    ...restrictedAudiences.map((audience) => ({
      value: audience,
      label: audience === "women" ? "Women only" : "Men only",
      hint: `Only ${audience} can see and join this ride.`,
      selected:
        audience === "women"
          ? "border-pink-400 bg-pink-50"
          : "border-sky-400 bg-sky-50",
    })),
  ];

  function selectAudience(audience: RideAudience) {
    setMismatch("");
    if (audience === "anyone" || ownerGender !== null || gender !== null) {
      onChange(audience);
      return;
    }
    setPendingAudience(audience);
    setSheetOpen(true);
  }

  function saveGender(saved: Gender) {
    setGender(saved);
    setSheetOpen(false);
    const matches =
      (pendingAudience === "women" && saved === "woman") ||
      (pendingAudience === "men" && saved === "man");
    if (matches && pendingAudience) {
      onChange(pendingAudience);
    } else {
      onChange("anyone");
      setMismatch(
        pendingAudience === "women"
          ? "Women-only rides can only be posted by women."
          : "Men-only rides can only be posted by men.",
      );
    }
    setPendingAudience(null);
  }

  return (
    <>
      <fieldset className="space-y-2">
        <legend className="mb-2 block text-sm font-medium text-muted">
          Who can join?
        </legend>
        <div
          className={`grid gap-3 ${
            options.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2"
          }`}
        >
          {options.map((option) => {
            const checked = value === option.value;
            return (
              <label
                className={`flex min-h-16 cursor-pointer flex-col justify-center gap-1 rounded-[10px] border px-3 py-3 ${
                  checked ? option.selected : "border-hairline"
                }`}
                key={option.value}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <input
                    checked={checked}
                    className="size-4 accent-primary"
                    name="audience"
                    onChange={() => selectAudience(option.value)}
                    onClick={() => {
                      if (
                        checked &&
                        ownerGender === null &&
                        option.value !== "anyone"
                      ) {
                        selectAudience(option.value);
                      }
                    }}
                    type="radio"
                    value={option.value}
                  />
                  {option.label}
                </span>
                <span className="text-xs text-muted">{option.hint}</span>
              </label>
            );
          })}
        </div>
        {mismatch ? (
          <p className="text-sm text-red-700" role="alert">
            {mismatch}
          </p>
        ) : null}
      </fieldset>
      <GenderSheet
        onClose={() => {
          setSheetOpen(false);
          onChange("anyone");
          setPendingAudience(null);
        }}
        onSaved={saveGender}
        open={sheetOpen}
      />
    </>
  );
}
