"use client";

import { useEffect } from "react";

export const SERVICE_WORKER_RELEASE = "pwa8-2026-09-15";

export function PwaRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
      return;
    }

    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloading = false;

    const activateUpdate = () => {
      if (!hadController || reloading) return;
      reloading = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", activateUpdate);

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register(
          `/sw.js?release=${SERVICE_WORKER_RELEASE}`,
          {
          scope: "/",
          updateViaCache: "none",
          },
        );

        registration.waiting?.postMessage({ type: "SKIP_WAITING" });
        await registration.update();
      } catch (error) {
        console.warn("Service worker kon niet worden geregistreerd.", error);
      }
    };

    void register();

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", activateUpdate);
    };
  }, []);

  return null;
}
