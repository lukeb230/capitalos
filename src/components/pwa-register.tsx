"use client";

import { useEffect } from "react";

// Registers the PWA service worker in browsers only. Skips the Electron
// desktop client (identified by the `electron` version on window.process).
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const w = window as unknown as {
      process?: { versions?: { electron?: string } };
    };
    if (w.process?.versions?.electron) return;

    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  }, []);

  return null;
}
