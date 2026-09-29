import assert from "node:assert/strict";
import test from "node:test";
import { safeTokenCompare } from "./security.js";

test("safeTokenCompare rejects empty, wrong and accepts exact tokens", () => {
  assert.equal(safeTokenCompare("", "secret"), false);
  assert.equal(safeTokenCompare("secret-x", "secret"), false);
  assert.equal(safeTokenCompare("secret", "secret"), true);
});
