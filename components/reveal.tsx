"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// A <section> (or <div>) that starts hidden (.reveal) and fades in (.in) the first time it enters the viewport.
export default function Reveal({
  as: Tag = "section",
  className = "",
  children,
}: {
  as?: "section" | "div";
  className?: string;
  children: ReactNode;
}) {
  // HTMLDivElement satisfies both the <section> and <div> ref types.
  const ref = useRef<HTMLDivElement>(null);
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
    <Tag ref={ref} className={"reveal " + className + (visible ? " in" : "")}>
      {children}
    </Tag>
  );
}
