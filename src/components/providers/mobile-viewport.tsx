"use client";

import { useEffect } from "react";

/** Keep dialogs above the software keyboard, including Safari's visual viewport. */
export function MobileViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      const root = document.documentElement;
      root.style.setProperty("--app-height", `${viewport.height}px`);
      root.style.setProperty("--viewport-top", `${viewport.offsetTop}px`);
      root.dataset.keyboardOpen = String(window.innerHeight - viewport.height > 150);
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      document.documentElement.style.removeProperty("--app-height");
      document.documentElement.style.removeProperty("--viewport-top");
      delete document.documentElement.dataset.keyboardOpen;
    };
  }, []);
  return null;
}
