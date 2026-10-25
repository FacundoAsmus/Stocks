"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { AnimationEvent, TransitionEvent } from "react";
import { usePathname } from "next/navigation";

import { StockPageSkeleton } from "@/components/mobile/StockPageSkeleton";

type SheetPhase = "idle" | "entering" | "entered" | "fading" | "exiting";
type SheetDirection = "enter" | "exit" | null;
type SheetRun = {
  phase: SheetPhase;
  direction: SheetDirection;
  ready: boolean;
  animationDone: boolean;
  id: number;
};
type OutgoingSnapshot = { node: HTMLElement; direction: "enter" | "exit" };

function isStockPath(path: string) {
  return path.startsWith("/stock/");
}

export function StockSheet() {
  const pathname = usePathname();
  const [observedPath, setObservedPath] = useState(pathname);
  const runId = useRef(0);
  const outgoingSnapshotRef = useRef<OutgoingSnapshot | null>(null);
  const snapshotMountRef = useRef<HTMLDivElement | null>(null);
  const underlayMountRef = useRef<HTMLDivElement | null>(null);
  const [run, setRun] = useState<SheetRun>({
    phase: "idle",
    direction: null,
    ready: false,
    animationDone: false,
    id: 0,
  });

  // Update the transition during render so the sheet is present in the same
  // commit as the route change, without an effect-driven flash underneath.
  if (observedPath !== pathname) {
    const wasStock = isStockPath(observedPath);
    const isStock = isStockPath(pathname);
    setObservedPath(pathname);
    if (wasStock !== isStock) {
      const direction: SheetDirection = isStock ? "enter" : "exit";
      runId.current += 1;
      setRun({
        phase: direction === "enter" ? "entering" : "exiting",
        direction,
        ready: false,
        animationDone: false,
        id: runId.current,
      });
    }
  }

  useLayoutEffect(() => {
    document.documentElement.toggleAttribute("data-stock-sheet", run.phase !== "idle");
    return () => document.documentElement.removeAttribute("data-stock-sheet");
  }, [run.phase]);

  useEffect(() => {
    const capturePage = (direction: "enter" | "exit") => {
      if (window.matchMedia("(min-width: 1024px)").matches) return;
      const page = direction === "exit"
        ? document.querySelector<HTMLElement>(".stock-page-real-frame")
        : document.querySelector<HTMLElement>("main");
      if (!page) return;
      const snapshot = page.cloneNode(true) as HTMLElement;
      if (direction === "exit") {
        snapshot.classList.remove("rounded-t-3xl", "border", "border-white/15", "shadow-2xl");
      }
      snapshot.style.transform = `translateY(-${window.scrollY}px)`;
      snapshot.style.pointerEvents = "none";
      outgoingSnapshotRef.current = { node: snapshot, direction };
    };
    const onCaptureRequest = () => capturePage(isStockPath(pathname) ? "exit" : "enter");
    const onDocumentClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!link) return;
      let targetPath = "";
      try { targetPath = new URL(link.href, window.location.href).pathname; } catch { return; }
      const wasStock = isStockPath(pathname);
      const isStock = isStockPath(targetPath);
      if (wasStock !== isStock) capturePage(isStock ? "enter" : "exit");
    };
    window.addEventListener("stock-sheet-capture-page", onCaptureRequest);
    document.addEventListener("click", onDocumentClick, true);
    return () => {
      window.removeEventListener("stock-sheet-capture-page", onCaptureRequest);
      document.removeEventListener("click", onDocumentClick, true);
    };
  }, [pathname]);

  useLayoutEffect(() => {
    const snapshot = outgoingSnapshotRef.current;
    const mount = run.direction === "exit" ? snapshotMountRef.current : underlayMountRef.current;
    if (!snapshot || snapshot.direction !== run.direction) return;
    if (!mount || !snapshot) return;
    mount.replaceChildren(snapshot.node);
    outgoingSnapshotRef.current = null;
  }, [run.id, run.direction]);

  useEffect(() => {
    const onStockPageReady = () => {
      setRun((current) => {
        if (current.direction !== "enter" || (current.phase !== "entering" && current.phase !== "entered")) return current;
        return {
          ...current,
          ready: true,
          phase: current.animationDone ? "fading" : current.phase,
        };
      });
    };
    window.addEventListener("stock-page-ready", onStockPageReady);
    return () => window.removeEventListener("stock-page-ready", onStockPageReady);
  }, []);

  function onAnimationEnd(event: AnimationEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    setRun((current) => {
      if (current.phase === "exiting") return { ...current, phase: "idle", direction: null };
      if (current.phase !== "entering") return current;
      return {
        ...current,
        animationDone: true,
        phase: current.ready ? "fading" : "entered",
      };
    });
  }

  function onTransitionEnd(event: TransitionEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.propertyName !== "opacity") return;
    setRun((current) => current.phase === "fading"
      ? { ...current, phase: "idle", direction: null }
      : current);
  }

  if (run.phase === "idle") return null;

  return (
    <>
      {run.direction === "enter" && run.phase !== "fading" && (
        <div ref={underlayMountRef} className="stock-sheet-underlay fixed inset-0 z-[54] overflow-hidden lg:hidden" aria-hidden="true" />
      )}
      <div
        key={run.id}
        className="stock-sheet-card fixed inset-0 z-[55] overflow-y-auto rounded-t-3xl border border-white/15 bg-background shadow-2xl lg:hidden"
        data-phase={run.phase}
        onAnimationEnd={onAnimationEnd}
        onTransitionEnd={onTransitionEnd}
        aria-hidden="true"
      >
        {run.direction === "exit" ? (
          <div ref={snapshotMountRef} className="min-h-screen bg-background" />
        ) : (
          <StockPageSkeleton />
        )}
      </div>
    </>
  );
}
