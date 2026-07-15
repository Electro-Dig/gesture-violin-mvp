import type { GuidedSongFrame } from "../music/guidedSongEngine";
import type { ScoreBreakdown, SongDefinition, SongId } from "../music/songTypes";
import { buildGuidedDisplay } from "./guidedViewModel";
import type { RhythmCue } from "./rhythmStripModel";

export class GuidedView {
  readonly songButtons: HTMLButtonElement[];
  readonly replayButton: HTMLButtonElement;
  readonly resultSongsButton: HTMLButtonElement;
  readonly resultFreeButton: HTMLButtonElement;
  readonly hudSongsButton: HTMLButtonElement;
  readonly closeSongsButton: HTMLButtonElement;

  private readonly songSelect: HTMLElement;
  private readonly hud: HTMLElement;
  private readonly result: HTMLElement;
  private readonly countIn: HTMLElement;
  private readonly countNumber: HTMLElement;
  private readonly songTitle: HTMLElement;
  private readonly songComposer: HTMLElement;
  private readonly noteName: HTMLElement;
  private readonly upcoming: HTMLElement;
  private readonly progress: HTMLElement;
  private readonly progressLabel: HTMLElement;
  private readonly score: HTMLElement;
  private readonly cues: HTMLElement;
  private readonly bowCursor: HTMLElement;
  private readonly directionSymbol: HTMLElement;
  private readonly directionMessage: HTMLElement;
  private readonly rhythmHelper: HTMLElement;
  private readonly timingFeedback: HTMLElement;
  private readonly resultTitle: HTMLElement;
  private readonly resultScore: HTMLElement;
  private readonly resultStars: HTMLElement[];
  private readonly resultTiming: HTMLElement;
  private readonly resultContinuity: HTMLElement;
  private readonly resultExpression: HTMLElement;

  constructor(root: HTMLElement) {
    this.songSelect = requireElement(root, "#song-select", HTMLElement);
    this.hud = requireElement(root, "#guided-hud", HTMLElement);
    this.result = requireElement(root, "#guided-result", HTMLElement);
    this.countIn = requireElement(root, "#guided-count-in", HTMLElement);
    this.countNumber = requireElement(root, "#count-number", HTMLElement);
    this.songTitle = requireElement(root, "#guided-song-title", HTMLElement);
    this.songComposer = requireElement(root, "#guided-song-composer", HTMLElement);
    this.noteName = requireElement(root, "#guided-note", HTMLElement);
    this.upcoming = requireElement(root, "#guided-upcoming", HTMLElement);
    this.progress = requireElement(root, "#guided-progress", HTMLElement);
    this.progressLabel = requireElement(root, "#guided-progress-label", HTMLElement);
    this.score = requireElement(root, "#guided-score", HTMLElement);
    this.cues = requireElement(root, "#rhythm-cues", HTMLElement);
    this.bowCursor = requireElement(root, "#bow-cursor", HTMLElement);
    this.directionSymbol = requireElement(root, "#direction-symbol", HTMLElement);
    this.directionMessage = requireElement(root, "#direction-message", HTMLElement);
    this.rhythmHelper = requireElement(root, "#rhythm-helper", HTMLElement);
    this.timingFeedback = requireElement(root, "#timing-feedback", HTMLElement);
    this.resultTitle = requireElement(root, "#result-title", HTMLElement);
    this.resultScore = requireElement(root, "#result-score", HTMLElement);
    this.resultStars = Array.from(root.querySelectorAll<HTMLElement>("[data-result-star]"));
    this.resultTiming = requireElement(root, "#result-timing", HTMLElement);
    this.resultContinuity = requireElement(root, "#result-continuity", HTMLElement);
    this.resultExpression = requireElement(root, "#result-expression", HTMLElement);
    this.replayButton = requireElement(root, "#replay-song", HTMLButtonElement);
    this.resultSongsButton = requireElement(root, "#result-songs", HTMLButtonElement);
    this.resultFreeButton = requireElement(root, "#result-free", HTMLButtonElement);
    this.hudSongsButton = requireElement(root, "#hud-songs", HTMLButtonElement);
    this.closeSongsButton = requireElement(root, "#close-songs", HTMLButtonElement);
    this.songButtons = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-song-id]"));
  }

  showSongSelect(): void {
    this.songSelect.hidden = false;
    this.hud.hidden = true;
    this.result.hidden = true;
    this.countIn.hidden = true;
  }

  hideSongSelect(): void {
    this.songSelect.hidden = true;
  }

  setBusy(busy: boolean): void {
    this.songButtons.forEach((button) => {
      button.disabled = busy;
    });
    this.songSelect.dataset.busy = String(busy);
  }

  selectedSongId(button: HTMLButtonElement): SongId {
    return button.dataset.songId as SongId;
  }

  start(song: SongDefinition): void {
    this.songSelect.hidden = true;
    this.result.hidden = true;
    this.hud.hidden = false;
    this.songTitle.textContent = song.title;
    this.songComposer.textContent = song.composer;
  }

  update(song: SongDefinition, frame: GuidedSongFrame): void {
    const display = buildGuidedDisplay(song, frame);
    this.noteName.textContent = display.noteName;
    this.upcoming.textContent = display.upcomingLabel;
    this.progress.style.setProperty("--progress", `${display.progressPercent}%`);
    this.progressLabel.textContent = display.progressLabel;
    this.score.textContent = display.scoreLabel;
    this.cues.replaceChildren(...display.cues.map(createCueElement));
    this.bowCursor.style.left = `${display.cursorLeft}%`;
    this.directionSymbol.textContent = display.directionSymbol;
    this.directionMessage.textContent = display.directionMessage;
    this.rhythmHelper.textContent = display.helperMessage;
    this.timingFeedback.dataset.tone = display.timingTone;
    this.timingFeedback.dataset.note = String(frame.lastJudgmentNoteIndex);
    this.timingFeedback.textContent = display.timingLabel;
    this.countIn.hidden = frame.phase !== "countIn";
    this.countNumber.textContent = String(frame.countdown);
  }

  showResult(song: SongDefinition, score: ScoreBreakdown): void {
    this.countIn.hidden = true;
    this.hud.hidden = true;
    this.result.hidden = false;
    this.resultTitle.textContent = song.title;
    this.resultScore.textContent = String(score.total);
    this.resultTiming.textContent = String(score.timing);
    this.resultContinuity.textContent = String(score.continuity);
    this.resultExpression.textContent = String(score.expression);
    this.resultStars.forEach((star, index) => {
      star.dataset.earned = String(index < score.stars);
    });
  }

  hide(): void {
    this.songSelect.hidden = true;
    this.hud.hidden = true;
    this.result.hidden = true;
    this.countIn.hidden = true;
  }
}

function createCueElement(cue: RhythmCue): HTMLElement {
  const element = document.createElement("div");
  element.className = "rhythm-cue";
  element.dataset.state = cue.state;
  element.dataset.judged = String(cue.judged);
  element.dataset.judgment = cue.judgment;
  element.style.setProperty("--cue-top", `${cue.topPercent}%`);
  element.style.setProperty("--cue-height", `${cue.heightPercent}%`);

  const stem = document.createElement("i");
  const note = document.createElement("span");
  note.textContent = cue.noteName;
  const direction = document.createElement("b");
  direction.textContent = cue.expectedDirection > 0 ? "→" : "←";
  element.append(stem, note, direction);
  return element;
}

function requireElement<T extends Element>(
  root: ParentNode,
  selector: string,
  constructor: { new (): T },
): T {
  const element = root.querySelector(selector);
  if (!(element instanceof constructor)) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}
