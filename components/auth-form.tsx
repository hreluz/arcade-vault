"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";

type Tab = "in" | "up";

export default function AuthForm() {
  const router = useRouter();
  const ids = useId();
  const [tab, setTab] = useState<Tab>("in");
  const [user, setUser] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  // Visual only: no account is created or stored.
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    router.push("/games");
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark" />
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div className="mono mt-1.5 text-[11px] tracking-[0.16em] text-ink-faint">SYSTEM ACCESS · v2.6</div>
        </div>

        <div className="auth-tabs">
          <button type="button" className={tab === "in" ? "on" : ""} aria-pressed={tab === "in"} onClick={() => setTab("in")}>
            SIGN IN
          </button>
          <button type="button" className={tab === "up" ? "on" : ""} aria-pressed={tab === "up"} onClick={() => setTab("up")}>
            CREATE ACCOUNT
          </button>
        </div>

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor={`${ids}-user`}>Username</label>
            <input id={`${ids}-user`} value={user} onChange={(e) => setUser(e.target.value)} placeholder="px_kai" />
          </div>
          {tab === "up" && (
            <div className="field slide-in">
              <label htmlFor={`${ids}-email`}>Email</label>
              <input
                id={`${ids}-email`}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="player@vault.gg"
              />
            </div>
          )}
          <div className="field">
            <label htmlFor={`${ids}-pass`}>Password</label>
            <input
              id={`${ids}-pass`}
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button className="btn lg mt-2 w-full" type="submit">
            {tab === "in" ? "ENTER THE VAULT" : "CREATE AND PLAY"}
          </button>
        </form>

        <Link href="/games" className="btn ghost mt-2.5 w-full">
          PLAY AS GUEST
        </Link>

        <div className="auth-divider">OR CONTINUE WITH</div>
        <div className="social">
          {/* Decorative until OAuth lands in a future spec. */}
          <button className="btn ghost" type="button">
            ◆  GOOGLE
          </button>
          <button className="btn ghost" type="button">
            ▣  GITHUB
          </button>
        </div>

        <div className="mt-[18px] text-center text-[11px] tracking-[0.1em] text-ink-faint">
          BY ENTERING YOU ACCEPT THE ARCADE HALL TERMS
        </div>
      </div>
    </div>
  );
}
