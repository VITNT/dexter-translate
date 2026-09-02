import assert from "node:assert/strict";
import fs from "node:fs";
import {
  accountPathname,
  createSessionToken,
  hashPassword,
  safeNextPath,
  verifyPassword,
  verifySessionToken
} from "../../lib/auth-core.js";

const password = "Dexter2026";
const storedPassword = await hashPassword(password);
assert.equal(await verifyPassword(password, storedPassword), true);
assert.equal(await verifyPassword("wrong-password", storedPassword), false);
assert.notEqual(storedPassword.hash, password);

const secret = "a-secure-test-secret-that-is-longer-than-32-characters";
const user = { id: "user-1", name: "Dexter User", email: "user@example.com" };
const token = createSessionToken(user, secret, Date.UTC(2026, 0, 1));
const session = verifySessionToken(token, secret, Date.UTC(2026, 0, 2));
assert.equal(session.sub, user.id);
assert.equal(session.email, user.email);
assert.equal(verifySessionToken(`${token}tampered`, secret, Date.UTC(2026, 0, 2)), null);

assert.equal(accountPathname(" User@Example.com "), accountPathname("user@example.com"));
assert.equal(safeNextPath("/translate"), "/translate");
assert.equal(safeNextPath("https://attacker.test"), "/translate");
assert.equal(safeNextPath("//attacker.test"), "/translate");

const root = new URL("../../", import.meta.url);
for (const route of ["config", "translate"]) {
  const source = fs.readFileSync(new URL(`app/api/${route}/route.js`, root), "utf8");
  assert.doesNotMatch(source, /getSession/);
  assert.doesNotMatch(source, /Authentication required/);
}

const speechRoute = fs.readFileSync(new URL("app/api/speech/route.js", root), "utf8");
assert.match(speechRoute, /hasProAccess/);
assert.match(speechRoute, /Text to speech is available on Dexter Pro/);

for (const pathname of ["app/login/page.js", "app/signup/page.js", "app/account/page.js", "app/translate/page.js"]) {
  assert.equal(fs.existsSync(new URL(pathname, root)), true, `${pathname} must exist.`);
}

const translatePage = fs.readFileSync(new URL("app/translate/page.js", root), "utf8");
assert.doesNotMatch(translatePage, /redirect\(/);
assert.doesNotMatch(translatePage, /getSession/);

console.log("Authentication contracts passed: secure optional accounts with public product access.");
