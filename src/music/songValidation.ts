import type { SongDefinition } from "./songTypes";

export function validateSong(song: SongDefinition): string[] {
  const errors: string[] = [];
  if (song.bpm <= 0) errors.push("bpm must be positive");
  if (song.totalBeats <= 0) errors.push("totalBeats must be positive");
  if (song.melody.length === 0) errors.push("melody must not be empty");
  if (song.pitchLanes.length === 0) errors.push("pitch lanes must not be empty");

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
