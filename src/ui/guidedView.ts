import type { GuidedSongFrame } from "../music/guidedSongEngine";
import type { ScoreBreakdown, SongDefinition, SongId } from "../music/songTypes";
import { buildGuidedDisplay } from "./guidedViewModel";
import type { MeasureOverview, OrbitCue } from "./orbitRhythmModel";
import { orbitCueAttributes } from "./orbitRhythmView";

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
  private readonly orbitCues: SVGElement;
  private readonly orbitHitZone: SVGGElement;
  private readonly measureLabel: HTMLElement;
  private readonly phraseLabel: HTMLElement;
  private readonly measureTicks: HTMLElement;
  private readonly cueNodes = new Map<string, OrbitCueNode>();
  private lastMeasureKey = "";
  private lastJudgmentPulseKey: string | null = null;
  private measureTickCount = 0;
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
    this.orbitCues = requireElement(root, "#orbit-cues", SVGElement);
    this.orbitHitZone = requireElement(root, "#orbit-hit-zone", SVGGElement);
    this.measureLabel = requireElement(root, "#measure-label", HTMLElement);
    this.phraseLabel = requireElement(root, "#phrase-label", HTMLElement);
    this.measureTicks = requireElement(root, "#measure-ticks", HTMLElement);
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
    this.lastJudgmentPulseKey = null;
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
    this.updateOrbit(display.orbitCues);
    this.updateMeasure(display.measureOverview);
    this.directionSymbol.textContent = display.directionSymbol;
    this.directionMessage.textContent = display.directionMessage;
    this.rhythmHelper.textContent = display.helperMessage;
    this.timingFeedback.dataset.tone = display.timingTone;
    this.timingFeedback.dataset.note = String(frame.lastJudgmentNoteIndex);
    this.timingFeedback.textContent = display.timingLabel;
    this.orbitHitZone.dataset.tone = display.timingTone;
    if (
      display.judgmentPulseKey
      && display.judgmentPulseKey !== this.lastJudgmentPulseKey
      && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
      && typeof this.orbitHitZone.animate === "function"
    ) {
      this.orbitHitZone.animate(
        [
          { opacity: 0.55, transform: "scale(0.96)" },
          { opacity: 1, transform: "scale(1.08)", offset: 0.38 },
          { opacity: 0.72, transform: "scale(1)" },
        ],
        {
          duration: 520,
          easing: "cubic-bezier(.22,.8,.28,1)",
        },
      );
    }
    this.lastJudgmentPulseKey = display.judgmentPulseKey;
    this.countIn.hidden = frame.phase !== "countIn";
    this.countNumber.textContent = String(frame.countdown);
  }

  private updateOrbit(cues: OrbitCue[]): void {
    const activeIds = new Set(cues.map((cue) => cue.id));

    cues.forEach((cue) => {
      let node = this.cueNodes.get(cue.id);
      if (!node) {
        node = createOrbitCueNode(cue.id);
        this.cueNodes.set(cue.id, node);
        this.orbitCues.append(node.group);
      }

      const attributes = orbitCueAttributes(cue);
      node.group.setAttribute("class", attributes.className);
      node.group.setAttribute("opacity", String(attributes.opacity));
      node.group.dataset.state = cue.state;
      node.arc.setAttribute("pathLength", String(attributes.pathLength));
      node.arc.setAttribute("stroke-dasharray", attributes.dasharray);
      node.arc.setAttribute(
        "transform",
        `rotate(${attributes.rotationDeg} 50 50)`,
      );
      node.point.setAttribute("cx", String(attributes.labelX));
      node.point.setAttribute("cy", String(attributes.labelY));
      node.label.setAttribute("x", String(attributes.labelX));
      node.label.setAttribute("y", String(attributes.labelY));
      node.label.textContent = `${cue.noteName} ${attributes.directionSymbol}`;
      node.label.dataset.visible = String(
        cue.state === "current"
        || (cue.state === "upcoming" && cue.beatDistance <= 3),
      );

      if (
        cue.state === "current"
        && this.orbitCues.lastElementChild !== node.group
      ) {
        this.orbitCues.append(node.group);
      }
    });

    this.cueNodes.forEach((node, id) => {
      if (!activeIds.has(id)) {
        node.group.remove();
        this.cueNodes.delete(id);
      }
    });
  }

  private updateMeasure(overview: MeasureOverview): void {
    const measureKey = [
      overview.currentMeasure,
      overview.totalMeasures,
      overview.currentPhrase,
      overview.totalPhrases,
    ].join("/");

    if (measureKey !== this.lastMeasureKey) {
      this.measureLabel.textContent =
        `\u5c0f\u8282 ${padTwo(overview.currentMeasure)} / ${padTwo(overview.totalMeasures)}`;
      this.phraseLabel.textContent =
        `\u4e50\u53e5 ${padTwo(overview.currentPhrase)} / ${padTwo(overview.totalPhrases)}`;
      this.lastMeasureKey = measureKey;
    }

    if (overview.totalMeasures !== this.measureTickCount) {
      const ticks = Array.from(
        { length: Math.max(overview.totalMeasures - 1, 0) },
        (_, index) => {
          const tick = document.createElement("i");
          tick.style.left = `${((index + 1) / overview.totalMeasures) * 100}%`;
          return tick;
        },
      );
      this.measureTicks.replaceChildren(...ticks);
      this.measureTickCount = overview.totalMeasures;
    }
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

type OrbitCueNode = {
  group: SVGGElement;
  arc: SVGCircleElement;
  point: SVGCircleElement;
  label: SVGTextElement;
};

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

function createOrbitCueNode(id: string): OrbitCueNode {
  const group = document.createElementNS(SVG_NAMESPACE, "g");
  group.dataset.cueId = id;

  const arc = document.createElementNS(SVG_NAMESPACE, "circle");
  arc.setAttribute("class", "orbit-cue-arc");
  arc.setAttribute("cx", "50");
  arc.setAttribute("cy", "50");
  arc.setAttribute("r", "42");
  arc.setAttribute("fill", "none");

  const point = document.createElementNS(SVG_NAMESPACE, "circle");
  point.setAttribute("class", "orbit-cue-point");
  point.setAttribute("r", "1.25");

  const label = document.createElementNS(SVG_NAMESPACE, "text");
  label.setAttribute("class", "orbit-cue-label");
  label.setAttribute("text-anchor", "middle");

  group.append(arc, point, label);
  return { group, arc, point, label };
}

function padTwo(value: number): string {
  return String(value).padStart(2, "0");
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
