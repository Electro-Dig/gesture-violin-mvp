# VSCO 2 CE solo violin samples

The runtime violin samples are derived from the `Solo Violin / Arco Vib` recordings in VS Chamber Orchestra 2 Community Edition 1.1.0. The source project releases the library under CC0 1.0 Universal.

Primary sources:

- Official project: <https://versilian-studios.com/vsco-community/>
- Repository: <https://github.com/sgossner/VSCO-2-CE>
- Release 1.1.0: <https://github.com/sgossner/VSCO-2-CE/releases/tag/1.1.0>
- Sample folder: <https://github.com/sgossner/VSCO-2-CE/tree/master/Strings/Solo%20Violin/Arco%20Vib>
- Official SFZ mapping: <https://raw.githubusercontent.com/sgossner/VSCO-2-CE/SFZ/SViolinVib.sfz>

`source-manifest.json` pins the release tag and selected root notes. `source-lock.json` records the SHA-256 and byte length of every downloaded WAV. Raw WAV files stay in the ignored `.cache` directory and are not committed.

The importer keeps the first 7.5 seconds of every recording, which preserves its bow attack and a long steady sustain while bringing the twelve-file payload under 1.5 MB. It then applies the same FFmpeg transform to every layer: mono, 44.1 kHz, a safe peak limiter at 0.92, and 128 kbps MP3. It deliberately does not loudness-normalize the p and f layers independently, so their recorded tonal and dynamic relationship is retained. Generated files and their hashes are written to `public/audio/violin/vsco2-ce/` and `src/audio/generated/violinSampleManifest.ts`.

Regenerate and verify:

```bash
pnpm audio:lock
pnpm audio:import
```

Use `audio:lock` only when intentionally accepting a newly downloaded immutable source set. Normal builds and reviews should use `audio:import`, which rejects source bytes that differ from the checked-in lock.
