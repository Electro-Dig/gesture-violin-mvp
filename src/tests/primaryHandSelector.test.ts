import assert from "node:assert/strict";
import test from "node:test";

import { PrimaryHandSelector } from "../gesture/primaryHandSelector";
import type { HandFrame } from "../gesture/types";

function frame(
  handedness: HandFrame["handedness"],
  confidence: number,
  timestampMs: number,
): HandFrame {
  return { handedness, confidence, timestampMs, landmarks: [] };
}

test("selects the highest-confidence hand initially", () => {
  const selector = new PrimaryHandSelector();

  assert.equal(
    selector.select([frame("left", 0.7, 0), frame("right", 0.9, 0)])?.handedness,
    "right",
  );
});

test("holds the selected role through a small confidence crossover", () => {
  const selector = new PrimaryHandSelector({ switchMargin: 0.12, holdMs: 300 });
  selector.select([frame("left", 0.78, 0), frame("right", 0.9, 0)]);

  assert.equal(
    selector.select([frame("left", 0.92, 100), frame("right", 0.88, 100)])?.handedness,
    "right",
  );
});

test("switches after the hold window when confidence clears the margin", () => {
  const selector = new PrimaryHandSelector({ switchMargin: 0.12, holdMs: 300 });
  selector.select([frame("left", 0.7, 0), frame("right", 0.9, 0)]);

  assert.equal(
    selector.select([frame("left", 0.96, 400), frame("right", 0.8, 400)])?.handedness,
    "left",
  );
});

test("does not substitute a different known hand during the hold window", () => {
  const selector = new PrimaryHandSelector({ holdMs: 300 });
  selector.select([frame("right", 0.9, 0)]);

  assert.equal(selector.select([frame("left", 0.95, 100)]), null);
  assert.equal(selector.select([frame("left", 0.95, 301)])?.handedness, "left");
});

test("falls back to confidence for unknown handedness and resets cleanly", () => {
  const selector = new PrimaryHandSelector();
  const low = frame("unknown", 0.6, 0);
  const high = frame("unknown", 0.9, 0);

  assert.equal(selector.select([low, high]), high);
  assert.equal(selector.select([]), null);
  selector.reset();
  assert.equal(selector.select([frame("left", 0.7, 10)])?.handedness, "left");
});
