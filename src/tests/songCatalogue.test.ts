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

test("Ode to Joy uses five broad beginner lanes", () => {
  assert.deepEqual(ODE_TO_JOY.pitchLanes, [60, 62, 64, 65, 67]);
  assert.deepEqual(uniqueMidi(ODE_TO_JOY), [60, 62, 64, 65, 67]);
  assert.ok(ODE_TO_JOY.totalBeats >= 44 && ODE_TO_JOY.totalBeats <= 52);
});

test("Canon stays inside seven D-major pitch lanes", () => {
  assert.deepEqual(CANON_IN_D.pitchLanes, [62, 64, 66, 67, 69, 71, 73]);
  assert.deepEqual(uniqueMidi(CANON_IN_D), [62, 64, 66, 67, 69, 71, 73]);
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
