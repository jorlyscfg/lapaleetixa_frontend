import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PwaLifecycle } from "./pwa_lifecycle";

type WorkerListener = (event?: Event) => void;

function setOnlineStatus(isOnline: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: isOnline,
  });
}

function setServiceWorkerMock(serviceWorker?: Partial<ServiceWorkerContainer>) {
  if (!serviceWorker) {
    Reflect.deleteProperty(window.navigator, "serviceWorker");
    return;
  }

  Object.defineProperty(window.navigator, "serviceWorker", {
    configurable: true,
    value: serviceWorker,
  });
}

function createRegistrationMock(options?: {
  waiting?: Partial<ServiceWorker> | null;
  installing?: Partial<ServiceWorker> | null;
}) {
  let updateFoundListener: WorkerListener | undefined;
  let stateChangeListener: WorkerListener | undefined;

  const installingWorker = {
    state: "installing",
    addEventListener: vi.fn((event: string, listener: WorkerListener) => {
      if (event === "statechange") {
        stateChangeListener = listener;
      }
    }),
    ...options?.installing,
  };

  const registration = {
    waiting: options?.waiting ?? null,
    installing: options?.installing === null ? null : installingWorker,
    update: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn((event: string, listener: WorkerListener) => {
      if (event === "updatefound") {
        updateFoundListener = listener;
      }
    }),
  };

  return {
    registration: registration as unknown as ServiceWorkerRegistration,
    installingWorker,
    triggerUpdateFound: () => updateFoundListener?.(new Event("updatefound")),
    triggerStateChange: () => stateChangeListener?.(new Event("statechange")),
  };
}

describe("PwaLifecycle", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setOnlineStatus(true);
    setServiceWorkerMock(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it("does nothing when service workers are unsupported", async () => {
    render(<PwaLifecycle />);

    expect(screen.queryByText("Sin conexión")).not.toBeInTheDocument();
    expect(screen.queryByText("Actualización disponible")).not.toBeInTheDocument();
  });

  it("registers the root service worker with cache-bypassing update options", async () => {
    const { registration } = createRegistrationMock({ installing: null });
    const register = vi.fn().mockResolvedValue(registration);

    setServiceWorkerMock({
      controller: null,
      register,
    });

    render(<PwaLifecycle />);

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
    });
    expect(registration.update).toHaveBeenCalledTimes(1);
  });

  it("shows the offline message and dismisses it when the browser returns online", async () => {
    setOnlineStatus(false);
    render(<PwaLifecycle />);

    expect(screen.getByText("Sin conexión")).toBeInTheDocument();
    expect(
      screen.getByText("Espere a recuperar la conexión antes de continuar operaciones ERP con datos en vivo."),
    ).toBeInTheDocument();

    act(() => {
      setOnlineStatus(true);
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => {
      expect(screen.queryByText("Sin conexión")).not.toBeInTheDocument();
    });
  });

  it("shows an update prompt when a waiting worker already exists", async () => {
    const waitingWorker = { postMessage: vi.fn() };
    const { registration } = createRegistrationMock({ waiting: waitingWorker });

    setServiceWorkerMock({
      controller: null,
      register: vi.fn().mockResolvedValue(registration),
    });

    render(<PwaLifecycle />);

    expect(await screen.findByText("Actualización disponible")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actualizar ahora" })).toBeInTheDocument();
  });

  it("shows an update prompt when an installed replacement worker is detected", async () => {
    const { registration, installingWorker, triggerUpdateFound, triggerStateChange } = createRegistrationMock();

    setServiceWorkerMock({
      controller: {} as ServiceWorker,
      register: vi.fn().mockResolvedValue(registration),
    });

    render(<PwaLifecycle />);

    await waitFor(() => {
      expect(registration.addEventListener).toHaveBeenCalledWith("updatefound", expect.any(Function));
    });

    act(() => {
      triggerUpdateFound();
      installingWorker.state = "installed";
      triggerStateChange();
    });

    expect(await screen.findByText("Actualización disponible")).toBeInTheDocument();
  });
});

describe("service-worker no-cache/no-data-cache contract", () => {
  it("keeps fetch handling as network pass-through without Cache API writes or offline queues", () => {
    const swSource = readFileSync(join(process.cwd(), "public/sw.js"), "utf8");

    expect(swSource).toContain("event.respondWith(fetch(event.request))");
    expect(swSource).not.toMatch(/\bcaches\b|CacheStorage|\.put\(|\.addAll\(/);
    expect(swSource).not.toMatch(/indexedDB|localStorage|BackgroundSync|sync/);
    expect(swSource).not.toMatch(/\/api\/|\/files\//);
  });
});
