import posthog from "posthog-js";

const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
const posthogHost = import.meta.env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com";

let initialized = false;

export function initializeProductAnalytics(): void {
  if (initialized || !posthogKey) {
    return;
  }

  posthog.init(posthogKey, {
    api_host: posthogHost,
    capture_pageview: true,
    capture_pageleave: true,
    persistence: "localStorage",
    autocapture: true,
  });

  initialized = true;
}

export function trackEvent(event: string, properties?: Record<string, unknown>): void {
  if (!initialized) {
    return;
  }

  posthog.capture(event, properties);
}

export function identifyUser(userId: string, properties?: Record<string, unknown>): void {
  if (!initialized) {
    return;
  }

  posthog.identify(userId, properties);
}

export function resetUserIdentity(): void {
  if (!initialized) {
    return;
  }

  posthog.reset();
}
