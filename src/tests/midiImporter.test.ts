import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  importMidiPiece,
  renderGeneratedMelody,
  type MidiImportManifest,
  extractMonophonicTrack,
  extractSkyline,
  quantizeBeat,
} from "../../scripts/lib/midiImporter";

test("quantizes to eighth-beat boundaries", () => {
  assert.equal(quantizeBeat(1.24), 1);
  assert.equal(quantizeBeat(1.26), 1.5);
});

test("skyline chooses the highest pitch in each active interval", () => {
  const notes = [
    { midi: 60, startBeat: 0, durationBeats: 2, velocity: 0.7 },
    { midi: 67, startBeat: 1, durationBeats: 1, velocity: 0.8 },
  ];
  assert.deepEqual(extractSkyline(notes), [
    { midi: 60, startBeat: 0, durationBeats: 1, dynamic: 0.7 },
    { midi: 67, startBeat: 1, durationBeats: 1, dynamic: 0.8 },
  ]);
});

test("monophonic extraction rejects overlaps", () => {
  assert.throws(
    () => extractMonophonicTrack([
      { midi: 60, startBeat: 0, durationBeats: 2, velocity: 0.7 },
      { midi: 62, startBeat: 1, durationBeats: 1, velocity: 0.7 },
    ]),
    /overlap/i,

  );
});
const PROJECT_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const MANIFEST = JSON.parse(
  readFileSync(
    new URL("../../music-sources/manifest.json", import.meta.url),
    "utf8",
  ),
) as MidiImportManifest;

test("imports the reviewed sources deterministically", async () => {
  const [odeConfig, canonConfig] = MANIFEST.pieces;
  assert.ok(odeConfig);
  assert.ok(canonConfig);

  const ode = await importMidiPiece(PROJECT_ROOT, odeConfig);
  const canon = await importMidiPiece(PROJECT_ROOT, canonConfig);

  assert.deepEqual(
    ode.notes.slice(0, 7).map((note) => note.midi),
    [64, 64, 65, 67, 67, 65, 64],
  );
  assert.deepEqual(
    canon.notes.slice(0, 8).map((note) => note.midi),
    [74, 73, 71, 69, 67, 66, 67, 71],
  );

  for (const [config, result] of [
    [odeConfig, ode],
    [canonConfig, canon],
  ] as const) {
    result.notes.forEach((note, index) => {
      const previous = result.notes[index - 1];
      assert.equal(Number.isInteger(note.startBeat * 2), true);
      assert.equal(Number.isInteger(note.durationBeats * 2), true);
      assert.ok(note.startBeat >= 0);
      assert.ok(
        note.startBeat + note.durationBeats
        <= config.sourceBeats[1] - config.sourceBeats[0],
      );
      if (previous) {
        assert.ok(
          note.startBeat
          >= previous.startBeat + previous.durationBeats,
        );
      }
    });

    const second = await importMidiPiece(PROJECT_ROOT, config);
    assert.equal(
      renderGeneratedMelody(config, second),
      renderGeneratedMelody(config, result),
    );
    assert.equal(
      renderGeneratedMelody(config, result).includes(PROJECT_ROOT),
      false,
    );
  }
});
