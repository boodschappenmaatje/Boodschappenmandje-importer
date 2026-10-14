"use client";

import { useEffect } from "react";

import "./maatje-intro.css";

function isInstalledApp() {
  const standaloneSafari = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standaloneSafari || window.matchMedia("(display-mode: standalone)").matches;
}

/**
 * When the installed app goes to the background, iOS takes a screenshot and
 * shows it during the next launch, before the intro can start. Covering the
 * app with the intro's blue background at that moment keeps the old content
 * out of that screenshot. Only active in the installed (home screen) app.
 */
export function LaunchSnapshotCover() {
  useEffect(() => {
    if (!isInstalledApp()) return;

    const root = document.documentElement;
    const cover = () => {
      root.dataset.maatjeCover = "on";
    };
    const uncover = () => {
      delete root.dataset.maatjeCover;
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") cover();
      else uncover();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", cover);
    window.addEventListener("pageshow", uncover);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", cover);
      window.removeEventListener("pageshow", uncover);
      uncover();
    };
  }, []);

  return <div className="mi-launch-cover" aria-hidden="true" />;
}
