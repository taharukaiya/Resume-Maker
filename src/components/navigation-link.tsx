"use client";

import Link, { useLinkStatus } from "next/link";
import { useState, type ComponentProps } from "react";

function NavigationFeedback() {
  const { pending } = useLinkStatus();
  return pending ? (
    <span className="navigation-pending" role="status">
      <span className="sr-only">Opening page…</span>
    </span>
  ) : null;
}

// Prefetch the small workspace pages. For potentially large lists of editor
// links, only fetch the full route after pointer, keyboard, or touch intent.
// Page data still comes from authenticated API requests on each visit.
export function NavigationLink({
  children,
  className = "",
  prefetchOnIntent = false,
  onMouseEnter,
  onFocus,
  onTouchStart,
  ...props
}: Omit<ComponentProps<typeof Link>, "prefetch"> & {
  prefetchOnIntent?: boolean;
}) {
  const [intent, setIntent] = useState(false);
  return (
    <Link
      {...props}
      className={`navigation-link ${className}`}
      prefetch={prefetchOnIntent && !intent ? null : true}
      onMouseEnter={(event) => {
        setIntent(true);
        onMouseEnter?.(event);
      }}
      onFocus={(event) => {
        setIntent(true);
        onFocus?.(event);
      }}
      onTouchStart={(event) => {
        setIntent(true);
        onTouchStart?.(event);
      }}
    >
      {children}
      <NavigationFeedback />
    </Link>
  );
}
