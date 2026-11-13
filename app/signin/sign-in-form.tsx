"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { isDemoEmail } from "@/lib/demo";
import { authErrorCopy } from "@/lib/errors";
import { isGatechEmail, normalizeEmail } from "@/lib/email";
import { createClient } from "@/lib/supabase/client";
import { verifyOtpAction } from "./actions";

type SignInFormProps = {
  next: string;
};

export function SignInForm({ next }: SignInFormProps) {
  const [email, setEmail] = useState("");
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [sendError, setSendError] = useState("");
  const [resendError, setResendError] = useState("");
  const [sending, setSending] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (resendAt === null) {
      return;
    }

    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [resendAt]);

  const secondsLeft =
    resendAt === null ? 0 : Math.max(0, Math.ceil((resendAt - now) / 1000));

  async function requestCode(address: string): Promise<string | null> {
    const { error } = await createClient().auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: true },
    });

    return error ? authErrorCopy(error) : null;
  }

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSendError("");

    if (!isGatechEmail(email)) {
      setSendError("Use your @gatech.edu email.");
      return;
    }

    const normalizedEmail = normalizeEmail(email);
    if (isDemoEmail(normalizedEmail)) {
      setSendError("Demo accounts cannot receive sign-in codes.");
      return;
    }

    setSending(true);
    const error = await requestCode(normalizedEmail);
    setSending(false);

    if (error) {
      setSendError(error);
      return;
    }

    setEmail(normalizedEmail);
    setSentEmail(normalizedEmail);
    setResendError("");
    setNow(Date.now());
    setResendAt(Date.now() + 30_000);
  }

  async function resendCode() {
    if (!sentEmail || secondsLeft > 0 || resending) {
      return;
    }

    setResendError("");
    setResending(true);
    const error = await requestCode(sentEmail);
    setResending(false);

    if (error) {
      setResendError(error);
      return;
    }

    setNow(Date.now());
    setResendAt(Date.now() + 30_000);
  }

  function useDifferentEmail() {
    setSentEmail(null);
    setSendError("");
    setResendError("");
  }

  if (sentEmail) {
    return (
      <VerifyCodeForm
        key={sentEmail}
        email={sentEmail}
        next={next}
        onUseDifferentEmail={useDifferentEmail}
        onResend={resendCode}
        resendDisabled={secondsLeft > 0 || resending}
        resendLabel={
          resending
            ? "Sending…"
            : secondsLeft > 0
              ? `Resend in ${secondsLeft}s`
              : "Resend code"
        }
        resendError={resendError}
      />
    );
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={sendCode}>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-muted" htmlFor="email">
          Georgia Tech email
        </label>
        <input
          autoCapitalize="none"
          autoComplete="email"
          className="min-h-11 w-full rounded-[10px] border border-hairline px-3 text-base focus-visible:border-accent"
          id="email"
          inputMode="email"
          name="email"
          onBlur={() => {
            if (email.trim() && email.includes("@") && !isGatechEmail(email)) {
              setSendError("Use your @gatech.edu email.");
            }
          }}
          onChange={(event) => {
            setEmail(event.target.value);
            if (sendError) setSendError("");
          }}
          placeholder="gburdell3@gatech.edu"
          required
          spellCheck={false}
          type="email"
          value={email}
        />
        {sendError ? (
          <p className="text-sm text-red-700" role="alert">
            {sendError}
          </p>
        ) : null}
      </div>
      <button
        className="min-h-11 w-full rounded-[10px] bg-primary px-4 font-medium text-white disabled:opacity-60"
        disabled={sending}
        type="submit"
      >
        {sending ? "Sending…" : "Send code"}
      </button>
    </form>
  );
}

type VerifyCodeFormProps = {
  email: string;
  next: string;
  onUseDifferentEmail: () => void;
  onResend: () => void;
  resendDisabled: boolean;
  resendLabel: string;
  resendError: string;
};

function VerifyCodeForm({
  email,
  next,
  onUseDifferentEmail,
  onResend,
  resendDisabled,
  resendLabel,
  resendError,
}: VerifyCodeFormProps) {
  const [state, action, pending] = useActionState(verifyOtpAction, {});
  const [token, setToken] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const autoSubmitted = useRef(false);

  useEffect(() => {
    if (token.length !== 6 || autoSubmitted.current || pending) {
      return;
    }

    autoSubmitted.current = true;
    formRef.current?.requestSubmit();
  }, [pending, token]);

  return (
    <div className="mt-8 space-y-5">
      <p className="text-sm text-muted" role="status">
        We sent a 6-digit code to <span className="text-text">{email}</span>
      </p>
      <form action={action} className="space-y-5" ref={formRef}>
        <input name="email" type="hidden" value={email} />
        <input name="next" type="hidden" value={next} />
        <div className="space-y-2">
          <p className="text-sm text-muted">
            Can&apos;t find the code? Check your Junk folder.
          </p>
          <label
            className="block text-sm font-medium text-muted"
            htmlFor="token"
          >
            Code
          </label>
          <input
            autoComplete="one-time-code"
            autoFocus
            className="min-h-11 w-full rounded-[10px] border border-hairline px-3 text-base tracking-[0.2em] focus-visible:border-accent"
            id="token"
            inputMode="numeric"
            name="token"
            onChange={(event) => {
              const digits = event.target.value.replace(/\D/g, "").slice(0, 6);
              event.target.value = digits;
              if (digits !== token) autoSubmitted.current = false;
              setToken(digits);
            }}
            pattern="\d{6}"
            required
            type="text"
            value={token}
            disabled={pending}
          />
          {state.error ? (
            <p className="text-sm text-red-700" role="alert">
              {state.error}
            </p>
          ) : null}
          {resendError ? (
            <p className="text-sm text-red-700" role="alert">
              {resendError}
            </p>
          ) : null}
        </div>
        <button
          className="min-h-11 w-full rounded-[10px] bg-primary px-4 font-medium text-white disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? "Checking…" : "Verify code"}
        </button>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <button
          className="min-h-11 text-muted underline underline-offset-4 hover:text-text"
          onClick={onUseDifferentEmail}
          type="button"
        >
          Use a different email
        </button>
        <button
          className="min-h-11 text-muted underline underline-offset-4 hover:text-text disabled:no-underline disabled:opacity-60"
          disabled={resendDisabled}
          onClick={onResend}
          type="button"
        >
          {resendLabel}
        </button>
      </div>
    </div>
  );
}
