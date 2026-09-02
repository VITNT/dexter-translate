"use client";

import { useEffect } from "react";

function loadExternalScript(src, ready) {
  if (ready()) return Promise.resolve();

  const existing = document.querySelector(`script[src="${src}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", reject, { once: true });
    document.head.appendChild(script);
  });
}

export default function TranslatorRuntime() {
  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        await loadExternalScript(
          "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js",
          () => Boolean(window.tf)
        );
        await loadExternalScript(
          "https://cdn.jsdelivr.net/npm/fingerpose@0.1.0/dist/fingerpose.min.js",
          () => Boolean(window.fp)
        );
        if (active) await import("../client/translator");
      } catch (error) {
        console.error("Dexter recognition runtime failed to load.", error);
      }
    }

    initialize();
    return () => {
      active = false;
    };
  }, []);

  return null;
}
