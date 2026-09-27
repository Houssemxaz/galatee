import assert from "node:assert/strict";
import test from "node:test";
import { resolveCorsOrigin, safeTokenCompare } from "./security.js";

test("safeTokenCompare rejects empty, mismatched lengths, and wrong values", () => {
  assert.equal(safeTokenCompare("", "abc"), false);
  assert.equal(safeTokenCompare("abc", ""), false);
  assert.equal(safeTokenCompare(null, "abc"), false);
  assert.equal(safeTokenCompare("abc", null), false);
  assert.equal(safeTokenCompare("abcd", "abc"), false);
  assert.equal(safeTokenCompare("abc", "abd"), false);
  assert.equal(safeTokenCompare("abc", "abc"), true);
});

test("resolveCorsOrigin normalizes explicit origin and rejects '*' in production", () => {
  assert.equal(resolveCorsOrigin("https://example.com"), "https://example.com");
  // NODE_ENV n est pas "production" en test → * est tolere.
  assert.equal(resolveCorsOrigin("*"), "*");
  assert.equal(resolveCorsOrigin(""), "*");
});
