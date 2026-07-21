import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { sha256File } from "../../scripts/lib/violinSampleImporter";
import { VIOLIN_SAMPLE_MANIFEST } from "../audio/generated/violinSampleManifest";

type SourceLock = {
  files: Array<{ id: string; sha256: string }>;
};

const root = process.cwd();

test("the checked-in runtime set contains every licensed root and dynamic", async () => {
  assert.equal(VIOLIN_SAMPLE_MANIFEST.length, 12);
  assert.deepEqual(
    VIOLIN_SAMPLE_MANIFEST.map((sample) => `${sample.rootNote}-${sample.dynamic}`).sort(),
    [
      "A4-f", "A4-p", "C4-f", "C4-p", "C5-f", "C5-p",
      "E4-f", "E4-p", "E5-f", "E5-p", "G4-f", "G4-p",
    ],
  );

  const lock = JSON.parse(
    await readFile(path.join(root, "audio-sources", "vsco2-ce", "source-lock.json"), "utf8"),
  ) as SourceLock;
  const lockedHashes = new Map(lock.files.map((file) => [file.id, file.sha256]));
  let totalBytes = 0;

  for (const sample of VIOLIN_SAMPLE_MANIFEST) {
    const outputPath = path.join(root, "public", ...sample.url.slice(1).split("/"));
    const outputStats = await stat(outputPath);
    totalBytes += outputStats.size;
    assert.equal(outputStats.size, sample.bytes, `${sample.id} byte count`);
    assert.equal(await sha256File(outputPath), sample.outputSha256, `${sample.id} output SHA-256`);
    assert.equal(lockedHashes.get(sample.id), sample.sourceSha256, `${sample.id} source SHA-256`);
    assert.ok(Number.isFinite(sample.durationSeconds) && sample.durationSeconds > 0);
  }

  await stat(path.join(root, "audio-sources", "vsco2-ce", "LICENSE-CC0.txt"));
  assert.ok(totalBytes > 0);
  assert.ok(totalBytes <= 1_500_000, `sample payload is ${totalBytes} bytes`);
});
