import type { SongDefinition } from "./songTypes";

export function validateSong(song: SongDefinition): string[] {
  const errors: string[] = [];
  if (song.bpm <= 0) errors.push("bpm must be positive");
  if (song.totalBeats <= 0) errors.push("totalBeats must be positive");
  if (song.melody.length === 0) errors.push("melody must not be empty");
  if (song.pitchLanes.length === 0) errors.push("pitch lanes must not be empty");

  const source = song.source;
  if (!source || !/^https:\/\//.test(source.url ?? "")) {
    errors.push("source.url must be an HTTPS URL");
  }
  if (!source || !["Public Domain", "CC BY 3.0"].includes(source.license)) {
    errors.push("source.license must be supported");
  }
  if (!source?.sourceFile?.trim()) {
    errors.push("sourceFile must not be empty");
  }
  if (!source || !Number.isInteger(source.sourceTrack) || source.sourceTrack < 0) {
    errors.push("sourceTrack must be a non-negative integer");
  }
  if (
    !source
    || source.sourceBeats[0] < 0
    || source.sourceBeats[1] <= source.sourceBeats[0]
  ) {
    errors.push("sourceBeats must define an increasing non-negative range");
  }
  if (!source || !/^[a-f\d]{64}$/i.test(source.sha256)) {
    errors.push("sha256 must be a 64-character hexadecimal digest");
  }
  if (
    !song.arrangement
    || song.arrangement.transformations.length === 0
    || song.arrangement.transformations.some((statement) => !statement.trim())
  ) {
    errors.push("arrangement.transformations must explain at least one transformation");
  }

  song.melody.forEach((note, index) => {
    if (note.startBeat < 0) errors.push(`melody[${index}].startBeat must be non-negative`);
    if (note.durationBeats <= 0) errors.push(`melody[${index}].duration must be positive`);
    if (note.dynamic < 0 || note.dynamic > 1) errors.push(`melody[${index}].dynamic must be 0..1`);
    if (!song.pitchLanes.includes(note.midi)) errors.push(`melody[${index}] midi must belong to a pitch lane`);
    if (note.startBeat + note.durationBeats > song.totalBeats) errors.push(`melody[${index}] exceeds totalBeats`);
    const previous = song.melody[index - 1];
    if (previous && note.startBeat < previous.startBeat + previous.durationBeats) {
      errors.push(`melody[${index}] overlaps the previous note`);
    }
  });

  song.accompaniment.forEach((event, index) => {
    if (event.startBeat < 0 || event.startBeat >= song.totalBeats) {
      errors.push(`accompaniment[${index}].startBeat is outside the song`);
    }
    if (event.durationBeats <= 0) errors.push(`accompaniment[${index}].duration must be positive`);
    if (event.midi.length === 0) errors.push(`accompaniment[${index}] must contain MIDI notes`);
    if (event.velocity < 0 || event.velocity > 1) errors.push(`accompaniment[${index}].velocity must be 0..1`);
  });

  return errors;
}
