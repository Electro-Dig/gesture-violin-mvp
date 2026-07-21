import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMeasureOverview,
  buildOrbitCues,
} from "../ui/orbitRhythmModel";
import type { SongDefinition, SongNote } from "../music/songTypes";

function makeSong(melody: SongNote[], totalBeats = 48): SongDefinition {
  return {
    id: "ode-to-joy",
    title: "Test",
    composer: "Test",
    bpm: 76,
    beatsPerBar: 4,
    difficulty: 1,
    durationLabel: "test",
    totalBeats,
    pitchLanes: [...new Set(melody.map((note) => note.midi))],
    melody,
    accompaniment: [],
  };
}

test("places the current note at the hit angle", () => {
  const song = makeSong([
    { midi: 64, startBeat: 4, durationBeats: 1, dynamic: 0.7, phrase: 0 },
  ]);
  const [cue] = buildOrbitCues(song, 4);

  assert.equal(cue?.angleDeg, 214);
  assert.equal(cue?.sweepDeg, 38);
  assert.equal(cue?.state, "current");
  assert.equal(cue?.noteName, "E4");
});

test("encodes note duration and alternating bow direction", () => {
  const song = makeSong([
    { midi: 64, startBeat: 4, durationBeats: 0.5, dynamic: 0.7, phrase: 0 },
    { midi: 67, startBeat: 5, durationBeats: 2, dynamic: 0.8, phrase: 0 },
  ]);
  const cues = buildOrbitCues(song, 4);

  assert.equal(cues[0]?.expectedDirection, 1);
  assert.equal(cues[1]?.expectedDirection, -1);
  assert.ok((cues[1]?.sweepDeg ?? 0) > (cues[0]?.sweepDeg ?? 0));
});

test("reports measure and phrase progress", () => {
  const overview = buildMeasureOverview({
    currentBeat: 17,
    totalBeats: 48,
    beatsPerBar: 4,
    phraseBeats: 16,
  });

  assert.equal(overview.currentMeasure, 5);
  assert.equal(overview.totalMeasures, 12);
  assert.equal(overview.currentPhrase, 2);
  assert.equal(overview.totalPhrases, 3);
});

test("filters cues outside the history and lookahead window", () => {
  const song = makeSong([
    { midi: 60, startBeat: 0, durationBeats: 1, dynamic: 0.5, phrase: 0 },
    { midi: 62, startBeat: 10, durationBeats: 1, dynamic: 0.5, phrase: 0 },
  ]);

  assert.deepEqual(buildOrbitCues(song, 3), []);
});

test("keeps a sustained note current and clamps duration sweeps", () => {
  const song = makeSong([
    { midi: 60, startBeat: 3.5, durationBeats: 0.05, dynamic: 0.5, phrase: 0 },
    { midi: 62, startBeat: 3, durationBeats: 4, dynamic: 0.5, phrase: 0 },
  ]);
  const cues = buildOrbitCues(song, 4);

  assert.equal(cues[0]?.sweepDeg, 7);
  assert.equal(cues[1]?.sweepDeg, 48);
  assert.equal(cues[1]?.state, "current");
});

test("clamps the final partial measure to the song total", () => {
  const overview = buildMeasureOverview({
    currentBeat: 10,
    totalBeats: 10,
    beatsPerBar: 4,
    phraseBeats: 8,
  });

  assert.equal(overview.currentMeasure, 3);
  assert.equal(overview.totalMeasures, 3);
  assert.equal(overview.currentPhrase, 2);
  assert.equal(overview.progress, 1);
});
