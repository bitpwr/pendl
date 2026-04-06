"use client";

import { useCallback, useSyncExternalStore } from "react";
import { INCLUDED_AGENCIES, type AgencyId } from "@/lib/config/agencies";

const STORAGE_KEY = "pendl-selected-agency";

const defaultAgencyId = INCLUDED_AGENCIES[0].id;

let cachedAgencyId: AgencyId = defaultAgencyId;
let cachedRaw: string | null | undefined;

function getSnapshot(): AgencyId {
  if (typeof window === "undefined") return defaultAgencyId;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== cachedRaw) {
      cachedRaw = stored;
      cachedAgencyId =
        stored && INCLUDED_AGENCIES.some((a) => a.id === stored)
          ? (stored as AgencyId)
          : defaultAgencyId;
    }
    return cachedAgencyId;
  } catch {
    return defaultAgencyId;
  }
}

function getServerSnapshot(): AgencyId {
  return defaultAgencyId;
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener("agency-changed", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("agency-changed", callback);
  };
}

export function useAgency() {
  const agencyId = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const agency = INCLUDED_AGENCIES.find((a) => a.id === agencyId)!;

  const setAgency = useCallback((id: AgencyId) => {
    localStorage.setItem(STORAGE_KEY, id);
    cachedRaw = undefined; // invalidate cache
    window.dispatchEvent(new Event("agency-changed"));
  }, []);

  return {
    agencyId,
    agencyName: agency.name,
    agencyTag: agency.tag,
    setAgency,
    agencies: INCLUDED_AGENCIES,
  };
}
