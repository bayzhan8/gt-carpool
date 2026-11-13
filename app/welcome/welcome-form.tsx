"use client";

import { useActionState } from "react";
import { saveProfileAction, type WelcomeState } from "./actions";

type WelcomeFormProps = {
  askGender: boolean;
  next: string;
  initialValues?: {
    first_name: string;
    last_name: string;
    phone: string;
    venmo: string | null;
    gender?: "man" | "woman" | "unspecified" | null;
    show_phone: boolean;
  };
  submitLabel?: string;
  genderLocked?: boolean;
  keepOnPage?: boolean;
};

const initialState: WelcomeState = {};

export function WelcomeForm({
  askGender,
  next,
  initialValues,
  submitLabel = "Continue",
  genderLocked = false,
  keepOnPage = false,
}: WelcomeFormProps) {
  const [state, action, pending] = useActionState(
    saveProfileAction,
    initialState,
  );

  return (
    <form action={action} className="mt-8 space-y-5">
      <input name="next" type="hidden" value={next} />
      <input
        name="keep_on_page"
        type="hidden"
        value={keepOnPage ? "true" : "false"}
      />
      {askGender && genderLocked ? (
        <input
          name="gender"
          type="hidden"
          value={initialValues?.gender ?? ""}
        />
      ) : null}
      {askGender ? (
        <div className="space-y-2">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-muted">Gender</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {(["woman", "man", "unspecified"] as const).map((gender) => (
                <label
                  className={`flex min-h-14 cursor-pointer items-center justify-center rounded-[10px] border border-hairline font-medium has-[:checked]:border-primary has-[:checked]:bg-surface has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${
                    genderLocked ? "cursor-not-allowed opacity-60" : ""
                  }`}
                  key={gender}
                >
                  <input
                    className="sr-only"
                    defaultChecked={
                      (state.values?.gender ?? initialValues?.gender ?? "") ===
                      gender
                    }
                    disabled={genderLocked}
                    name="gender"
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
              Only used to match you with women-only or men-only rides. Never
              shown on your profile or to other riders.
            </p>
            {state.errors?.gender ? (
              <p className="text-sm text-red-700" role="alert">
                {state.errors.gender}
              </p>
            ) : null}
            {genderLocked ? (
              <p className="text-sm text-muted">
                Your group is locked while you are in a restricted upcoming
                ride.
              </p>
            ) : null}
          </fieldset>
        </div>
      ) : null}
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
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
          <input
            className="size-5 accent-primary"
            defaultChecked={
              state.values?.show_phone ?? initialValues?.show_phone ?? true
            }
            name="show_phone"
            type="checkbox"
          />
          Show my phone number to my ride group
        </label>
        <p className="text-sm text-muted">
          When off, riders see your email instead. You can still text them.
        </p>
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
      {state.saved ? (
        <p className="text-sm text-muted" role="status">
          Saved
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
