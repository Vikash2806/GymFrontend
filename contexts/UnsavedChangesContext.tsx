"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type PendingAction = (() => void) | null;
type DirtyMap = Record<string, boolean>;

type UnsavedChangesContextValue = {
  isDirty: boolean;
  showModal: boolean;
  setDirty: (sourceId: string, dirty: boolean) => void;
  clearDirty: (sourceId: string) => void;
  confirmNavigation: (navigate: () => void) => void;
  cancelNavigation: () => void;
  discardAndNavigate: () => void;
};

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [dirtyMap, setDirtyMap] = useState<DirtyMap>({});
  const [showModal, setShowModal] = useState(false);
  const pendingActionRef = useRef<PendingAction>(null);

  const isDirty = useMemo(() => Object.values(dirtyMap).some(Boolean), [dirtyMap]);

  const setDirty = useCallback((sourceId: string, dirty: boolean) => {
    setDirtyMap((prev) => {
      if (!dirty && !prev[sourceId]) {
        return prev;
      }
      const next = { ...prev, [sourceId]: dirty };
      if (!dirty) {
        delete next[sourceId];
      }
      return next;
    });
  }, []);

  const clearDirty = useCallback((sourceId: string) => {
    setDirtyMap((prev) => {
      if (!prev[sourceId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[sourceId];
      return next;
    });
  }, []);

  const confirmNavigation = useCallback(
    (navigate: () => void) => {
      if (!isDirty) {
        navigate();
        return;
      }
      pendingActionRef.current = navigate;
      setShowModal(true);
    },
    [isDirty]
  );

  const cancelNavigation = useCallback(() => {
    pendingActionRef.current = null;
    setShowModal(false);
  }, []);

  const discardAndNavigate = useCallback(() => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setDirtyMap({});
    setShowModal(false);
    action?.();
  }, []);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!isDirty) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (!isDirty || event.defaultPrevented) {
        return;
      }
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank") {
        return;
      }

      const hrefAttr = anchor.getAttribute("href");
      if (!hrefAttr || hrefAttr.startsWith("#") || hrefAttr.startsWith("javascript:")) {
        return;
      }

      let url: URL;
      try {
        url = new URL(hrefAttr, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) {
        return;
      }

      const nextPath = `${url.pathname}${url.search}${url.hash}`;
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextPath === currentPath) {
        return;
      }

      event.preventDefault();
      confirmNavigation(() => router.push(nextPath));
    };

    document.addEventListener("click", onDocumentClick, true);
    return () => document.removeEventListener("click", onDocumentClick, true);
  }, [confirmNavigation, isDirty, router]);

  const value = useMemo<UnsavedChangesContextValue>(
    () => ({
      isDirty,
      showModal,
      setDirty,
      clearDirty,
      confirmNavigation,
      cancelNavigation,
      discardAndNavigate
    }),
    [isDirty, showModal, setDirty, clearDirty, confirmNavigation, cancelNavigation, discardAndNavigate]
  );

  return <UnsavedChangesContext.Provider value={value}>{children}</UnsavedChangesContext.Provider>;
}

export function useUnsavedChanges() {
  const context = useContext(UnsavedChangesContext);
  if (!context) {
    throw new Error("useUnsavedChanges must be used within UnsavedChangesProvider");
  }
  return context;
}
