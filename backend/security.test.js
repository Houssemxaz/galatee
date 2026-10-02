import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedMutationOrigin, safeTokenCompare } from "./security.js";

test("safeTokenCompare rejects empty, wrong and accepts exact tokens", () => {
  assert.equal(safeTokenCompare("", "secret"), false);
  assert.equal(safeTokenCompare("secret-x", "secret"), false);
  assert.equal(safeTokenCompare("secret", "secret"), true);
});

test("isAllowedMutationOrigin accepts local clients and rejects foreign browser origins", () => {
  assert.equal(isAllowedMutationOrigin({ headers: {} }, "https://app.example"), true);
  assert.equal(isAllowedMutationOrigin({ headers: { origin: "https://app.example" } }, "https://app.example"), true);
  assert.equal(isAllowedMutationOrigin({ headers: { origin: "https://attacker.example" } }, "https://app.example"), false);
});
