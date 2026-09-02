import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { signDictionary } from "../../client/sign-dictionary.js";

const publicRoot = fileURLToPath(new URL("../../public/", import.meta.url));

test("SignDex preserves the ASL catalog and original CSL reference set", () => {
  assert.equal(
    signDictionary.asl.filter((entry) => entry.category === "Alphabet").length,
    26,
    "ASL must include all 26 fingerspelling letters."
  );
  assert.ok(signDictionary.asl.length >= 29, "ASL must include word demonstrations as well as letters.");
  assert.equal(signDictionary.csl.length, 11, "CSL must contain only the original 11 visual references.");

  for (const [language, entries] of Object.entries(signDictionary)) {
    assert.equal(new Set(entries.map((entry) => entry.id)).size, entries.length, `${language} IDs must be unique.`);

    for (const entry of entries) {
      assert.ok(entry.word, `${language} entries must have a display label.`);
      assert.ok(entry.category, `${entry.word} must have a category.`);
      assert.ok(entry.media.length > 0 || entry.onlineReference, `${entry.word} must have a visual reference path.`);
      for (const item of entry.media) {
        const assetPath = `${publicRoot}${decodeURI(item.src).replace(/^\//, "")}`;
        assert.ok(fs.existsSync(assetPath), `${entry.word} references missing media: ${item.src}`);
      }

      if (language === "csl") {
        assert.ok(
          entry.media.every((item) => item.src.startsWith("/images/csl/")),
          `${entry.word} must use an original CSL visual asset.`
        );
      }
    }
  }
});
