import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  importMidiPiece,
  renderGeneratedMelody,
  type MidiImportManifest,
} from "./lib/midiImporter";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(
  await readFile(
    new URL("../music-sources/manifest.json", import.meta.url),
    "utf8",
  ),
) as MidiImportManifest;

if (manifest.version !== 1) {
  throw new Error(`Unsupported MIDI manifest version: ${manifest.version}`);
}

for (const config of manifest.pieces) {
  const result = await importMidiPiece(projectRoot, config);
  const outputPath = resolve(projectRoot, config.output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    renderGeneratedMelody(config, result),
    "utf8",
  );

  const totalBeats = config.sourceBeats[1] - config.sourceBeats[0];
  console.log(
    [
      `[music:import] ${config.songId}`,
      `sha256=${result.sha256}`,
      `track=${result.sourceTrack}`,
      `notes=${result.notes.length}`,
      `beats=0..${totalBeats}`,
    ].join(" "),
  );
}
