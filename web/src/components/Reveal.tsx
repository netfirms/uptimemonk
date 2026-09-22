"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

/**
 * Reveals its children when they scroll into view.
 *
 * One observer per element rather than a scroll listener: the browser does the
 * intersection maths off the main thread, so a page with a dozen of these
 * still scrolls at full rate.
 *
 * It unobserves after the first reveal. Content that fades out again when you
 * scroll back up reads as a rendering bug, not as polish.
 *
 * The hidden state lives in CSS under `.js-ready` (set before first paint in
 * the layout), so if scripting is unavailable the content is simply visible
 * and nothing here runs.
 */
export default function Reveal({
  children,
  as: Tag = "div",
  stagger = false,
  delay = 0,
  className = "",
  /** Reveal slightly before the element's top edge enters the viewport. */
  rootMargin = "0px 0px -12% 0px",
}: {
  children: ReactNode;
  as?: ElementType;
  stagger?: boolean;
  delay?: number;
  className?: string;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Anything already on screen at mount should not wait for a scroll that
    // may never come — above-the-fold content would sit invisible.
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin, threshold: 0.05 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  const classes = [
    stagger ? "reveal-stagger" : "reveal",
    visible ? "is-visible" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Tag
      ref={ref}
      className={classes}
      style={delay ? ({ "--reveal-delay": `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}
