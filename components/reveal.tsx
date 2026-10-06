"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// A <section> that starts hidden (.reveal) and fades in (.in) the first time it enters the viewport.
export default function Reveal({ className = "", children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={ref} className={"reveal " + className + (visible ? " in" : "")}>
      {children}
    </section>
  );
}
