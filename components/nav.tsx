"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type Section = "home" | "library" | "hall-of-fame" | "login";

function sectionOf(pathname: string): Section | null {
  if (pathname === "/") return "home";
  if (pathname === "/games" || pathname.startsWith("/games/")) return "library";
  if (pathname.startsWith("/hall-of-fame")) return "hall-of-fame";
  if (pathname.startsWith("/login")) return "login";
  return null;
}

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const section = sectionOf(pathname);
  const activeClass = (s: Section) => (section === s ? "active" : "");
  const close = () => setOpen(false);

  return (
    <>
      <nav className="av-nav">
        <Link href="/" className="logo" onClick={close}>
          <div className="logo-mark" />
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>
        <div className="links">
          <Link href="/" className={activeClass("home")}>
            Home
          </Link>
          <Link href="/games" className={activeClass("library")}>
            Library
          </Link>
          <Link href="/hall-of-fame" className={activeClass("hall-of-fame")}>
            Hall of Fame
          </Link>
        </div>
        <div className="spacer" />
        <div className="coin-counter">
          <span className="coin" />
          <span>CREDITS · 03</span>
        </div>
        <Link href="/login" className="btn auth-btn">
          Sign In
        </Link>
        <button
          type="button"
          className="btn ghost hamburger"
          onClick={() => setOpen(true)}
          aria-label="Menu"
          aria-expanded={open}
        >
          ≡
        </button>
      </nav>

      <div className={"av-mobile-backdrop" + (open ? " open" : "")} onClick={close} />
      <aside className={"av-mobile-panel" + (open ? " open" : "")} aria-hidden={!open} inert={!open}>
        <div className="pixel neon-cyan mb-4 text-[11px]">MENU</div>
        <Link href="/" className={activeClass("home")} onClick={close}>
          Home
        </Link>
        <Link href="/games" className={activeClass("library")} onClick={close}>
          Library
        </Link>
        <Link href="/hall-of-fame" className={activeClass("hall-of-fame")} onClick={close}>
          Hall of Fame
        </Link>
        <Link href="/login" className={activeClass("login")} onClick={close}>
          Sign In
        </Link>
        <div className="flex-1" />
        <div className="pixel text-[9px] tracking-[0.16em] text-ink-faint">CREDITS · 03</div>
      </aside>
    </>
  );
}
