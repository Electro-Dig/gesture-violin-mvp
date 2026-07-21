import type { HandFrame } from "./types";

export type PrimaryHandSelectorOptions = {
  switchMargin: number;
  holdMs: number;
};

const DEFAULT_OPTIONS: PrimaryHandSelectorOptions = {
  switchMargin: 0.12,
  holdMs: 300,
};

export class PrimaryHandSelector {
  private readonly options: PrimaryHandSelectorOptions;
  private selectedHandedness: Exclude<HandFrame["handedness"], "unknown"> | null = null;
  private selectedAtMs = 0;

  constructor(options: Partial<PrimaryHandSelectorOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  select(hands: HandFrame[]): HandFrame | null {
    if (hands.length === 0) {
      return null;
    }

    const ranked = [...hands].sort((a, b) => b.confidence - a.confidence);
    const best = ranked[0]!;
    const nowMs = Math.max(...ranked.map((hand) => hand.timestampMs));

    if (!this.selectedHandedness) {
      this.acquire(best, nowMs);
      return best;
    }

    const selected = ranked.find(
      (hand) => hand.handedness === this.selectedHandedness,
    );
    const unknown = ranked.find((hand) => hand.handedness === "unknown");
    const holdElapsed = nowMs - this.selectedAtMs >= this.options.holdMs;

    if (!selected) {
      if (!holdElapsed) {
        return unknown ?? null;
      }

      this.acquire(best, nowMs);
      return best;
    }

    const competitor = ranked.find(
      (hand) =>
        hand.handedness !== "unknown"
        && hand.handedness !== this.selectedHandedness,
    );

    if (
      holdElapsed
      && competitor
      && competitor.confidence >= selected.confidence + this.options.switchMargin
    ) {
      this.acquire(competitor, nowMs);
      return competitor;
    }

    return selected;
  }

  reset(): void {
    this.selectedHandedness = null;
    this.selectedAtMs = 0;
  }

  private acquire(hand: HandFrame, nowMs: number): void {
    if (hand.handedness !== "unknown") {
      this.selectedHandedness = hand.handedness;
      this.selectedAtMs = nowMs;
    }
  }
}
