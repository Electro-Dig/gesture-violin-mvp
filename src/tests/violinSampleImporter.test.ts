import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSourceEntries,
  ffmpegArguments,
  type ViolinSourceManifest,
} from "../../scripts/lib/violinSampleImporter";

const manifest: ViolinSourceManifest = {
  library: "VSCO 2 CE",
  version: "1.1.0",
  sourceBaseUrl:
    "https://raw.githubusercontent.com/sgossner/VSCO-2-CE/1.1.0/Strings/Solo%20Violin/Arco%20Vib",
  cacheDirectory: "audio-sources/vsco2-ce/.cache",
  outputDirectory: "public/audio/violin/vsco2-ce",
  roots: [
    { note: "C4", midi: 60 },
    { note: "E4", midi: 64 },
    { note: "G4", midi: 67 },
    { note: "A4", midi: 69 },
    { note: "C5", midi: 72 },
    { note: "E5", midi: 76 },
  ],
  dynamics: ["p", "f"],
};

test("builds the immutable twelve-file VSCO source matrix", () => {
  const entries = buildSourceEntries(manifest);

  assert.equal(entries.length, 12);
  assert.equal(new Set(entries.map((entry) => entry.id)).size, 12);
  assert.deepEqual(
    [...new Set(entries.map((entry) => entry.rootNote))],
    ["C4", "E4", "G4", "A4", "C5", "E5"],
  );
  assert.deepEqual([...new Set(entries.map((entry) => entry.dynamic))], ["p", "f"]);
  entries.forEach((entry) => {
    assert.match(entry.sourceUrl, /\/1\.1\.0\/Strings\/Solo%20Violin\/Arco%20Vib\//);
    assert.match(entry.sourceFile, /^audio-sources\/vsco2-ce\/\.cache\//);
    assert.match(entry.outputFile, /^public\/audio\/violin\/vsco2-ce\/[a-z0-9-]+\.mp3$/);
  });
});

test("uses one stable mono 44.1 kHz MP3 transform for every layer", () => {
  assert.deepEqual(ffmpegArguments("source.wav", "output.mp3"), [
    "-y",
    "-i",
    "source.wav",
    "-ac",
    "1",
    "-ar",
    "44100",
    "-af",
    "aresample=resampler=soxr,alimiter=limit=0.92",
    "-codec:a",
    "libmp3lame",
    "-b:a",
    "128k",
    "-write_xing",
    "0",
    "output.mp3",
  ]);
});
