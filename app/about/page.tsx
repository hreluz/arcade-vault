import type { Metadata } from "next";
import HighlightIcon, { type HighlightIconKind } from "@/components/highlight-icon";
import Reveal from "@/components/reveal";

export const metadata: Metadata = {
  title: "About · Arcade Vault",
};

const HIGHLIGHTS: { icon: HighlightIconKind; text: string; color: "magenta" | "cyan" | "green" }[] = [
  { icon: "HEART", text: "MADE WITH ❤️ FOR PLAYERS", color: "magenta" },
  { icon: "BROWSER", text: "HTML GAMES — RUN IN ANY BROWSER", color: "cyan" },
  { icon: "PLANT", text: "A PROJECT THAT KEEPS GROWING", color: "green" },
];

export default function AboutPage() {
  return (
    <div className="about fade-in">
      {/* ABOUT */}
      <section className="about-hero">
        <div className="kicker pixel neon-yellow">▸ ABOUT</div>
        <h1 className="about-title">ABOUT ARCADE VAULT</h1>
        <p className="about-mission">
          ARCADE VAULT was born from a love of classic video games. Our mission is to preserve and celebrate the
          arcades that defined a generation, making them accessible to everyone, anywhere, at no cost.
        </p>

        <div className="highlight-row">
          {HIGHLIGHTS.map((h, i) => (
            <div key={h.icon} className={"highlight " + h.color} style={{ transitionDelay: i * 80 + "ms" }}>
              <HighlightIcon kind={h.icon} />
              <div className="hl-text pixel">{h.text}</div>
            </div>
          ))}
        </div>
      </section>

      {/* divider banner */}
      <Reveal as="div" className="about-divider">
        <div className="div-bar" aria-hidden="true" />
        <div className="div-pixels" aria-hidden="true">
          {Array.from({ length: 24 }).map((_, i) => (
            <span key={i} style={{ animationDelay: i * 80 + "ms" }} />
          ))}
        </div>
        <div className="div-bar" aria-hidden="true" />
      </Reveal>

      {/* CONTACT */}
      <Reveal className="about-contact">
        <div className="contact-grid">
          <div className="contact-intro">
            <div className="kicker pixel neon-cyan">▸ CONTACT</div>
            <h2 className="contact-title">CONTACT US</h2>
            <p className="contact-sub">
              Got a suggestion, want to propose a game, or just want to say hi? Write to us.
            </p>
            <div className="contact-tips">
              <div className="tip">
                <span className="tip-led" />
                REPLY IN 24-48H
              </div>
              <div className="tip">
                <span className="tip-led y" />
                SUGGESTIONS WELCOME
              </div>
              <div className="tip">
                <span className="tip-led m" />
                NO SPAM, EVER
              </div>
            </div>
          </div>

          {/* Placeholder until <ContactForm /> lands in step 7 */}
          <div className="contact-form" />
        </div>
      </Reveal>
    </div>
  );
}
