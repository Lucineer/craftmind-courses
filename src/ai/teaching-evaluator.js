/**
 * @module craftmind-courses/ai/teaching-evaluator
 * @description Comparative evaluation system for teaching effectiveness.
 * Tracks which teaching approach works best for each student/topic combination.
 * Inspired by fishing comparative-evaluator.js but adapted for education metrics.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * @typedef {object} TeachingEvaluationResult
 * @property {number} sessionScore - 0-1 normalized teaching effectiveness
 * @property {string} bestMethod - teaching method with best historical performance
 * @property {object} methodRanking - { methodName: { avgScore, uses, successRate } }
 * @property {string[]} insights - extracted teaching rules
 * @property {object} studentProfile - updated learning preferences
 */

export class TeachingEvaluator {
  constructor(dataDir = './data') {
    this.dataDir = dataDir;
    this.sessionsDir = join(dataDir, 'teaching-sessions');
    this.insightsDir = join(dataDir, 'teaching-insights');
    this._ensureDir(this.sessionsDir);
    this._ensureDir(this.insightsDir);
  }

  _ensureDir(dir) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  /**
   * Score a teaching session on 0-1 scale.
   * Considers: quiz score, retention, engagement, time efficiency, student satisfaction.
   * @param {object} session
   * @returns {number}
   */
  scoreSession(session) {
    const quizScore = session.quizScore ?? 0;
    const retention = session.retentionScore ?? 0;
    const engagement = session.engagementScore ?? 0.5;
    const completionRate = session.completionRate ?? 0;
    const difficulty = session.difficulty ?? 0.5;
    const hintsUsed = session.hintsUsed ?? 0;
    const timeSpent = session.timeSpent ?? 60;
    const expectedTime = session.expectedTime ?? 60;

    let score = 0;

    // Quiz accuracy (0.4 weight) — primary metric
    score += quizScore * 0.4;

    // Retention (0.2 weight) — did they remember later?
    score += retention * 0.2;

    // Engagement (0.15 weight) — were they paying attention?
    score += engagement * 0.15;

    // Completion (0.1 weight) — did they finish?
    score += completionRate * 0.1;

    // Difficulty-appropriate bonus (0.1 weight) — not too easy, not too hard
    const difficultyFit = 1 - Math.abs(quizScore - difficulty) * 2;
    score += Math.max(0, difficultyFit) * 0.1;

    // Hint penalty (small)
    score -= Math.min(0.05, hintsUsed * 0.01);

    // Time efficiency bonus
    if (timeSpent <= expectedTime && completionRate > 0.8) {
      score += 0.05;
    }

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Find similar teaching sessions based on topic, method, and student profile.
   */
  findSimilarSessions(conditions, allSessions) {
    return allSessions
      .map(session => ({
        session,
        similarity: this._sessionSimilarity(conditions, session),
      }))
      .filter(({ similarity }) => similarity >= 0.3)
      .sort((a, b) => b.similarity - a.similarity)
      .map(({ session }) => session);
  }

  _sessionSimilarity(a, b) {
    if (!a || !b) return 0;
    let matches = 0, total = 0;

    const exact = ['topic', 'method', 'studentId', 'difficulty'];
    for (const field of exact) {
      if (a[field] !== undefined || b[field] !== undefined) {
        total++;
        if (a[field] === b[field]) matches++;
      }
    }

    const numeric = [
      { key: 'studentConfidence', tolerance: 0.2 },
      { key: 'difficulty', tolerance: 0.2 },
    ];
    for (const { key, tolerance } of numeric) {
      if (a[key] !== undefined && b[key] !== undefined) {
        total++;
        if (Math.abs(a[key] - b[key]) <= tolerance) matches++;
      }
    }

    return total > 0 ? matches / total : 0;
  }

  /**
   * Evaluate a teaching session against historical data.
   * @param {object} session
   * @param {object[]} history
   * @returns {TeachingEvaluationResult}
   */
  evaluate(session, history = []) {
    const score = this.scoreSession(session);
    const similar = this.findSimilarSessions(session, history);

    // Rank methods by performance
    const methodStats = {};
    const scored = similar.map(s => ({ session: s, score: this.scoreSession(s) }));

    // Include current session
    const methodName = session.method || 'unknown';
    scored.push({ session, score });

    for (const { session: s, score: sc } of scored) {
      const name = s.method || 'unknown';
      if (!methodStats[name]) methodStats[name] = { scores: [], uses: 0, successes: 0 };
      methodStats[name].scores.push(sc);
      methodStats[name].uses++;
      if (sc >= 0.6) methodStats[name].successes++;
    }

    const methodRanking = {};
    let bestMethod = methodName;
    let bestAvg = 0;

    for (const [name, stats] of Object.entries(methodStats)) {
      const avgScore = stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length;
      const successRate = stats.successes / stats.uses;
      methodRanking[name] = { avgScore, uses: stats.uses, successRate };
      if (avgScore > bestAvg) { bestAvg = avgScore; bestMethod = name; }
    }

    const insights = this._generateInsights(scored, methodStats);

    // Build/update student profile
    const studentProfile = this._updateStudentProfile(session, methodRanking);

    return { sessionScore: score, bestMethod, methodRanking, insights, studentProfile };
  }

  _generateInsights(scored, methodStats) {
    const insights = [];
    if (scored.length < 3) return insights;

    // Compare methods
    const sorted = Object.entries(methodStats)
      .filter(([, s]) => s.uses >= 2)
      .sort((a, b) => b[1].avgScore - a[1].avgScore);

    if (sorted.length >= 2) {
      const [best, worst] = [sorted[0], sorted[sorted.length - 1]];
      const ratio = best[1].avgScore / Math.max(0.01, worst[1].avgScore);
      if (ratio >= 1.3) {
        insights.push(`${best[0]} is ${ratio.toFixed(1)}x more effective than ${worst[0]}`);
      }
    }

    // Topic-specific patterns
    const byTopic = {};
    for (const { session: s, score: sc } of scored) {
      if (!s.topic) continue;
      if (!byTopic[s.topic]) byTopic[s.topic] = [];
      byTopic[s.topic].push(sc);
    }
    for (const [topic, scores] of Object.entries(byTopic)) {
      if (scores.length >= 3) {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        if (avg > 0.75) insights.push(`Student performs well on ${topic} (avg ${(avg * 100).toFixed(0)}%)`);
        if (avg < 0.4) insights.push(`Student struggles with ${topic} (avg ${(avg * 100).toFixed(0)}%)`);
      }
    }

    return insights.slice(0, 8);
  }

  _updateStudentProfile(session, methodRanking) {
    // Determine which style the student responds to best
    const preferences = {};
    for (const [method, stats] of Object.entries(methodRanking)) {
      if (stats.uses >= 2) {
        preferences[method] = stats.avgScore;
      }
    }

    return {
      studentId: session.studentId,
      preferredStyle: Object.entries(preferences).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown',
      confidence: session.quizScore ?? 0.5,
      topicStrengths: [],
      topicWeaknesses: [],
      totalSessions: 1,
    };
  }

  saveSession(sessionId, evaluation) {
    const filePath = join(this.sessionsDir, `${sessionId}.json`);
    writeFileSync(filePath, JSON.stringify({ sessionId, ...evaluation, evaluatedAt: new Date().toISOString() }, null, 2));
  }

  loadAllSessions() {
    if (!existsSync(this.sessionsDir)) return [];
    return readdirSync(this.sessionsDir)
      .filter(f => f.endsWith('.json'))
      .flatMap(f => {
        try { return [JSON.parse(readFileSync(join(this.sessionsDir, f), 'utf-8'))]; }
        catch { return []; }
      });
  }

  getAllInsights() {
    if (!existsSync(this.insightsDir)) return [];
    return readdirSync(this.insightsDir)
      .filter(f => f.endsWith('.json'))
      .flatMap(f => {
        try { const d = JSON.parse(readFileSync(join(this.insightsDir, f), 'utf-8')); return d.insights || []; }
        catch { return []; }
      });
  }
}

export default TeachingEvaluator;
