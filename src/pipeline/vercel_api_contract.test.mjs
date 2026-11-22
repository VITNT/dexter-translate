import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const configHandler = require("../../server/api/config.js");
const translateHandler = require("../../server/api/translate.js");
const speechHandler = require("../../server/api/speech.js");
const { parseBilingualTranslation } = translateHandler;
const { splitSpeechText } = speechHandler;

function mockResponse() {
  return {
    headers: {},
    statusCode: 200,
    payload: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    }
  };
}

const previousWlaslUrl = process.env.WLASL_API_URL;
process.env.WLASL_API_URL = "https://asl.example.test/";
const configResponse = mockResponse();
configHandler({ method: "GET" }, configResponse);
assert.equal(configResponse.statusCode, 200);
assert.equal(configResponse.payload.wlaslApiUrl, "https://asl.example.test");
assert.equal(configResponse.headers["Cache-Control"], "no-store");

delete process.env.WLASL_API_URL;
const defaultConfigResponse = mockResponse();
configHandler({ method: "GET" }, defaultConfigResponse);
assert.equal(defaultConfigResponse.payload.wlaslApiUrl, "");

const previousGeminiKey = process.env.GEMINI_API_KEY;
delete process.env.GEMINI_API_KEY;
const translateResponse = mockResponse();
await translateHandler({ method: "POST", body: { aslString: "ME GO" } }, translateResponse);
assert.equal(translateResponse.statusCode, 503);
assert.match(translateResponse.payload.error, /GEMINI_API_KEY/);

assert.deepEqual(
  parseBilingualTranslation('```json\n{"khmer":"ខ្ញុំទៅហាង។","english":"i am going to the store"}\n```'),
  { khmer: "ខ្ញុំទៅហាង។", english: "I am going to the store." }
);
assert.equal(parseBilingualTranslation('{"khmer":"ខ្ញុំទៅហាង។"}'), null);

let capturedGeminiRequest;
process.env.GEMINI_API_KEY = "test-key";
const previousFetch = globalThis.fetch;
let capturedGeminiUrl;
globalThis.fetch = async (url, options) => {
  capturedGeminiUrl = String(url);
  capturedGeminiRequest = JSON.parse(options.body);
  return {
    ok: true,
    status: 200,
    async json() {
      return {
        candidates: [{
          content: {
            parts: [
              { thought: true, text: "Internal reasoning" },
              { text: '{"khmer":"ខ្ញុំទៅហាង។","english":"I am going to the store."}' }
            ]
          }
        }]
      };
    }
  };
};

const bilingualResponse = mockResponse();
await translateHandler({ method: "POST", body: { aslString: "ME GO STORE" } }, bilingualResponse);
assert.equal(bilingualResponse.statusCode, 200);
assert.deepEqual(bilingualResponse.payload.translation, {
  khmer: "ខ្ញុំទៅហាង។",
  english: "I am going to the store."
});
assert.match(capturedGeminiRequest.contents[0].parts[0].text, /Khmer and English/);
assert.match(capturedGeminiRequest.contents[0].parts[0].text, /CSL\/KSL gloss/);

assert.match(capturedGeminiUrl, /\/models\/gemma-4-31b-it:generateContent$/, "The default model must be Gemma 4 31B, with the key kept out of the URL.");
assert.deepEqual(capturedGeminiRequest.generationConfig.thinkingConfig, { thinkingLevel: "MINIMAL" });
assert.ok(capturedGeminiRequest.generationConfig.maxOutputTokens >= 1024, "Khmer and English output must not be truncated at 150 tokens.");

for (const [status, message] of [[429, /quota/], [503, /temporarily unavailable/], [403, /configured correctly/]]) {
  globalThis.fetch = async () => ({ ok: false, status, json: async () => ({ error: { message: "Private upstream details" } }) });
  const response = mockResponse();
  await translateHandler({ method: "POST", body: { aslString: "HELLO" } }, response);
  assert.equal(response.statusCode, status === 429 ? 429 : 502);
  assert.match(response.payload.error, message);
  assert.equal(response.payload.details, undefined);
}

globalThis.fetch = async () => { throw new DOMException("Timed out", "TimeoutError"); };
const timeoutResponse = mockResponse();
await translateHandler({ method: "POST", body: { aslString: "HELLO" } }, timeoutResponse);
assert.equal(timeoutResponse.statusCode, 504);
assert.match(timeoutResponse.payload.error, /too long/);

globalThis.fetch = previousFetch;

let capturedSpeechUrl;
globalThis.fetch = async (url) => {
  capturedSpeechUrl = String(url);
  return {
    ok: true,
    status: 200,
    async arrayBuffer() {
      return Uint8Array.from([73, 68, 51]).buffer;
    }
  };
};

const speechResponse = {
  ...mockResponse(),
  body: null,
  send(body) {
    this.body = body;
    return this;
  }
};
await speechHandler({
  method: "GET",
  query: { language: "km-KH", text: "សួស្តី" }
}, speechResponse);
assert.equal(speechResponse.statusCode, 200);
assert.equal(speechResponse.headers["Content-Type"], "audio/mpeg");
assert.equal(speechResponse.headers["Cache-Control"], "no-store");
assert.ok(Buffer.isBuffer(speechResponse.body));
assert.match(capturedSpeechUrl, /translate_tts/);
assert.match(capturedSpeechUrl, /tl=km/);
assert.deepEqual(splitSpeechText("a".repeat(400)).map(chunk => chunk.length), [180, 180, 40]);

globalThis.fetch = previousFetch;

if (previousWlaslUrl == null) delete process.env.WLASL_API_URL;
else process.env.WLASL_API_URL = previousWlaslUrl;
if (previousGeminiKey == null) delete process.env.GEMINI_API_KEY;
else process.env.GEMINI_API_KEY = previousGeminiKey;

console.log("Vercel API contracts passed: public runtime config and server-only Gemini key handling.");
