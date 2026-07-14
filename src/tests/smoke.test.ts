import assert from "node:assert/strict";
import test from "node:test";

test("test runner is active", () => {
  assert.equal(typeof document, "undefined");
});
