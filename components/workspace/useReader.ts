"use client";
import { useEffect, useState } from "react";
import { requestJson } from "@/lib/http-client";
import {
  readerDefaults,
  type ReaderPreferences,
} from "@/lib/study/preferences";
export function useReader() {
  const [reader, setReader] = useState(readerDefaults),
    [loaded, setLoaded] = useState(false),
    [status, setStatus] = useState(""),
    [saving, setSaving] = useState(false);
  async function load() {
    setLoaded(false);
    setStatus("Loading preferences…");
    try {
      const { response, data } = await requestJson("/api/student/preferences");
      if (!response.ok) throw new Error(data.error);
      setReader(data.reader);
      setLoaded(true);
      setStatus("Preferences loaded");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not load preferences.");
    }
  }
  useEffect(() => {
    void load();
  }, []);
  function change(patch: Partial<ReaderPreferences>) {
    setReader((old) => ({ ...old, ...patch }));
    setStatus("Unsaved preferences");
  }
  async function save() {
    if (!loaded || saving) return;
    setSaving(true);
    try {
      const { response, data } = await requestJson("/api/student/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reader),
      });
      if (!response.ok) throw new Error(data.error);
      setReader(data.reader);
      setStatus("Preferences saved to your account");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not save preferences.");
    } finally {
      setSaving(false);
    }
  }
  return { reader, loaded, status, saving, change, save, load };
}
