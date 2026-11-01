"use client";

import { useEffect, useRef } from "react";

const openModals: HTMLElement[] = [];
let originalOverflow = "";

/** Focus and Escape belong to the topmost dialog; nested dialogs keep the scroll lock. */
export function useModal(onClose: () => void, open = true) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const element = ref.current;
    if (!open || !element) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!openModals.length) originalOverflow = document.body.style.overflow;
    openModals.push(element);
    document.body.style.overflow = "hidden";
    element.tabIndex = -1;
    if (!element.contains(document.activeElement)) element.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || openModals.at(-1) !== element || document.querySelector("dialog[open]")) return;
      // A canvas or attachment preview may own its own dialog outside this hook's stack.
      const dialogs = [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')];
      if (dialogs.at(-1) !== element) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close.current(); }
      if (event.key !== "Tab") return;
      const focusable = [...element.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"], [contenteditable="true"]')].filter((item) => item.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first) { event.preventDefault(); element.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === element)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === element)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      openModals.splice(openModals.indexOf(element), 1);
      document.removeEventListener("keydown", onKey);
      if (!openModals.length) document.body.style.overflow = originalOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [open]);
  return ref;
}
