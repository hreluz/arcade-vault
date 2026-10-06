"use client";

import { useActionState, useId, useRef, useState, type FormEvent } from "react";
import { sendContactMessage } from "@/app/about/actions";
import { CONTACT_LIMITS, validateContact, type ContactState } from "@/lib/contact";

const ERROR_TEXT: Record<Extract<ContactState, { status: "error" }>["reason"], string> = {
  invalid: "CHECK THE FIELDS AND TRY AGAIN.",
  "rate-limited": "TOO MANY MESSAGES. WAIT A FEW MINUTES.",
  "send-failed": "TRANSMISSION FAILED. TRY AGAIN.",
};

const INITIAL_STATE: ContactState = { status: "idle" };

// Remounting the inner form with a new key is how "SEND ANOTHER MESSAGE" resets the action state.
export default function ContactForm() {
  const [round, setRound] = useState(0);
  return <ContactFormRound key={round} onReset={() => setRound((r) => r + 1)} />;
}

function ContactFormRound({ onReset }: { onReset: () => void }) {
  const id = useId();
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [shake, setShake] = useState(false);
  const shakeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const triggerShake = () => {
    clearTimeout(shakeTimer.current);
    setShake(true);
    shakeTimer.current = setTimeout(() => setShake(false), 400);
  };

  const [state, formAction, pending] = useActionState(async (prev: ContactState, formData: FormData) => {
    const next = await sendContactMessage(prev, formData);
    if (next.status === "error") triggerShake();
    return next;
  }, INITIAL_STATE);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (Object.keys(validateContact(form)).length > 0) {
      e.preventDefault();
      triggerShake();
    }
  };

  return (
    <form className={"contact-form" + (shake ? " shake" : "")} action={formAction} onSubmit={onSubmit} noValidate>
      {state.status !== "success" ? (
        <>
          <div className="field">
            <label htmlFor={id + "-name"}>NAME</label>
            <input
              id={id + "-name"}
              name="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="px_kai"
              maxLength={CONTACT_LIMITS.name}
              disabled={pending}
            />
          </div>
          <div className="field">
            <label htmlFor={id + "-email"}>EMAIL</label>
            <input
              id={id + "-email"}
              name="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="player@vault.gg"
              maxLength={CONTACT_LIMITS.email}
              disabled={pending}
            />
          </div>
          <div className="field">
            <label htmlFor={id + "-message"}>MESSAGE</label>
            <textarea
              id={id + "-message"}
              name="message"
              rows={5}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Tell us what's on your mind…"
              maxLength={CONTACT_LIMITS.message}
              disabled={pending}
            />
          </div>

          {/* Honeypot: humans never see or reach it; bots that fill it get a fake success. */}
          <div className="hp-field" aria-hidden="true">
            <input name="company" tabIndex={-1} autoComplete="off" defaultValue="" />
          </div>

          {state.status === "error" && !pending && (
            <div className="contact-error" role="alert">
              {ERROR_TEXT[state.reason]}
            </div>
          )}

          <button className="btn xl press" type="submit" style={{ width: "100%" }} disabled={pending}>
            {pending ? "▶  TRANSMITTING…" : "▶  SEND MESSAGE"}
          </button>
        </>
      ) : (
        <div className="terminal-success">
          <div className="term-bar">
            <span className="dot r" />
            <span className="dot y" />
            <span className="dot g" />
            <span className="term-title">VAULT-OS // TERMINAL</span>
          </div>
          <div className="term-body" role="status">
            <div className="line">
              <span className="prompt">vault@arcade:~$</span> ./send_message --to=team
            </div>
            <div className="line dim">[OK] Connecting to server…</div>
            <div className="line dim">[OK] Validating content…</div>
            <div className="line dim">[OK] Transmitting packet…</div>
            <div className="line success">
              &gt; MESSAGE RECEIVED. WE&apos;LL GET BACK TO YOU SOON. THANKS, {state.name.toUpperCase()}.
              <span className="caret">_</span>
            </div>
            <div style={{ marginTop: 18 }}>
              <button className="btn ghost" type="button" onClick={onReset}>
                SEND ANOTHER MESSAGE
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
