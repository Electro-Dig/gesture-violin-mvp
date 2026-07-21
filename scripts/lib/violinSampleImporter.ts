import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

export type ViolinDynamic = "p" | "f";

export type ViolinSourceManifest = {
  library: string;
  version: string;
  sourceBaseUrl: string;
  cacheDirectory: string;
  outputDirectory: string;
  roots: Array<{ note: string; midi: number }>;
  dynamics: ViolinDynamic[];
};

export type ViolinSourceEntry = {
  id: string;
  rootMidi: number;
  rootNote: string;
  dynamic: ViolinDynamic;
  sourceUrl: string;
  sourceFile: string;
  outputFile: string;
};

export function buildSourceEntries(manifest: ViolinSourceManifest): ViolinSourceEntry[] {
  if (manifest.version !== "1.1.0") {
    throw new Error(`Unsupported VSCO version: ${manifest.version}`);
  }
  if (!manifest.sourceBaseUrl.includes(`/${manifest.version}/`)) {
    throw new Error("The source URL must include the pinned release version");
  }

  const entries = manifest.roots.flatMap((root) =>
    manifest.dynamics.map((dynamic) => {
      const id = `${root.note.toLowerCase()}-${dynamic}`;
      const sourceName = `LLVln_ArcoVib_${root.note}_${dynamic}.wav`;
      return {
        id,
        rootMidi: root.midi,
        rootNote: root.note,
        dynamic,
        sourceUrl: `${manifest.sourceBaseUrl}/${sourceName}`,
        sourceFile: projectPath(manifest.cacheDirectory, sourceName),
        outputFile: projectPath(manifest.outputDirectory, `${id}.mp3`),
      };
    }),
  );

  if (entries.length !== 12 || new Set(entries.map((entry) => entry.id)).size !== 12) {
    throw new Error(`Expected twelve unique violin sources, received ${entries.length}`);
  }
  return entries;
}

export function ffmpegArguments(sourcePath: string, outputPath: string): string[] {
  return [
    "-y",
    "-i",
    sourcePath,
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
    outputPath,
  ];
}

export async function sha256File(filePath: string): Promise<string> {
  const bytes = await readFile(filePath);
  return createHash("sha256").update(bytes).digest("hex");
}

function projectPath(...parts: string[]): string {
  return path.posix.join(...parts.map((part) => part.replaceAll("\\", "/")));
}
