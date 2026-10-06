import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Not found · Arcade Vault",
};

export default function NotFound() {
  return (
    <div className="fade-in">
      <section className="av-hero pb-20">
        <h1 className="flicker">404</h1>
        <div className="sub">
          GAME NOT FOUND <span className="blink">_</span>
        </div>
        <p className="mx-auto mt-6 mb-8 max-w-[44ch] text-ink-dim">
          This cartridge isn&apos;t in the vault. Check the address or pick a game from the library.
        </p>
        <Link href="/games" className="btn lg">
          BACK TO LIBRARY
        </Link>
      </section>
    </div>
  );
}
