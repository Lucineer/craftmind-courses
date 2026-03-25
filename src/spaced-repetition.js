/**
 * Spaced Repetition Scheduler
 *
 * Revisits earlier concepts in later lessons using a simplified SM-2 algorithm.
 * This is how real learning works — you need to encounter material at increasing
 * intervals to move it from short-term to long-term memory.
 *
 * Each topic has:
 *   - interval: days until next review
 *   - ease: how easy the student finds this (1.3-2.5)
 *   - nextReview: timestamp of next scheduled review
 *   - repetitions: number of successful reviews
 */

const MIN_INTERVAL_HOURS = 0.5;  // 30 minutes minimum
const MAX_INTERVAL_HOURS = 720;   // 30 days maximum
const MIN_EASE = 1.3;

/** @typedef {{topic:string, interval:number, ease:number, nextReview:number, repetitions:number, lastQuality:number}} SRItem */

export class SpacedRepetition {
  constructor() {
    /** @type {Map<string, SRItem>} */
    this.items = new Map();
  }

  /**
   * Register a topic for spaced repetition tracking.
   * @param {string} topic
   * @param {number} [firstReviewHours] - hours until first review (default 1)
   */
  register(topic, firstReviewHours = 1) {
    if (!this.items.has(topic)) {
      this.items.set(topic, {
        topic,
        interval: firstReviewHours / 24, // convert to days
        ease: 2.5,
        nextReview: Date.now() + (firstReviewHours * 60 * 60 * 1000),
        repetitions: 0,
        lastQuality: 0,
      });
    }
  }

  /**
   * Record a review attempt. Quality 0-5:
   *   0 = complete blackout
   *   1 = incorrect, but recognized after seeing answer
   *   2 = incorrect, but answer seemed easy to recall
   *   3 = correct with serious difficulty
   *   4 = correct with some hesitation
   *   5 = perfect recall
   */
  review(topic, quality) {
    const item = this._getOrCreate(topic);
    item.lastQuality = quality;

    // Simplified SM-2
    if (quality >= 3) {
      // Correct response
      if (item.repetitions === 0) {
        item.interval = 1; // 1 day
      } else if (item.repetitions === 1) {
        item.interval = 6; // 6 days
      } else {
        item.interval = item.interval * item.ease;
      }
      item.repetitions++;
      item.interval = Math.min(item.interval, MAX_INTERVAL_HOURS / 24);
    } else {
      // Incorrect — reset
      item.repetitions = 0;
      item.interval = MIN_INTERVAL_HOURS / 24;
    }

    // Update ease factor
    item.ease = Math.max(MIN_EASE, item.ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
    item.nextReview = Date.now() + (item.interval * 24 * 60 * 60 * 1000);
  }

  /** Convenience: map quiz performance to SR quality */
  reviewFromQuiz(topic, correct, usedHints) {
    if (correct && !usedHints) return this.review(topic, 5); // perfect
    if (correct && usedHints) return this.review(topic, 4);  // correct with hesitation
    if (usedHints) return this.review(topic, 2);             // wrong but recognized
    return this.review(topic, 1);                              // complete miss
  }

  /** Get topics due for review right now */
  getDueTopics() {
    const now = Date.now();
    return [...this.items.values()]
      .filter(item => item.nextReview <= now)
      .sort((a, b) => a.nextReview - b.nextReview);
  }

  /** Get topics due for review within the next N hours */
  getTopicsDueWithin(hours) {
    const cutoff = Date.now() + (hours * 60 * 60 * 1000);
    return [...this.items.values()]
      .filter(item => item.nextReview <= cutoff)
      .sort((a, b) => a.nextReview - b.nextReview);
  }

  /** Check if a topic should be reviewed during a lesson */
  shouldInjectReview(topic) {
    const item = this.items.get(topic);
    if (!item) return false;
    return Date.now() >= item.nextReview;
  }

  /** Get the next review time for a topic */
  getNextReview(topic) {
    return this.items.get(topic)?.nextReview ?? null;
  }

  /** Get retention estimate (rough) — 0-1 based on repetitions and ease */
  getRetentionEstimate(topic) {
    const item = this.items.get(topic);
    if (!item) return 0;
    if (item.repetitions === 0) return 0.1;
    return Math.min(0.99, 0.3 + (item.repetitions * 0.1) + ((item.ease - MIN_EASE) * 0.1));
  }

  toJSON() {
    return { items: Object.fromEntries(this.items) };
  }

  static fromJSON(data) {
    const sr = new SpacedRepetition();
    if (data?.items) sr.items = new Map(Object.entries(data.items));
    return sr;
  }

  _getOrCreate(topic) {
    if (!this.items.has(topic)) this.register(topic);
    return this.items.get(topic);
  }
}
