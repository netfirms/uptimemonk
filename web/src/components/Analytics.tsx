"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { initAnalytics } from "@/lib/firebase";
import { trackPageView } from "@/lib/analytics";

/**
 * Starts Firebase Analytics after hydration and reports page views.
 *
 * A client component rather than a call in the layout because the root layout
 * is a server component: this site is a static export, so anything at module
 * scope there runs in Node at build time, where `window` does not exist and
 * `getAnalytics()` throws.
 *
 * Renders nothing and never throws — measurement must not be able to take the
 * page down with it.
 */
function Tracker() {
  const pathname = usePathname();
  const search = useSearchParams();

  useEffect(() => {
    void initAnalytics();
  }, []);

  useEffect(() => {
    if (!pathname) return;
    const qs = search?.toString();
    trackPageView(qs ? `${pathname}?${qs}` : pathname);
  }, [pathname, search]);

  return null;
}

export default function Analytics() {
  // useSearchParams needs a Suspense boundary during prerender, and without
  // one the whole route opts out of static generation.
  return (
    <Suspense fallback={null}>
      <Tracker />
    </Suspense>
  );
}
