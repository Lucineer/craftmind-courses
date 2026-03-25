/**
 * Discovery Zone — exploration-based learning with progressive hint system.
 *
 * Not everything should be guided. Discovery zones give students a problem to solve
 * on their own, with hints available on request. This teaches:
 *   - Problem-solving skills
 *   - Confidence through independent discovery
 *   - Persistence (the "Aha!" moment is incredibly motivating)
 *
 * Hint progression (3 levels):
 *   Level 0: "Try experimenting with what you've learned!"
 *   Level 1: "Think about how [concept A] relates to [concept B]..."
 *   Level 2: "Here's a specific clue: [targeted hint]"
 *   Level 3: "The answer is: [full explanation]"
 *
 * Achievement tracking: completing a discovery zone with fewer hints = better achievement.
 */

/** @typedef {{level:number, text:string}} Hint */

export class DiscoveryZone {
  /**
   * @param {object} config
   * @param {string} config.id
   * @param {string} config.title
   * @param {string} config.description — the challenge presented to the student
   * @param {string} config.solution — what the student needs to figure out
   * @param {Hint[]} config.hints — 3-4 progressive hints (index 0 = vaguest)
   * @param {string[]} config.concepts — topics this relates to (for adaptive engine)
   * @param {string} [config.realWorldInsight] — connection to real-world concept
   * @param {number} [config.timeLimit] — optional time limit in seconds
   */
  constructor(config) {
    this.id = config.id;
    this.title = config.title;
    this.description = config.description;
    this.solution = config.solution;
    this.hints = config.hints;
    this.concepts = config.concepts ?? [];
    this.realWorldInsight = config.realWorldInsight ?? null;
    this.timeLimit = config.timeLimit ?? null;

    this.hintsUsed = 0;
    this.startTime = Date.now();
    this.solved = false;
    this.abandoned = false;
  }

  /** Request the next hint. Returns hint text or null if all exhausted. */
  requestHint() {
    if (this.hintsUsed >= this.hints.length) return null;
    const hint = this.hints[this.hintsUsed];
    this.hintsUsed++;
    return hint.text;
  }

  /** Get a hint-level-appropriate nudge (not a full hint, just encouragement) */
  getNudge() {
    if (this.hintsUsed === 0) {
      return "Try experimenting! Place some blocks and see what happens. You might be closer than you think! 🔬";
    }
    if (this.hintsUsed < this.hints.length) {
      return `You can ask for another hint if you're stuck. You've used ${this.hintsUsed}/${this.hints.length} so far — try once more on your own first! 💡`;
    }
    return "I've given you all the hints I can. Take your time and think it through.";
  }

  /** Mark as solved */
  solve() {
    this.solved = true;
    this.solveTime = (Date.now() - this.startTime) / 1000;
  }

  /** Mark as abandoned (student couldn't solve it) */
  abandon() {
    this.abandoned = true;
    this.solveTime = (Date.now() - this.startTime) / 1000;
  }

  /** Get quality rating for spaced repetition (0-5) */
  getQualityRating() {
    if (!this.solved) return 0;
    if (this.hintsUsed === 0) return 5;           // perfect independent discovery
    if (this.hintsUsed === 1) return 4;           // minor nudge
    if (this.hintsUsed === 2) return 3;           // some difficulty
    return 2;                                      // needed significant help
  }

  /** Time elapsed in seconds */
  get timeElapsed() {
    return (Date.now() - this.startTime) / 1000;
  }

  /** Is time limit exceeded? */
  get isTimeExceeded() {
    return this.timeLimit && this.timeElapsed > this.timeLimit;
  }

  /** Get summary for achievements */
  getSummary() {
    return {
      id: this.id,
      solved: this.solved,
      hintsUsed: this.hintsUsed,
      totalHints: this.hints.length,
      timeSpent: this.timeElapsed,
      independent: this.solved && this.hintsUsed === 0,
    };
  }
}

/**
 * Create a discovery zone from JSON data (lesson step extension).
 * Discovery zones are embedded in lesson steps with type "discovery".
 *
 * @param {object} raw — from lesson JSON
 * @returns {DiscoveryZone}
 */
export function discoveryFromStep(raw) {
  return new DiscoveryZone({
    id: raw.id,
    title: raw.title,
    description: raw.description,
    solution: raw.solution,
    hints: (raw.hints ?? []).map((text, level) => ({ level, text })),
    concepts: raw.concepts ?? [],
    realWorldInsight: raw.realWorldInsight ?? null,
    timeLimit: raw.timeLimit ?? null,
  });
}
