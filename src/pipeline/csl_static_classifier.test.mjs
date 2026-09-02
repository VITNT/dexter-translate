import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  STATIC_CSL_INPUT_WIDTH,
  buildStaticCslFeatures,
  normalizeStaticHand,
  predictStaticCsl,
  validateStaticCslModel
} from "./csl_static_classifier.mjs";

const hand = Array.from({ length: 21 }, (_, index) => ({
  x: index / 20,
  y: (20 - index) / 20,
  z: 99
}));
const normalized = normalizeStaticHand(hand);
assert.equal(normalized.length, 42);
assert.ok(Math.abs(normalized.slice(0, 21).reduce((sum, value) => sum + value, 0)) < 1e-9);
assert.equal(buildStaticCslFeatures([hand]).length, STATIC_CSL_INPUT_WIDTH);
assert.deepEqual(buildStaticCslFeatures([]), new Array(84).fill(0));

const model = {
  classes: ["negative", "positive"],
  displayLabels: ["Negative", "Positive"],
  layers: [
    { weight: Array.from({ length: 128 }, () => new Array(84).fill(0)), bias: new Array(128).fill(0) },
    { weight: Array.from({ length: 64 }, () => new Array(128).fill(0)), bias: new Array(64).fill(0) },
    { weight: [new Array(64).fill(0), new Array(64).fill(0)], bias: [-1, 1] }
  ]
};
validateStaticCslModel(model);
const prediction = predictStaticCsl(model, [hand]);
assert.equal(prediction[0].word, "Positive");
assert.ok(prediction[0].confidence > 0.85);

const releasedModel = JSON.parse(await readFile(
  new URL("../../public/models/csl/static-landmark-v1.json", import.meta.url),
  "utf8"
));
const releasedPrediction = predictStaticCsl(releasedModel, [hand]);
assert.equal(releasedPrediction[0].form, "form_k");
assert.ok(Math.abs(releasedPrediction[0].confidence - 0.9451614) < 1e-6);

console.log("Static CSL classifier tests passed: upstream 84-value LandmarkNet contract.");
