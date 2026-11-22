"use client";

import { useEffect } from "react";

const scripts = new Map();
function loadExternalScript(src, ready) {
  if (ready()) return Promise.resolve();
  if (scripts.has(src)) return scripts.get(src);
  const loading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    const timer = setTimeout(() => fail(), 20000);
    const fail = () => {
      clearTimeout(timer);
      script.remove();
      reject(new Error("Recognition libraries could not load. Check your connection and retry."));
    };
    script.addEventListener("load", () => {
      clearTimeout(timer);
      if (ready()) resolve();
      else fail();
    }, { once: true });
    script.addEventListener("error", fail, { once: true });
    document.head.appendChild(script);
  }).catch(error => {
    scripts.delete(src);
    throw error;
  });
  scripts.set(src, loading);
  return loading;
}

export default function TranslatorRuntime() {
  useEffect(() => {
    let active = true;
    let cleanup;
    const cameraButton = document.getElementById("cameraBtn");
    const interpretButton = document.getElementById("translateSentenceBtn");

    async function initialize() {
      cameraButton.disabled = true;
      cameraButton.textContent = "Loading recognition…";
      interpretButton.disabled = true;
      try {
        await Promise.all([
          loadExternalScript(
            "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js",
            () => Boolean(window.tf)
          ),
          loadExternalScript(
            "https://cdn.jsdelivr.net/npm/fingerpose@0.1.0/dist/fingerpose.min.js",
            () => Boolean(window.fp)
          )
        ]);
        const { mountTranslator } = await import("../client/translator");
        if (active) {
          cleanup = mountTranslator();
          interpretButton.disabled = false;
        }
      } catch (error) {
        console.error("Dexter recognition runtime failed to load.", error);
        if (!active) return;
        document.getElementById("captureStateLabel").textContent = "Recognition unavailable";
        document.getElementById("captureStateDetail").textContent = error.message;
        cameraButton.disabled = false;
        cameraButton.textContent = "Retry loading";
        cameraButton.onclick = initialize;
      }
    }

    initialize();
    return () => {
      active = false;
      cleanup?.();
      cameraButton.onclick = null;
    };
  }, []);

  return null;
}
