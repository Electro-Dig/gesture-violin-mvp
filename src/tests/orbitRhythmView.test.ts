import assert from "node:assert/strict";
import test from "node:test";

import type { OrbitCue } from "../ui/orbitRhythmModel";
import { orbitCueAttributes } from "../ui/orbitRhythmView";

test("maps a current left-hand cue onto the normalized orbit", () => {
  const cue: OrbitCue = {
    id: "note-4",
    midi: 67,
    noteName: "G4",
    angleDeg: 214,
    sweepDeg: 38,
    expectedDirection: -1,
    state: "current",
    beatDistance: 0,
  };

  const attributes = orbitCueAttributes(cue);

  assert.equal(attributes.pathLength, 360);
  assert.equal(attributes.dasharray, "38 322");
  assert.match(attributes.className, /direction-left/);
  assert.match(attributes.className, /is-current/);
  assert.equal(attributes.directionSymbol, "←");
});
