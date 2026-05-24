"use client";

import { useEffect, useState } from "react";
import { getApiBaseUrl } from "@/lib/api";

const apiBaseUrl = getApiBaseUrl();

export function useSettingsResource<T>(path: string, initialData: T) {
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${apiBaseUrl}${path}`, { cache: "no-store" });
        const payload = (await response.json()) as T & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "Chargement impossible");
        }

        if (isMounted) {
          setData(payload);
        }
      } catch (caught) {
        if (isMounted) {
          setError(caught instanceof Error ? caught.message : "Chargement impossible");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [initialData, path]);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      const payload = (await response.json()) as { ok?: boolean; settings?: T; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Sauvegarde impossible");
      }

      setData(payload.settings ?? data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sauvegarde impossible");
    } finally {
      setSaving(false);
    }
  }

  return {
    data,
    setData,
    loading,
    saving,
    saved,
    error,
    save
  };
}
