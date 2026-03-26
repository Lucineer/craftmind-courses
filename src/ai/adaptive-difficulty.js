/**
 * @module craftmind-courses/ai/adaptive-difficulty
 * @description Enhanced adaptive difficulty that considers teaching method effectiveness,
 * student engagement patterns, and cross-agent collaboration.
 * Extends the existing AdaptiveEngine with AI-driven adaptations.
 */

const CONFIDENCE_FLOOR = 0.1;
const CONFIDENCE_CEIL = 1.0;

/**
 * Engagement tracking — measures how engaged a student is.
 */
export class EngagementTracker {
  constructor() {
    this.events = []; // { timestamp, type, detail }
    this._sessionStart = Date.now();
  }

  recordEvent(type, detail = '') {
    this.events.push({ timestamp: Date.now(), type, detail });
  }

  /**
   * Compute engagement score 0-1 based on recent events.
   * High engagement = asking questions, responding quickly, completing challenges.
   * Low engagement = long silences, giving up, repeated mistakes.
   */
  getScore() {
    if (this.events.length === 0) return 0.5;

    const recent = this.events.filter(e => Date.now() - e.timestamp < 300000); // last 5 min
    if (recent.length === 0) return 0.3; // went cold

    let score = 0.5;
    const questionCount = recent.filter(e => e.type === 'question').length;
    const responseCount = recent.filter(e => e.type === 'response').length;
    const hintCount = recent.filter(e => e.type === 'hint_used').length;
    const giveUpCount = recent.filter(e => e.type === 'give_up').length;
    const correctCount = recent.filter(e => e.type === 'correct').length;
    const wrongCount = recent.filter(e => e.type === 'wrong').length;

    // Questions show engagement
    score += Math.min(0.2, questionCount * 0.05);

    // Quick responses show focus
    score += Math.min(0.1, responseCount * 0.02);

    // Correct answers boost engagement
    score += Math.min(0.1, correctCount * 0.05);

    // Hints slightly reduce (but not punish)
    score -= hintCount * 0.01;

    // Giving up hurts
    score -= giveUpCount * 0.08;

    // Frustration: many wrongs without corrects
    if (wrongCount > correctCount * 2) score -= 0.1;

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Detect if student seems frustrated.
   * @returns {boolean}
   */
  isFrustrated() {
    const recent = this.events.filter(e => Date.now() - e.timestamp < 120000);
    const wrongs = recent.filter(e => e.type === 'wrong').length;
    const giveUps = recent.filter(e => e.type === 'give_up').length;
    const hints = recent.filter(e => e.type === 'hint_used').length;
    return wrongs >= 3 || giveUps >= 2 || hints >= 3;
  }

  reset() {
    this.events = [];
    this._sessionStart = Date.now();
  }
}

/**
 * Teaching method effectiveness tracker per student.
 * Tracks which methods (socratic, lecture, story, demonstration) work best
 * for each student, enabling adaptive teaching style selection.
 */
export class TeachingMethodTracker {
  constructor() {
    /** @type {Map<string, {methodScores: Map<string, number[]>, topicMethodScores: Map<string, Map<string, number[]>>}>} */
    this.students = new Map();
  }

  _getStudent(studentId) {
    if (!this.students.has(studentId)) {
      this.students.set(studentId, { methodScores: new Map(), topicMethodScores: new Map() });
    }
    return this.students.get(studentId);
  }

  /**
   * Record the outcome of a teaching interaction.
   * @param {string} studentId
   * @param {string} method - 'socratic', 'lecture', 'story', 'demonstration', etc.
   * @param {number} outcome - 0-1 score (quiz result, comprehension check, etc.)
   * @param {string} [topic]
   */
  record(studentId, method, outcome, topic) {
    const student = this._getStudent(studentId);

    // Global method score
    if (!student.methodScores.has(method)) student.methodScores.set(method, []);
    student.methodScores.get(method).push(outcome);

    // Topic-specific method score
    if (topic) {
      if (!student.topicMethodScores.has(topic)) student.topicMethodScores.set(topic, new Map());
      const topicMethods = student.topicMethodScores.get(topic);
      if (!topicMethods.has(method)) topicMethods.set(method, []);
      topicMethods.get(method).push(outcome);
    }
  }

  /**
   * Get the best teaching method for a student (optionally for a specific topic).
   * @param {string} studentId
   * @param {string} [topic]
   * @returns {{ method: string, avgScore: number, confidence: number, sampleSize: number }}
   */
  getBestMethod(studentId, topic) {
    const student = this.students.get(studentId);
    if (!student) return { method: 'lecture', avgScore: 0.5, confidence: 0, sampleSize: 0 };

    const methodMap = topic && student.topicMethodScores.has(topic)
      ? student.topicMethodScores.get(topic)
      : student.methodScores;

    let bestMethod = 'lecture';
    let bestAvg = 0;
    let totalSamples = 0;

    for (const [method, scores] of methodMap) {
      if (scores.length < 2) continue;
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      if (avg > bestAvg) { bestAvg = avg; bestMethod = method; }
      totalSamples += scores.length;
    }

    return {
      method: bestMethod,
      avgScore: bestAvg,
      confidence: Math.min(1, totalSamples / 20), // more data = more confident
      sampleSize: totalSamples,
    };
  }

  /**
   * Get all method scores for a student.
   */
  getAllMethodScores(studentId) {
    const student = this.students.get(studentId);
    if (!student) return {};

    const result = {};
    for (const [method, scores] of student.methodScores) {
      if (scores.length === 0) continue;
      result[method] = {
        avg: scores.reduce((a, b) => a + b, 0) / scores.length,
        count: scores.length,
        trend: scores.length >= 3
          ? scores[scores.length - 1] - scores[0]
          : 0,
      };
    }
    return result;
  }
}

/**
 * Cross-game knowledge bridge.
 * Tracks what the student has learned in other games (Fishing, Researcher)
 * and how it connects to course content.
 */
export class CrossGameKnowledgeBridge {
  constructor() {
    this.unlockedKnowledge = new Map(); // gameId -> Set of knowledgeIds
  }

  /**
   * Register knowledge from another game.
   * @param {string} gameId - 'fishing', 'researcher', 'ranch', etc.
   * @param {string[]} knowledgeIds
   */
  unlockKnowledge(gameId, knowledgeIds) {
    if (!this.unlockedKnowledge.has(gameId)) {
      this.unlockedKnowledge.set(gameId, new Set());
    }
    for (const id of knowledgeIds) {
      this.unlockedKnowledge.get(gameId).add(id);
    }
  }

  /**
   * Check if a course topic is unlocked by cross-game knowledge.
   * @param {string} topicId
   * @param {object} prerequisites - { fishing: [...], researcher: [...] }
   * @returns {{ unlocked: boolean, fromGames: string[], context: string }}
   */
  checkTopicUnlocked(topicId, prerequisites = {}) {
    const fromGames = [];
    let context = '';

    for (const [gameId, requiredIds] of Object.entries(prerequisites)) {
      const unlocked = this.unlockedKnowledge.get(gameId);
      if (!unlocked) continue;
      for (const reqId of requiredIds) {
        if (unlocked.has(reqId)) {
          fromGames.push(gameId);
          context += `You learned about ${reqId} from ${gameId}! `;
        }
      }
    }

    return {
      unlocked: fromGames.length > 0,
      fromGames,
      context,
    };
  }

  /**
   * Get all unlocked knowledge across games.
   */
  getUnlockedSummary() {
    const summary = {};
    for (const [gameId, ids] of this.unlockedKnowledge) {
      summary[gameId] = [...ids];
    }
    return summary;
  }
}

export default { EngagementTracker, TeachingMethodTracker, CrossGameKnowledgeBridge };
