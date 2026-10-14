"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useNoteAutosave(
  id: string,
  initial: string,
  persist: (content: string) => Promise<unknown>,
) {
  const key = `myboroda:note-draft:${id}`;
  const [content, setContent] = useState(initial);
  const [status, setStatus] = useState<
    "saved" | "changed" | "saving" | "error"
  >("saved");
  const [hasLocalDraft, setHasLocalDraft] = useState(false);
  const latest = useRef(content);
  const saved = useRef(initial);
  const persistRef = useRef(persist);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Promise<boolean> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    persistRef.current = persist;
  }, [persist]);

  const save = useCallback((): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    if (pending.current) return pending.current;
    if (latest.current === saved.current) return Promise.resolve(true);
    const run = async () => {
      try {
        while (latest.current !== saved.current) {
          const snapshot = latest.current;
          if (mounted.current) setStatus("saving");
          await persistRef.current(snapshot);
          saved.current = snapshot;
        }
        try {
          localStorage.removeItem(key);
        } catch {
          /* Storage may be disabled. */
        }
        if (mounted.current) setStatus("saved");
        return true;
      } catch {
        if (mounted.current) setStatus("error");
        return false;
      } finally {
        pending.current = null;
      }
    };
    pending.current = run();
    return pending.current;
  }, [key]);

  const change = (next: string) => {
    latest.current = next;
    setContent(next);
    setStatus("changed");
    try {
      localStorage.setItem(key, next);
      setHasLocalDraft(true);
    } catch {
      setHasLocalDraft(false);
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), 700);
  };

  useEffect(() => {
    mounted.current = true;
    // Restore after hydration so the server and first client render agree.
    const restore = setTimeout(() => {
      try {
        const recovered = localStorage.getItem(key);
        if (
          recovered !== null &&
          latest.current === saved.current &&
          recovered !== saved.current
        ) {
          latest.current = recovered;
          setContent(recovered);
          setStatus("changed");
          setHasLocalDraft(true);
          timer.current = setTimeout(() => void save(), 700);
        }
      } catch {
        /* Storage may be disabled. */
      }
    }, 0);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (latest.current !== saved.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const online = () => {
      void save();
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("online", online);
    return () => {
      mounted.current = false;
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("online", online);
      clearTimeout(restore);
      if (timer.current) clearTimeout(timer.current);
      void save();
    };
  }, [key, save]);

  return { content, change, save, status, hasLocalDraft };
}
