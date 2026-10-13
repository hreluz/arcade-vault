import type { Metadata } from "next";
import LibraryBrowser from "@/components/library-browser";
import { getGames } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Library · Arcade Vault",
};

export default async function LibraryPage() {
  const games = await getGames();

  return (
    <div className="fade-in">
      <section className="av-hero">
        <h1 className="flicker">ARCADE VAULT</h1>
        <div className="sub">
          INSERT COIN TO PLAY <span className="blink">_</span>
        </div>
      </section>
      <LibraryBrowser games={games} />
    </div>
  );
}
