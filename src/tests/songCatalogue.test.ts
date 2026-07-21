import assert from "node:assert/strict";
import test from "node:test";

import { CANON_IN_D } from "../music/songs/canonInD";
import { SONG_CATALOGUE } from "../music/songs/catalogue";
import { ODE_TO_JOY } from "../music/songs/odeToJoy";
import type { SongDefinition } from "../music/songTypes";
import { validateSong } from "../music/songValidation";

test("the catalogue contains two valid curated arrangements", () => {
  assert.deepEqual(
    SONG_CATALOGUE.map((song) => song.id),
    ["ode-to-joy", "canon-in-d"],
  );
  for (const song of SONG_CATALOGUE) {
    assert.deepEqual(validateSong(song), [], `${song.title} should be valid`);
  }
});

test("validation requires traceable score provenance", () => {
  const invalid = {
    ...ODE_TO_JOY,
    source: {
      url: "http://example.com/score.mid",
      license: "",
      sourceFile: "",
      sourceTrack: -1,
      sourceBeats: [4, 4],
      sha256: "not-a-hash",
    },
    arrangement: {
      kind: "tutorial-excerpt",
      transposeSemitones: 0,
      melodyStrategy: "skyline",
      transformations: [],
    },
  } as unknown as SongDefinition;

  const errors = validateSong(invalid);
  assert.ok(errors.some((error) => error.includes("source.url")));
  assert.ok(errors.some((error) => error.includes("source.license")));
  assert.ok(errors.some((error) => error.includes("sourceFile")));
  assert.ok(errors.some((error) => error.includes("sourceTrack")));
  assert.ok(errors.some((error) => error.includes("sourceBeats")));
  assert.ok(errors.some((error) => error.includes("sha256")));
  assert.ok(errors.some((error) => error.includes("transformations")));
});

test("uses the imported Ode to Joy melody", () => {
  assert.deepEqual(
    ODE_TO_JOY.melody.slice(0, 7).map((note) => note.midi),
    [64, 64, 65, 67, 67, 65, 64],
  );
  assert.equal(ODE_TO_JOY.source.license, "Public Domain");
  assert.equal(ODE_TO_JOY.arrangement.melodyStrategy, "skyline");
});

test("uses the imported Canon melody", () => {
  assert.deepEqual(
    CANON_IN_D.melody.slice(0, 8).map((note) => note.midi),
    [74, 73, 71, 69, 67, 66, 67, 71],
  );
  assert.equal(CANON_IN_D.source.license, "CC BY 3.0");
  assert.equal(CANON_IN_D.arrangement.melodyStrategy, "monophonic-track");
});

test("Ode to Joy derives pitch lanes from the imported excerpt", () => {
  assert.deepEqual(ODE_TO_JOY.pitchLanes, [55, 60, 62, 64, 65, 67]);
  assert.deepEqual(ODE_TO_JOY.pitchLanes, uniqueMidi(ODE_TO_JOY));
  assert.ok(ODE_TO_JOY.totalBeats >= 44 && ODE_TO_JOY.totalBeats <= 52);
});

test("Canon derives pitch lanes from the imported excerpt", () => {
  assert.deepEqual(
    CANON_IN_D.pitchLanes,
    [55, 57, 59, 61, 62, 64, 66, 67, 69, 71, 73, 74, 76, 78],
  );
  assert.deepEqual(CANON_IN_D.pitchLanes, uniqueMidi(CANON_IN_D));
  assert.ok(CANON_IN_D.totalBeats >= 76 && CANON_IN_D.totalBeats <= 84);
});

test("melody and accompaniment events are ordered inside every song", () => {
  for (const song of SONG_CATALOGUE) {
    for (let index = 0; index < song.melody.length; index += 1) {
      const note = song.melody[index]!;
      const previous = song.melody[index - 1];
      assert.ok(note.durationBeats > 0);
      assert.ok(note.startBeat >= 0);
      assert.ok(note.startBeat + note.durationBeats <= song.totalBeats);
      if (previous) {
        assert.ok(note.startBeat >= previous.startBeat + previous.durationBeats);
      }
    }
    for (const event of song.accompaniment) {
      assert.ok(event.startBeat >= 0 && event.startBeat < song.totalBeats);
      assert.ok(event.durationBeats > 0);
      assert.ok(event.midi.length > 0);
    }
  }
});

test("validation reports concrete authoring errors", () => {
  const invalid: SongDefinition = {
    ...ODE_TO_JOY,
    melody: [{ midi: 99, startBeat: -1, durationBeats: 0, dynamic: 2, phrase: 0 }],
  };

  const errors = validateSong(invalid);
  assert.ok(errors.some((error) => error.includes("startBeat")));
  assert.ok(errors.some((error) => error.includes("duration")));
  assert.ok(errors.some((error) => error.includes("dynamic")));
  assert.ok(errors.some((error) => error.includes("pitch lane")));
});

function uniqueMidi(song: SongDefinition): number[] {
  return [...new Set(song.melody.map((note) => note.midi))].sort((a, b) => a - b);
}
