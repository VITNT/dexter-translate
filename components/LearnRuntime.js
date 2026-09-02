"use client";

import { useEffect } from "react";

export default function LearnRuntime() {
  useEffect(() => {
    import("../client/learn").catch((error) => {
      console.error("Dexter dictionary runtime failed to load.", error);
    });
  }, []);

  return null;
}
