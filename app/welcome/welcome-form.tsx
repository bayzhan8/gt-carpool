"use client";

import { useActionState } from "react";
import { saveProfileAction, type WelcomeState } from "./actions";

type WelcomeFormProps = {
  next: string;
  initialValues?: {
    first_name: string;
    last_name: string;
    phone: string;
    venmo: string | null;
    gender?: "man" | "woman" | "unspecified" | null;
  };
  submitLabel?: string;
  genderLocked?: boolean;
};

const initialState: WelcomeState = {};

export function WelcomeForm({
  next,
  initialValues,
  submitLabel = "Continue",
  genderLocked = false,
}: WelcomeFormProps) {
  const [state, action, pending] = useActionState(
    saveProfileAction,
    initialState,
  );

  return (
    <form action={action} className="mt-8 space-y-5">
      <input name="next" type="hidden" value={next} />
      {genderLocked ? (
        <input
          name="gender"
          type="hidden"
          value={initialValues?.gender ?? ""}
        />
      ) : null}
      <div className="space-y-2">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-muted">
            Which describes you?
          </legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {(["woman", "man", "unspecified"] as const).map((gender) => (
              <label
                className={`flex min-h-14 cursor-pointer items-center justify-center rounded-[10px] border font-medium ${
                  (state.values?.gender ?? initialValues?.gender) === gender
                    ? "border-primary bg-surface"
                    : "border-hairline"
                } ${genderLocked ? "cursor-not-allowed opacity-60" : ""}`}
                key={gender}
              >
                <input
                  className="sr-only"
                  defaultChecked={
                    (state.values?.gender ?? initialValues?.gender) === gender
                  }
                  disabled={genderLocked}
                  name="gender"
                  required
                  type="radio"
                  value={gender}
                />
                {gender === "woman"
                  ? "Woman"
                  : gender === "man"
                    ? "Man"
                    : "Prefer not to say"}
              </label>
            ))}
          </div>
          <p className="text-sm text-muted">
            Lets riders offer women-only or men-only rides.
          </p>
          {state.errors?.gender ? (
            <p className="text-sm text-red-700" role="alert">
              {state.errors.gender}
            </p>
          ) : null}
          {genderLocked ? (
            <p className="text-sm text-muted">
              Your group is locked while you are in a restricted upcoming ride.
            </p>
          ) : null}
        </fieldset>
      </div>
      <div className="space-y-2">
        <label
          className="block text-sm font-medium text-muted"
          htmlFor="first_name"
        >
          First name
        </label>
        <input
          autoComplete="given-name"
          className="min-h-11 w-full rounded-[10px] border border-hairline px-3 text-base focus-visible:border-accent"
          defaultValue={
            state.values?.first_name ?? initialValues?.first_name ?? ""
          }
          id="first_name"
          maxLength={40}
          name="first_name"
          required
        />
        {state.errors?.first_name ? (
          <p className="text-sm text-red-700" role="alert">
            {state.errors.first_name}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <label
          className="block text-sm font-medium text-muted"
          htmlFor="last_name"
        >
          Last name
        </label>
        <input
          autoComplete="family-name"
          className="min-h-11 w-full rounded-[10px] border border-hairline px-3 text-base focus-visible:border-accent"
          defaultValue={
            state.values?.last_name ?? initialValues?.last_name ?? ""
          }
          id="last_name"
          maxLength={40}
          name="last_name"
          required
        />
        {state.errors?.last_name ? (
          <p className="text-sm text-red-700" role="alert">
            {state.errors.last_name}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-muted" htmlFor="phone">
          Phone
        </label>
        <input
          autoComplete="tel-national"
          className="min-h-11 w-full rounded-[10px] border border-hairline px-3 text-base focus-visible:border-accent"
          defaultValue={state.values?.phone ?? initialValues?.phone ?? ""}
          id="phone"
          name="phone"
          required
          type="tel"
        />
        {state.errors?.phone ? (
          <p className="text-sm text-red-700" role="alert">
            {state.errors.phone}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-muted" htmlFor="venmo">
          Venmo <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          autoComplete="off"
          className="min-h-11 w-full rounded-[10px] border border-hairline px-3 text-base focus-visible:border-accent"
          defaultValue={state.values?.venmo ?? initialValues?.venmo ?? ""}
          id="venmo"
          name="venmo"
          placeholder="@handle"
        />
        {state.errors?.venmo ? (
          <p className="text-sm text-red-700" role="alert">
            {state.errors.venmo}
          </p>
        ) : null}
      </div>
      {state.errors?.form ? (
        <p className="text-sm text-red-700" role="alert">
          {state.errors.form}
        </p>
      ) : null}
      <button
        className="min-h-11 w-full rounded-[10px] bg-primary px-4 font-medium text-white disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
