import type { SongDefinition, SongId } from "../songTypes";
import { ODE_TO_JOY } from "./odeToJoy";

export const SONG_CATALOGUE: readonly SongDefinition[] = [ODE_TO_JOY];

export function getSong(id: SongId): SongDefinition {
  const song = SONG_CATALOGUE.find((candidate) => candidate.id === id);
  if (!song) throw new Error(`Unknown song: ${id}`);
  return song;
}
