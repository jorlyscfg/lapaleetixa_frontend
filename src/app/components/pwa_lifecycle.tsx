"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

type UpdateRegistration = ServiceWorkerRegistration | null;

function subscribeToConnectionChanges(onStoreChange: () => void) {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);

  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

function getOfflineSnapshot() {
  return typeof navigator === "undefined" ? false : !navigator.onLine;
}

function getServerOfflineSnapshot() {
  return false;
}

export function PwaLifecycle() {
  const isOffline = useSyncExternalStore(
    subscribeToConnectionChanges,
    getOfflineSnapshot,
    getServerOfflineSnapshot,
  );
  const [updateRegistration, setUpdateRegistration] = useState<UpdateRegistration>(null);
  const [hasUpdate, setHasUpdate] = useState(false);

  const markUpdateAvailable = useCallback((registration: ServiceWorkerRegistration) => {
    setUpdateRegistration(registration);
    setHasUpdate(true);
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    let disposed = false;

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });

        if (disposed) {
          return;
        }

        if (registration.waiting) {
          markUpdateAvailable(registration);
        }

        registration.addEventListener("updatefound", () => {
          const installingWorker = registration.installing;

          if (!installingWorker) {
            return;
          }

          installingWorker.addEventListener("statechange", () => {
            if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
              markUpdateAvailable(registration);
            }
          });
        });

        await registration.update();
      } catch (error) {
        console.error("Error registering service worker:", error);
      }
    };

    void registerServiceWorker();

    return () => {
      disposed = true;
    };
  }, [markUpdateAvailable]);

  const reloadForUpdate = () => {
    updateRegistration?.waiting?.postMessage({ type: "SKIP_WAITING" });
    window.location.reload();
  };

  if (!isOffline && !hasUpdate) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col gap-3 px-4 pb-[calc(var(--pwa-safe-area-bottom)+1rem)] sm:left-auto sm:right-4 sm:max-w-md sm:pl-0">
      {isOffline ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-auto rounded-2xl border border-amber-400/40 bg-amber-950/95 p-4 text-amber-50 shadow-2xl backdrop-blur"
        >
          <p className="text-sm font-black uppercase tracking-[0.2em] text-amber-200">Sin conexión</p>
          <p className="mt-1 text-sm leading-6">
            Espere a recuperar la conexión antes de continuar operaciones ERP con datos en vivo.
          </p>
        </div>
      ) : null}

      {hasUpdate ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-auto rounded-2xl border border-sky-400/40 bg-slate-950/95 p-4 text-slate-50 shadow-2xl backdrop-blur"
        >
          <p className="text-sm font-black uppercase tracking-[0.2em] text-sky-300">Actualización disponible</p>
          <p className="mt-1 text-sm leading-6">Hay una nueva versión de la aplicación lista para usar.</p>
          <button
            type="button"
            onClick={reloadForUpdate}
            className="mt-3 rounded-xl bg-sky-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2 focus:ring-offset-slate-950"
          >
            Actualizar ahora
          </button>
        </div>
      ) : null}
    </div>
  );
}
