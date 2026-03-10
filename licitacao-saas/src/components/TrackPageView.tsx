"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const BOT_USER_AGENT_REGEX =
  /bot|crawler|spider|crawling|headless|preview|facebookexternalhit|slurp|bingpreview/i;
const SESSION_STORAGE_KEY = "licitai.portal.session_id";

function getSessionId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) {
      return existing;
    }

    const sessionId = window.crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    return sessionId;
  } catch {
    return null;
  }
}

export default function TrackPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname || typeof window === "undefined") {
      return;
    }

    if (BOT_USER_AGENT_REGEX.test(window.navigator.userAgent)) {
      return;
    }

    const sessionId = getSessionId();
    if (!sessionId) {
      return;
    }

    const payload = {
      path: pathname,
      referrer: document.referrer || null,
      sessionId,
      utmSource: searchParams.get("utm_source"),
      utmMedium: searchParams.get("utm_medium"),
      utmCampaign: searchParams.get("utm_campaign"),
    };

    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  }, [pathname, searchParams]);

  return null;
}
