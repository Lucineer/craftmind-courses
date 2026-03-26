import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TeachingActionPlanner, TEACHING_ACTION_TYPES } from '../src/ai/teaching-actions.js';
import { TEACHING_AGENT_TRAITS, getAgentConfig, getAgentIds, getAgentsForAction, selectBestAgent } from '../src/ai/teaching-agents.js';
import { TeachingEvaluator } from '../src/ai/teaching-evaluator.js';
import { SocraticEngine, BUILTIN_CHAINS } from '../src/ai/socratic-engine.js';
import { EngagementTracker, TeachingMethodTracker, CrossGameKnowledgeBridge } from '../src/ai/adaptive-difficulty.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DATA = join(__dirname, '.test-data-ai');

before(() => {
  if (existsSync(TEST_DATA)) rmSync(TEST_DATA, { recursive: true });
  mkdirSync(TEST_DATA, { recursive: true });
});

after(() => {
  try { rmSync(TEST_DATA, { recursive: true }); } catch {}
});

function existsSync(p) { try { require('node:fs').accessSync(p); return true; } catch { return false; } }

// ─── Teaching Actions ─────────────────────────────────────────────
describe('TeachingActionPlanner', () => {
  it('has all expected action types', () => {
    const types = Object.keys(TEACHING_ACTION_TYPES);
    assert.ok(types.includes('EXPLAIN'));
    assert.ok(types.includes('DEMONSTRATE'));
    assert.ok(types.includes('QUIZ'));
    assert.ok(types.includes('ADAPT'));
    assert.ok(types.includes('CHALLENGE'));
    assert.ok(types.includes('REVIEW'));
    assert.ok(types.includes('STORY'));
    assert.ok(types.includes('FIELD_TRIP'));
    assert.ok(types.includes('SOCRATIC'));
    assert.ok(types.includes('ENCOURAGE'));
    assert.ok(types.includes('PRAISE'));
    assert.ok(types.includes('CORRECT'));
    assert.ok(types.includes('REFERENCE'));
  });

  it('parses "why" questions as EXPLAIN', async () => {
    const planner = new TeachingActionPlanner();
    const result = await planner.plan('Why do fish bite at dawn?', { topic: 'fishing' });
    assert.ok(result.fallback);
    assert.ok(result.actions.length > 0);
    assert.equal(result.actions[0].type, 'EXPLAIN');
  });

  it('parses "show me" as DEMONSTRATE', async () => {
    const planner = new TeachingActionPlanner();
    const result = await planner.plan('Show me how to read a tide chart');
    assert.equal(result.actions[0].type, 'DEMONSTRATE');
  });

  it('parses "quiz" as QUIZ', async () => {
    const planner = new TeachingActionPlanner();
    const result = await planner.plan('Quiz me on fish species');
    assert.equal(result.actions[0].type, 'QUIZ');
  });

  it('parses confusion as ADAPT', async () => {
    const planner = new TeachingActionPlanner();
    const result = await planner.plan("I'm lost, I don't get it");
    assert.equal(result.actions[0].type, 'ADAPT');
  });

  it('parses challenge request as CHALLENGE', async () => {
    const planner = new TeachingActionPlanner();
    const result = await planner.plan('Give me a harder problem');
    assert.equal(result.actions[0].type, 'CHALLENGE');
  });

  it('parses review request as REVIEW', async () => {
    const planner = new TeachingActionPlanner();
    const result = await planner.plan('Let\'s review what I got wrong');
    assert.equal(result.actions[0].type, 'REVIEW');
  });

  it('parses story request as STORY', async () => {
    const planner = new TeachingActionPlanner();
    const result = await planner.plan('Tell me a story about when you almost sank');
    assert.equal(result.actions[0].type, 'STORY');
  });

  it('parses correct answers as PRAISE', async () => {
    const planner = new TeachingActionPlanner();
    const result = await planner.plan('Exactly!');
    assert.equal(result.actions[0].type, 'PRAISE');
  });

  it('returns empty actions for thanks', async () => {
    const planner = new TeachingActionPlanner();
    const result = await planner.plan('Thanks!');
    assert.equal(result.actions.length, 0);
  });

  it('returns response string', async () => {
    const planner = new TeachingActionPlanner();
    const result = await planner.plan('Why do fish bite at dawn?');
    assert.ok(typeof result.response === 'string');
    assert.ok(result.response.length > 0);
  });
});

// ─── Teaching Agents ──────────────────────────────────────────────
describe('Teaching Agent Configs', () => {
  it('has all four agents', () => {
    const ids = getAgentIds();
    assert.ok(ids.includes('iris'));
    assert.ok(ids.includes('joe'));
    assert.ok(ids.includes('maya'));
    assert.ok(ids.includes('textbook'));
  });

  it('Iris has Socratic tendency', () => {
    const iris = getAgentConfig('iris');
    assert.ok(iris.traits.socraticTendency > 0.7);
    assert.ok(iris.preferredStyle === 'socratic');
  });

  it('Joe has storytelling style', () => {
    const joe = getAgentConfig('joe');
    assert.ok(joe.preferredStyle === 'storyteller');
    assert.ok(joe.traits.humor > 0.7);
  });

  it('Maya is curious', () => {
    const maya = getAgentConfig('maya');
    assert.ok(maya.traits.curiosity > 0.8);
    assert.ok(maya.role === 'fellow_student');
  });

  it('Textbook has zero humor', () => {
    const tb = getAgentConfig('textbook');
    assert.equal(tb.traits.humor, 0);
    assert.equal(tb.traits.rigor, 1.0);
  });

  it('getAgentConfig returns null for unknown', () => {
    assert.equal(getAgentConfig('nobody'), null);
  });

  it('getAgentsForAction filters correctly', () => {
    const explainers = getAgentsForAction('EXPLAIN');
    assert.ok(explainers.length >= 2);
    assert.ok(explainers.some(a => a.name === 'Professor Iris'));
  });

  it('selectBestAgent returns an agent', () => {
    const agent = selectBestAgent('EXPLAIN', { preferredStyle: 'socratic' });
    assert.ok(agent);
    assert.ok(typeof agent.name === 'string');
  });

  it('selectBestAgent prefers matching style', () => {
    const agent = selectBestAgent('STORY', { preferredStyle: 'storyteller' });
    assert.equal(agent.name, 'Captain Joe');
  });

  it('agents have catchphrases', () => {
    for (const id of getAgentIds()) {
      const agent = getAgentConfig(id);
      assert.ok(agent.catchphrases.length > 0, `${agent.name} has no catchphrases`);
    }
  });
});

// ─── Teaching Evaluator ───────────────────────────────────────────
describe('TeachingEvaluator', () => {
  const evaluator = new TeachingEvaluator(TEST_DATA);

  it('scores a perfect session near 1.0', () => {
    const score = evaluator.scoreSession({
      quizScore: 1.0,
      retentionScore: 1.0,
      engagementScore: 1.0,
      completionRate: 1.0,
      difficulty: 0.5,
      hintsUsed: 0,
    });
    assert.ok(score > 0.9);
  });

  it('scores a terrible session near 0', () => {
    const score = evaluator.scoreSession({
      quizScore: 0,
      retentionScore: 0,
      engagementScore: 0,
      completionRate: 0,
      difficulty: 0.5,
      hintsUsed: 5,
    });
    assert.ok(score < 0.3);
  });

  it('evaluates against empty history', () => {
    const result = evaluator.evaluate({ method: 'socratic', topic: 'ocean' }, []);
    assert.ok(result.sessionScore >= 0);
    assert.ok(typeof result.bestMethod === 'string');
    assert.ok(Array.isArray(result.insights));
  });

  it('evaluates against history and identifies best method', () => {
    const history = [
      { method: 'socratic', topic: 'ocean', quizScore: 0.8, retentionScore: 0.7, engagementScore: 0.9, completionRate: 1, difficulty: 0.5, hintsUsed: 1 },
      { method: 'lecture', topic: 'ocean', quizScore: 0.4, retentionScore: 0.3, engagementScore: 0.4, completionRate: 0.8, difficulty: 0.5, hintsUsed: 3 },
      { method: 'socratic', topic: 'ocean', quizScore: 0.9, retentionScore: 0.8, engagementScore: 0.85, completionRate: 1, difficulty: 0.5, hintsUsed: 0 },
    ];
    const result = evaluator.evaluate({ method: 'socratic', topic: 'ocean', quizScore: 0.85, retentionScore: 0.75, engagementScore: 0.8, completionRate: 1, difficulty: 0.5, hintsUsed: 0 }, history);
    assert.equal(result.bestMethod, 'socratic');
    assert.ok(result.methodRanking.socratic.avgScore > result.methodRanking.lecture.avgScore);
  });

  it('generates insights from sufficient data', () => {
    const history = Array.from({ length: 10 }, (_, i) => ({
      method: i < 7 ? 'story' : 'lecture',
      topic: 'fish',
      studentId: 's1',
      quizScore: i < 7 ? 0.8 + Math.random() * 0.2 : 0.3 + Math.random() * 0.3,
      retentionScore: i < 7 ? 0.7 : 0.3,
      engagementScore: 0.5,
      completionRate: 1,
      difficulty: 0.5,
      hintsUsed: i < 7 ? 0 : 2,
    }));
    const result = evaluator.evaluate({ method: 'story', topic: 'fish', studentId: 's1', quizScore: 0.85, retentionScore: 0.8, engagementScore: 0.7, completionRate: 1, difficulty: 0.5, hintsUsed: 0 }, history);
    // Similar sessions should be found since topic and studentId match
    assert.ok(result.methodRanking.story || result.methodRanking.lecture);
  });

  it('saves and loads sessions', () => {
    const result = evaluator.evaluate({ method: 'test', topic: 'test', quizScore: 0.7, retentionScore: 0.5, engagementScore: 0.6, completionRate: 1, difficulty: 0.5, hintsUsed: 1 }, []);
    evaluator.saveSession('test-1', result);
    const loaded = evaluator.loadAllSessions();
    assert.ok(loaded.length > 0);
    assert.equal(loaded[0].sessionId, 'test-1');
  });
});

// ─── Socratic Engine ──────────────────────────────────────────────
describe('SocraticEngine', () => {
  const engine = new SocraticEngine();
  engine.registerChain('dawn_fishing', BUILTIN_CHAINS.dawn_fishing);
  engine.registerChain('tides_currents', BUILTIN_CHAINS.tides_currents);

  it('lists available topics', () => {
    const topics = engine.getTopics();
    assert.ok(topics.includes('dawn_fishing'));
    assert.ok(topics.includes('tides_currents'));
  });

  it('starts a chain and returns first question', () => {
    const result = engine.startChain('dawn_fishing');
    assert.ok(result.question.length > 0);
    assert.equal(result.agent, 'iris');
    assert.equal(result.chainLength, 4);
    assert.equal(result.progress, 0);
  });

  it('accepts correct answer and moves to next question', () => {
    engine.startChain('dawn_fishing');
    const result = engine.processAnswer('The light changes at dawn');
    assert.ok(result.correct);
    assert.ok(!result.chainComplete);
    assert.ok(result.nextQuestion);
    assert.ok(result.insight);
  });

  it('gives hints on wrong answer', () => {
    engine.startChain('dawn_fishing');
    const result = engine.processAnswer('I have no idea');
    assert.ok(!result.correct);
    assert.ok(!result.chainComplete);
    assert.ok(result.feedback.length > 0);
  });

  it('completes chain after all questions answered correctly', () => {
    engine.startChain('dawn_fishing');
    const answers = ['light', 'warms up', 'come up', 'predators follow bait'];
    let lastResult;
    for (const answer of answers) {
      lastResult = engine.processAnswer(answer);
    }
    assert.ok(lastResult.chainComplete);
    assert.ok(lastResult.conclusion);
    assert.ok(!engine.isActive);
  });

  it('provides agent interjections', () => {
    engine.startChain('dawn_fishing');
    // Answer first question correctly to trigger interjections
    const result = engine.processAnswer('light');
    // Interjections are random, just check structure when they appear
    if (result.agentInterjections.length > 0) {
      assert.ok(result.agentInterjections[0].agent);
      assert.ok(result.agentInterjections[0].message);
    }
  });

  it('tracks progress', () => {
    engine.startChain('dawn_fishing');
    assert.ok(engine.isActive);
    assert.ok(engine.progress !== null);
    assert.equal(engine.progress.current, 0);
    assert.equal(engine.progress.total, 4);
  });

  it('throws for unknown topic', () => {
    assert.throws(() => engine.startChain('nonexistent'));
  });

  it('throws when processing answer without active chain', () => {
    const fresh = new SocraticEngine();
    assert.throws(() => fresh.processAnswer('something'));
  });

  it('tracks completion history', () => {
    const fresh = new SocraticEngine();
    fresh.registerChain('dawn_fishing', BUILTIN_CHAINS.dawn_fishing);
    fresh.startChain('dawn_fishing');
    ['light', 'warmer', 'rise', 'food chain'].forEach(a => fresh.processAnswer(a));
    assert.equal(fresh.getHistory().length, 1);
  });

  it('moves on after max wrong attempts', () => {
    const fresh = new SocraticEngine();
    fresh.registerChain('dawn_fishing', BUILTIN_CHAINS.dawn_fishing);
    fresh.startChain('dawn_fishing');
    // q1 has maxAttempts: 3
    fresh.processAnswer('nope');
    fresh.processAnswer('still nope');
    fresh.processAnswer('definitely nope');
    // After 3 wrong, should give insight and move on
    // Next call should work on q2
    const result = fresh.processAnswer('warm');
    assert.ok(result.nextQuestion || result.chainComplete);
  });
});

// ─── Adaptive Difficulty ──────────────────────────────────────────
describe('EngagementTracker', () => {
  it('starts at neutral engagement', () => {
    const tracker = new EngagementTracker();
    assert.ok(tracker.getScore() >= 0.4);
  });

  it('high engagement from questions and corrects', () => {
    const tracker = new EngagementTracker();
    tracker.recordEvent('question', 'why fish bite');
    tracker.recordEvent('correct', 'quiz answer');
    tracker.recordEvent('question', 'another question');
    tracker.recordEvent('correct', 'another answer');
    assert.ok(tracker.getScore() > 0.6);
  });

  it('low engagement from give-ups', () => {
    const tracker = new EngagementTracker();
    tracker.recordEvent('give_up', 'stuck');
    tracker.recordEvent('give_up', 'still stuck');
    assert.ok(tracker.getScore() < 0.4);
  });

  it('detects frustration', () => {
    const tracker = new EngagementTracker();
    for (let i = 0; i < 3; i++) tracker.recordEvent('wrong', 'bad answer');
    assert.ok(tracker.isFrustrated());
  });

  it('not frustrated from one wrong', () => {
    const tracker = new EngagementTracker();
    tracker.recordEvent('wrong', 'oops');
    assert.ok(!tracker.isFrustrated());
  });

  it('reset clears events', () => {
    const tracker = new EngagementTracker();
    tracker.recordEvent('question', 'x');
    tracker.reset();
    assert.equal(tracker.events.length, 0);
  });
});

describe('TeachingMethodTracker', () => {
  it('records and retrieves method scores', () => {
    const tracker = new TeachingMethodTracker();
    tracker.record('student1', 'socratic', 0.8);
    tracker.record('student1', 'socratic', 0.9);
    tracker.record('student1', 'lecture', 0.4);
    const best = tracker.getBestMethod('student1');
    assert.equal(best.method, 'socratic');
    assert.ok(best.avgScore > 0.8);
  });

  it('returns default when no data', () => {
    const tracker = new TeachingMethodTracker();
    const best = tracker.getBestMethod('unknown');
    assert.equal(best.method, 'lecture');
    assert.equal(best.sampleSize, 0);
  });

  it('returns topic-specific best method', () => {
    const tracker = new TeachingMethodTracker();
    tracker.record('s1', 'socratic', 0.9, 'fish');
    tracker.record('s1', 'socratic', 0.85, 'fish');
    tracker.record('s1', 'lecture', 0.7, 'fish');
    tracker.record('s1', 'story', 0.9, 'history');
    tracker.record('s1', 'story', 0.95, 'history');
    assert.equal(tracker.getBestMethod('s1', 'fish').method, 'socratic');
    assert.equal(tracker.getBestMethod('s1', 'history').method, 'story');
  });

  it('getAllMethodScores returns averages and trends', () => {
    const tracker = new TeachingMethodTracker();
    tracker.record('s1', 'socratic', 0.6);
    tracker.record('s1', 'socratic', 0.8);
    tracker.record('s1', 'socratic', 0.9);
    const scores = tracker.getAllMethodScores('s1');
    assert.ok(scores.socratic);
    assert.ok(scores.socratic.avg > 0.7);
    assert.ok(scores.socratic.count === 3);
  });

  it('confidence increases with more data', () => {
    const tracker = new TeachingMethodTracker();
    tracker.record('s1', 'socratic', 0.8);
    const c1 = tracker.getBestMethod('s1').confidence;
    for (let i = 0; i < 15; i++) tracker.record('s1', 'socratic', 0.8);
    const c2 = tracker.getBestMethod('s1').confidence;
    assert.ok(c2 > c1);
  });
});

describe('CrossGameKnowledgeBridge', () => {
  it('tracks unlocked knowledge from games', () => {
    const bridge = new CrossGameKnowledgeBridge();
    bridge.unlockKnowledge('fishing', ['salmon_biology', 'tide_reading']);
    bridge.unlockKnowledge('researcher', ['ocean_currents']);
    const summary = bridge.getUnlockedSummary();
    assert.ok(summary.fishing.includes('salmon_biology'));
    assert.ok(summary.researcher.includes('ocean_currents'));
  });

  it('checks topic prerequisites', () => {
    const bridge = new CrossGameKnowledgeBridge();
    bridge.unlockKnowledge('fishing', ['tide_reading']);
    const result = bridge.checkTopicUnlocked('tides', {
      fishing: ['tide_reading', 'salmon_biology'],
      researcher: ['ocean_currents'],
    });
    assert.ok(result.unlocked);
    assert.ok(result.fromGames.includes('fishing'));
    assert.ok(result.context.length > 0);
  });

  it('reports not unlocked when prerequisites missing', () => {
    const bridge = new CrossGameKnowledgeBridge();
    const result = bridge.checkTopicUnlocked('tides', { fishing: ['tide_reading'] });
    assert.ok(!result.unlocked);
  });
});
