"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const InstallContext = createContext<{ installed: boolean; install: () => void }>({ installed: true, install: () => {} });

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const prompt = useRef<InstallPrompt | null>(null);
  const registration = useRef<ServiceWorkerRegistration | null>(null);
  const reloadRequested = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const [installed, setInstalled] = useState(true);
  const [offline, setOffline] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)");
    const syncInstalled = () => setInstalled(standalone.matches || !!(navigator as Navigator & { standalone?: boolean }).standalone);
    const syncNetwork = () => setOffline(!navigator.onLine);
    const beforeInstall = (event: Event) => { event.preventDefault(); prompt.current = event as InstallPrompt; };
    const didInstall = () => { prompt.current = null; setInstalled(true); dialog.current?.close(); };
    syncInstalled();
    syncNetwork();
    standalone.addEventListener("change", syncInstalled);
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", didInstall);
    window.addEventListener("online", syncNetwork);
    window.addEventListener("offline", syncNetwork);
    return () => {
      standalone.removeEventListener("change", syncInstalled);
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", didInstall);
      window.removeEventListener("online", syncNetwork);
      window.removeEventListener("offline", syncNetwork);
    };
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let active = true;
    const controllerChanged = () => {
      if (reloadRequested.current) window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", controllerChanged);
    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then((reg) => {
      if (!active) return;
      registration.current = reg;
      if (reg.waiting) setUpdateReady(true);
      reg.addEventListener("updatefound", () => {
        const worker = reg.installing;
        worker?.addEventListener("statechange", () => {
          if (active && worker.state === "installed" && navigator.serviceWorker.controller) setUpdateReady(true);
        });
      });
    }).catch((error: unknown) => console.error("Не удалось включить PWA", error));
    const checkUpdate = () => {
      if (document.visibilityState === "visible") void registration.current?.update().catch(() => {});
    };
    document.addEventListener("visibilitychange", checkUpdate);
    return () => {
      active = false;
      navigator.serviceWorker.removeEventListener("controllerchange", controllerChanged);
      document.removeEventListener("visibilitychange", checkUpdate);
    };
  }, []);

  const install = async () => {
    const deferred = prompt.current;
    if (!deferred) { dialog.current?.showModal(); return; }
    prompt.current = null;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch { dialog.current?.showModal(); }
  };

  return (
    <InstallContext.Provider value={{ installed, install: () => void install() }}>
      {children}
      {(offline || updateReady) && (
        <div className="pwa-status fixed inset-x-3 z-[120] mx-auto max-w-lg rounded-xl border border-slate-600 bg-slate-900 p-3 text-sm shadow-xl" role="status" aria-live="polite">
          {offline ? <p>Нет связи. Для сохранения задач нужен интернет. Не закрывайте несохранённые формы; после подключения повторите сохранение.</p> : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex-1">Доступна новая версия. Сохраните изменения перед обновлением.</p>
              <button className="min-h-11 rounded-lg bg-indigo-600 px-3 text-white disabled:opacity-50" disabled={updating} onClick={() => {
                const worker = registration.current?.waiting;
                if (!worker) { setUpdateReady(false); return; }
                reloadRequested.current = true;
                setUpdating(true);
                worker.postMessage({ type: "SKIP_WAITING" });
              }}>{updating ? "Обновление…" : "Обновить"}</button>
            </div>
          )}
        </div>
      )}
      <dialog ref={dialog} aria-labelledby="install-title" className="pwa-install-dialog m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-200 shadow-2xl backdrop:bg-black/70">
        <h2 id="install-title" className="text-lg font-semibold text-white">TaskTracker на главном экране</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">Приложение откроется в отдельном окне, а задачи и заметки будут всегда под рукой.</p>
        <ol className="mt-4 list-inside list-decimal space-y-3 text-sm leading-relaxed text-slate-400">
          <li><strong className="text-slate-200">iPhone / iPad:</strong> откройте сайт в Safari, нажмите «Поделиться» → «На экран Домой» → «Добавить».</li>
          <li><strong className="text-slate-200">Android:</strong> в меню браузера выберите «Установить приложение» или «Добавить на главный экран».</li>
        </ol>
        <p className="mt-3 text-xs text-slate-500">Для установки откройте сайт по HTTPS. Для работы с задачами нужен интернет.</p>
        <form method="dialog" className="mt-5"><button className="min-h-11 w-full rounded-xl bg-indigo-600 px-4 font-medium text-white">Понятно</button></form>
      </dialog>
    </InstallContext.Provider>
  );
}

export function InstallAppButton({ compact = false }: { compact?: boolean }) {
  const { installed, install } = useContext(InstallContext);
  if (installed) return null;
  return <button onClick={install} className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-indigo-500/25 bg-indigo-500/10 px-3 py-2 text-sm text-indigo-300 hover:bg-indigo-500/20 ${compact ? "" : "mt-3"}`} aria-label="Установить приложение" title="Установить приложение">{compact ? "↓" : "Установить приложение"}</button>;
}
