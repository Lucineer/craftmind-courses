/**
 * Adaptive Difficulty Engine
 *
 * Tracks per-topic confidence scores and adjusts lesson pacing dynamically.
 * Based on principles from mastery learning (Bloom, 1968) and the zone of proximal development (Vygotsky).
 *
 * Confidence model:
 *   - Starts at 0.5 (neutral)
 *   - Correct quiz answer: +0.2
 *   - Wrong quiz answer: -0.15 (but floor at 0.1 — we never give up on a student)
 *   - Used a hint: -0.05 (light penalty — using hints is still learning)
 *   - Helped a classmate: +0.1 (teaching reinforces learning)
 *   - Completed a challenge without hints: +0.15
 *   - Failed 3 times on same topic: teacher intervention triggered
 *   - Perfect quiz: +0.25
 *
 * The confidence score drives:
 *   - Whether to skip review content (score > 0.85)
 *   - Whether to slow down and add examples (score < 0.3)
 *   - Quiz question difficulty selection
 *   - Whether to offer advanced challenges
 */

const CONFIDENCE_FLOOR = 0.1;
const CONFIDENCE_CEIL = 1.0;
const INTERVENTION_THRESHOLD = 0.3; // trigger teacher slow-down
const MASTERY_THRESHOLD = 0.85;     // can skip review content
const ADVANCED_THRESHOLD = 0.75;    // eligible for advanced challenges

/** @typedef {{topic:string, confidence:number, attempts:number, lastUpdated:string, history:number[]}} TopicConfidence */

export class AdaptiveEngine {
  constructor() {
    /** @type {Map<string, TopicConfidence>} */
    this.topics = new Map();
    this.globalFailures = 0; // consecutive failures across topics
    this.hintsUsedThisLesson = 0;
  }

  /** Get confidence for a topic, defaulting to 0.5 */
  getConfidence(topic) {
    return this.topics.get(topic)?.confidence ?? 0.5;
  }

  /** Record a quiz answer */
  recordQuizAnswer(topic, correct) {
    const tc = this._getOrCreate(topic);
    if (correct) {
      tc.confidence = Math.min(CONFIDENCE_CEIL, tc.confidence + 0.2);
      this.globalFailures = 0;
    } else {
      tc.confidence = Math.max(CONFIDENCE_FLOOR, tc.confidence - 0.15);
      this.globalFailures++;
      tc.attempts++;
    }
    tc.lastUpdated = new Date().toISOString();
    tc.history.push(tc.confidence);
    if (tc.history.length > 20) tc.history.shift();
  }

  /** Record a hint being used */
  recordHintUsed(topic) {
    const tc = this._getOrCreate(topic);
    tc.confidence = Math.max(CONFIDENCE_FLOOR, tc.confidence - 0.05);
    this.hintsUsedThisLesson++;
    tc.lastUpdated = new Date().toISOString();
  }

  /** Record a challenge completed without hints */
  recordChallengeComplete(topic, usedHints) {
    const tc = this._getOrCreate(topic);
    if (!usedHints) {
      tc.confidence = Math.min(CONFIDENCE_CEIL, tc.confidence + 0.15);
    }
    tc.lastUpdated = new Date().toISOString();
  }

  /** Record helping a classmate (teaching reinforces learning) */
  recordPeerTeach(topic) {
    const tc = this._getOrCreate(topic);
    tc.confidence = Math.min(CONFIDENCE_CEIL, tc.confidence + 0.1);
    tc.lastUpdated = new Date().toISOString();
  }

  /** Record a perfect quiz */
  recordPerfectQuiz(topic) {
    const tc = this._getOrCreate(topic);
    tc.confidence = Math.min(CONFIDENCE_CEIL, tc.confidence + 0.25);
    this.globalFailures = 0;
    tc.lastUpdated = new Date().toISOString();
  }

  /** @returns {{action:string, message:string, reason:string}} What the teacher should do */
  getAdaptation(topic) {
    const confidence = this.getConfidence(topic);

    if (this.globalFailures >= 3) {
      return {
        action: 'intervene',
        message: "I can see you're really struggling with this. Let's go back and review the basics — there's no rush.",
        reason: '3+ consecutive failures across topics',
      };
    }

    if (confidence < INTERVENTION_THRESHOLD) {
      const tc = this.topics.get(topic);
      const recentFails = tc?.attempts ?? 0;
      if (recentFails >= 3) {
        return {
          action: 'slow_down',
          message: "Let's take this one step at a time. I'll give you an extra example to work through.",
          reason: `low confidence (${confidence.toFixed(2)}) + multiple failures`,
        };
      }
      return {
        action: 'extra_examples',
        message: "Let me show you another example before we move on.",
        reason: `low confidence (${confidence.toFixed(2)})`,
      };
    }

    if (confidence >= MASTERY_THRESHOLD) {
      return {
        action: 'skip_review',
        message: "You've clearly got this down! Let's skip the review and try something more challenging.",
        reason: `mastery level (${confidence.toFixed(2)})`,
      };
    }

    if (confidence >= ADVANCED_THRESHOLD) {
      return {
        action: 'offer_challenge',
        message: "Looking good! Want to try the advanced version of this?",
        reason: `high confidence (${confidence.toFixed(2)})`,
      };
    }

    return { action: 'continue', message: '', reason: 'confidence in normal range' };
  }

  /** Should we include a spaced repetition review question for this topic? */
  shouldReviewTopic(topic) {
    const confidence = this.getConfidence(topic);
    // Review topics that aren't fully mastered but also aren't actively struggling
    return confidence >= INTERVENTION_THRESHOLD && confidence < MASTERY_THRESHOLD;
  }

  /** Reset per-lesson counters */
  resetLessonCounters() {
    this.hintsUsedThisLesson = 0;
  }

  /** Serialize to plain object */
  toJSON() {
    return {
      topics: Object.fromEntries(this.topics),
      globalFailures: this.globalFailures,
    };
  }

  /** Deserialize */
  static fromJSON(data) {
    const engine = new AdaptiveEngine();
    if (data?.topics) {
      engine.topics = new Map(Object.entries(data.topics));
    }
    engine.globalFailures = data?.globalFailures ?? 0;
    return engine;
  }

  _getOrCreate(topic) {
    if (!this.topics.has(topic)) {
      this.topics.set(topic, {
        topic,
        confidence: 0.5,
        attempts: 0,
        lastUpdated: new Date().toISOString(),
        history: [0.5],
      });
    }
    return this.topics.get(topic);
  }
}
