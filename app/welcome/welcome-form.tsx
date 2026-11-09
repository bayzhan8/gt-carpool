"use client";

import { useActionState } from "react";
import { saveProfileAction, type WelcomeState } from "./actions";

type WelcomeFormProps = {
  next: string;
  initialValues?: {
    first_name: string;
    last_name: string;
    phone: string;
    venmo: string;
  };
  submitLabel?: string;
};

const initialState: WelcomeState = {};

export function WelcomeForm({
  next,
  initialValues,
  submitLabel = "Continue",
}: WelcomeFormProps) {
  const [state, action, pending] = useActionState(
    saveProfileAction,
    initialState,
  );

  return (
    <form action={action} className="mt-8 space-y-5">
      <input name="next" type="hidden" value={next} />
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
