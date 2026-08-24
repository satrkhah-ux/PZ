"use client";

import { useEffect, useRef } from "react";

/**
 * Interval polling that STOPS while the tab is hidden and resumes (with an
 * immediate catch-up run) on focus.
 *
 * Every tick is a server action = one serverless invocation. A POS screen left
 * open all day at 5s was burning ~10k invocations/day per screen, which is what
 * exhausted the Netlify account credits and paused the whole site. Idle screens
 * must cost nothing.
 */
export function usePoll(fn: () => void | Promise<void>, everyMs: number) {
  const saved = useRef(fn);
  saved.current = fn;

  useEffect(() => {
    let timer: number | undefined;
    let stopped = false;

    const run = () => {
      if (!stopped && document.visibilityState === "visible") void saved.current();
    };
    const start = () => {
      if (timer !== undefined) return;
      timer = window.setInterval(run, everyMs);
    };
    const stop = () => {
      if (timer === undefined) return;
      window.clearInterval(timer);
      timer = undefined;
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        run(); // catch up on whatever happened while hidden
        start();
      } else {
        stop();
      }
    };

    run();
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [everyMs]);
}
