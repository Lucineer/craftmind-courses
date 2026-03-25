/**
 * Lesson — represents a single lesson with objectives, steps, quiz questions, and a world template.
 *
 * Step types: "navigate_to", "build_block", "interact_npc", "observe",
 *             "solve_puzzle", "complete_challenge", "discovery"
 */
export class Lesson {
  /**
   * @param {object} data
   * @param {string} data.id
   * @param {string} data.title
   * @param {string} data.description
   * @param {string[]} data.objectives
   * @param {string[]} data.prerequisites
   * @param {number}   data.difficulty        // 1-5
   * @param {number}   data.estimatedMinutes
   * @param {object[]} data.steps
   * @param {string}   data.steps[].type
   * @param {string}   data.steps[].description
   * @param {object}   [data.steps[].target]
   * @param {object}   [data.steps[].discovery] — config for discovery zones (when type="discovery")
   * @param {object[]} [data.quiz]
   * @param {object}   [data.worldTemplate]
   * @param {string}   [data.realWorldInsight] — real-world connection for this lesson
   * @param {string}   [data.summary] — written summary for accessibility/review
   * @param {string[]} [data.reviewTopics] — topics from earlier lessons to review via spaced repetition
   */
  constructor(data) {
    Object.assign(this, data);
    this.completed = false;
    this.currentStepIndex = 0;
    this.startTime = null;
    this.activeDiscovery = null; // DiscoveryZone instance if on a discovery step
  }

  /** @returns {{ type: string, description: string, target?: object }|null} */
  get currentStep() {
    return this.steps[this.currentStepIndex] ?? null;
  }

  /** Start the lesson timer. */
  start() {
    this.startTime = Date.now();
  }

  /** @returns {number} Time spent in seconds. */
  get timeSpent() {
    return this.startTime ? (Date.now() - this.startTime) / 1000 : 0;
  }

  /** Advance to the next step. Returns true if lesson is now complete. */
  advanceStep() {
    this.currentStepIndex++;
    this.activeDiscovery = null;
    if (this.currentStepIndex >= this.steps.length) {
      this.completed = true;
      return true;
    }
    return false;
  }

  /** Reset lesson progress (for replaying). */
  reset() {
    this.completed = false;
    this.currentStepIndex = 0;
    this.startTime = null;
    this.activeDiscovery = null;
  }

  /** @returns {number} Progress as 0-1 */
  get progress() {
    return this.steps.length ? this.currentStepIndex / this.steps.length : 0;
  }

  /**
   * Get written summary of the lesson for accessibility/review.
   * @returns {string}
   */
  getSummary() {
    if (this.summary) return this.summary;
    // Auto-generate a summary from objectives
    return `${this.title}: Learn to ${this.objectives.join(', ')}. ` +
      `Difficulty: ${this.difficulty}/5. Estimated time: ${this.estimatedMinutes} minutes.`;
  }

  /** @param {string} id @returns {Lesson} */
  static fromJSON(id, raw) {
    return new Lesson({ id, ...raw });
  }
}

export default Lesson;
