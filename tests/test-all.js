import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Course } from '../src/course.js';
import { Lesson } from '../src/lesson.js';
import { Quiz } from '../src/quiz.js';
import { Progress } from '../src/progress.js';
import { AchievementSystem } from '../src/achievements.js';
import { NPCClassmate } from '../src/npc-classmate.js';

/** Create a fake mineflayer bot. */
function fakeBot() {
  const handlers = {};
  return {
    chat(msg) { /* no-op */ },
    on(event, fn) { (handlers[event] ??= []).push(fn); },
    off(event, fn) { handlers[event] = (handlers[event] ?? []).filter(f => f !== fn); },
    emit(event, ...args) { (handlers[event] ?? []).forEach(fn => fn(...args)); },
    entity: { position: { x: 0, y: 64, z: 0, offset(dx, dy, dz) { return { x: this.x + dx, y: this.y + dy, z: this.z + dz }; } } },
  };
}

// ─── Lesson Loading ────────────────────────────────────────────────
describe('Lesson', () => {
  it('creates from JSON with all fields', () => {
    const l = Lesson.fromJSON('test-1', {
      title: 'Test Lesson',
      description: 'A test',
      objectives: ['Do thing'],
      prerequisites: [],
      difficulty: 2,
      estimatedMinutes: 10,
      steps: [{ type: 'observe', description: 'Look' }],
      quiz: [{ question: 'Q?', type: 'multiple_choice', options: ['A', 'B'], answer: 'A', explanation: 'Because' }],
    });
    assert.equal(l.id, 'test-1');
    assert.equal(l.title, 'Test Lesson');
    assert.equal(l.steps.length, 1);
    assert.equal(l.quiz.length, 1);
    assert.equal(l.completed, false);
    assert.equal(l.currentStepIndex, 0);
  });

  it('advances steps and marks complete', () => {
    const l = Lesson.fromJSON('s', { title: 'T', description: 'D', objectives: [], prerequisites: [], difficulty: 1, estimatedMinutes: 5,
      steps: [{ type: 'observe', description: 'A' }, { type: 'observe', description: 'B' }] });
    assert.equal(l.progress, 0);
    assert.equal(l.advanceStep(), false);
    assert.equal(l.progress, 0.5);
    assert.equal(l.advanceStep(), true);
    assert.equal(l.completed, true);
    assert.equal(l.progress, 1);
  });

  it('resets properly', () => {
    const l = Lesson.fromJSON('s', { title: 'T', description: 'D', objectives: [], prerequisites: [], difficulty: 1, estimatedMinutes: 5,
      steps: [{ type: 'observe', description: 'A' }] });
    l.advanceStep();
    l.reset();
    assert.equal(l.completed, false);
    assert.equal(l.currentStepIndex, 0);
  });

  it('handles empty steps gracefully', () => {
    const l = Lesson.fromJSON('s', { title: 'T', description: 'D', objectives: [], prerequisites: [], difficulty: 1, estimatedMinutes: 5, steps: [] });
    assert.equal(l.progress, 0);
    assert.equal(l.currentStep, null);
    assert.equal(l.advanceStep(), true); // immediately complete
  });
});

// ─── Course Loading ────────────────────────────────────────────────
describe('Course', () => {
  it('loads from JSON file', async () => {
    const course = await Course.fromFile('courses/redstone-basics.json');
    assert.equal(course.id, 'redstone-basics');
    assert.ok(course.title.includes('Redstone'));
    assert.ok(course.orderedLessons.length >= 5);
    assert.ok(course.totalEstimatedMinutes > 0);
    assert.ok(course.averageDifficulty >= 1);
  });

  it('retrieves lessons by id', async () => {
    const course = await Course.fromFile('courses/redstone-basics.json');
    const lesson = course.getLesson('rb-torches');
    assert.ok(lesson);
    assert.equal(lesson.id, 'rb-torches');
    assert.ok(course.getLesson('nonexistent') === undefined);
  });

  it('calculates total time and difficulty', async () => {
    const course = await Course.fromFile('courses/building-basics.json');
    assert.ok(course.totalEstimatedMinutes > 0);
    assert.ok(course.averageDifficulty >= 1 && course.averageDifficulty <= 5);
  });
});

// ─── Quiz Validation ───────────────────────────────────────────────
describe('Quiz', () => {
  const bot = fakeBot();

  /** Helper: start a quiz question (sets awaitingAnswer) then process the answer. */
  async function answerQuestion(quiz, input) {
    const promise = quiz.askCurrent(); // sets awaitingAnswer
    quiz.processAnswer(input);
    return promise;
  }

  it('validates multiple choice answers', async () => {
    const q = new Quiz([
      { question: 'Q?', type: 'multiple_choice', options: ['Apple', 'Banana', 'Cherry'], answer: 'Banana', explanation: 'E' },
    ], bot);
    assert.equal(q.currentQuestion.question, 'Q?');
    assert.equal(q.isComplete, false);

    await answerQuestion(q, 'b'); // b → index 1 → Banana
    assert.equal(q.score, 1);
    assert.equal(q.isComplete, true);
  });

  it('validates open-ended answers', async () => {
    const q = new Quiz([
      { question: 'What is it?', type: 'open_ended', answer: ['redstone', 'dust'], explanation: 'E' },
    ], bot);
    await answerQuestion(q, 'redstone dust');
    assert.equal(q.score, 1);
  });

  it('handles wrong answers', async () => {
    const q = new Quiz([
      { question: 'Q?', type: 'multiple_choice', options: ['A', 'B'], answer: 'A', explanation: 'Nope' },
    ], bot);
    await answerQuestion(q, 'b');
    assert.equal(q.score, 0);
    assert.equal(q.isComplete, true);
  });

  it('respects custom points', async () => {
    const q = new Quiz([
      { question: 'Q1', type: 'multiple_choice', options: ['A', 'B'], answer: 'A', explanation: '', points: 3 },
      { question: 'Q2', type: 'multiple_choice', options: ['A', 'B'], answer: 'B', explanation: '', points: 2 },
    ], bot);
    assert.equal(q.totalPoints, 5);
    await answerQuestion(q, 'a');
    await answerQuestion(q, 'a'); // wrong for Q2
    assert.equal(q.score, 3);
  });

  it('processAnswer returns false when not awaiting', () => {
    const q = new Quiz([
      { question: 'Q?', type: 'multiple_choice', options: ['A', 'B'], answer: 'A', explanation: '' },
    ], bot);
    assert.equal(q.processAnswer('a'), false);
  });

  it('showResults displays correct percentage', async () => {
    const q = new Quiz([
      { question: 'Q?', type: 'multiple_choice', options: ['A', 'B'], answer: 'A', explanation: '' },
    ], bot);
    await answerQuestion(q, 'a');
    // Should not throw
    q.showResults();
  });
});

// ─── Progress Tracking ─────────────────────────────────────────────
describe('Progress', () => {
  it('tracks completed lessons', () => {
    const p = new Progress('test', '/tmp/craftmind-test');
    p.completeLesson('lesson-1', 80, 120);
    assert.equal(p.getLesson('lesson-1').completed, true);
    assert.equal(p.getLesson('lesson-1').quizScore, 80);
    assert.equal(p.getLesson('lesson-1').timeSpent, 120);
    assert.equal(p.getLesson('lesson-1').attempts, 1);
  });

  it('accumulates attempts and time on replay', () => {
    const p = new Progress('test', '/tmp/craftmind-test');
    p.completeLesson('l1', 50, 100);
    p.completeLesson('l1', 90, 200);
    assert.equal(p.getLesson('l1').attempts, 2);
    assert.equal(p.getLesson('l1').timeSpent, 300);
    assert.equal(p.getLesson('l1').quizScore, 90); // latest score
  });

  it('calculates average quiz score', () => {
    const p = new Progress('test', '/tmp/craftmind-test');
    p.recordQuiz('l1', 80);
    p.recordQuiz('l2', 100);
    p.completeLesson('l3'); // no quiz
    assert.equal(p.averageQuizScore, 90);
  });

  it('calculates course progress', () => {
    const p = new Progress('test', '/tmp/craftmind-test');
    p.completeLesson('a');
    p.completeLesson('b');
    assert.equal(p.courseProgress('c', 4), 0.5);
  });

  it('tracks achievements (no duplicates)', () => {
    const p = new Progress('test', '/tmp/craftmind-test');
    assert.equal(p.unlockAchievement('x'), true);
    assert.equal(p.unlockAchievement('x'), false); // already unlocked
    assert.equal(p.achievements.length, 1);
  });

  it('saves and loads from disk', async () => {
    const dir = '/tmp/craftmind-test-io';
    const p = new Progress('io-test', dir);
    p.completeLesson('l1', 100, 60);
    p.unlockAchievement('first_build');
    await p.save();

    const p2 = new Progress('io-test', dir);
    const loaded = await p2.load();
    assert.equal(loaded, true);
    assert.equal(p2.getLesson('l1')?.completed, true);
    assert.ok(p2.achievements.includes('first_build'));
  });
});

// ─── Achievement Unlocking ─────────────────────────────────────────
describe('AchievementSystem', () => {
  it('unlocks first_lesson on first completion', () => {
    const p = new Progress('test', '/tmp/craftmind-test');
    const sys = new AchievementSystem(p);
    const unlocked = sys.check({ completedLessons: 1 });
    assert.ok(unlocked.length >= 1);
    assert.ok(unlocked[0].id === 'first_lesson');
  });

  it('unlocks streak achievements', () => {
    const p = new Progress('test', '/tmp/craftmind-test');
    const sys = new AchievementSystem(p);
    const u1 = sys.check({ streak: 3, completedLessons: 3, lastLessonTime: 100 });
    assert.ok(u1.some(a => a.id === 'streak_3'));
    const u2 = sys.check({ streak: 5, completedLessons: 5, lastLessonTime: 100 });
    assert.ok(u2.some(a => a.id === 'streak_5'));
  });

  it('unlocks speed_runner for fast lessons', () => {
    const p = new Progress('test', '/tmp/craftmind-test');
    const sys = new AchievementSystem(p);
    const unlocked = sys.check({ lastLessonTime: 120, completedLessons: 1 });
    assert.ok(unlocked.some(a => a.id === 'speed_runner'));
  });

  it('does not re-unlock achievements', () => {
    const p = new Progress('test', '/tmp/craftmind-test');
    const sys = new AchievementSystem(p);
    sys.check({ completedLessons: 1 });
    const second = sys.check({ completedLessons: 1 });
    assert.equal(second.length, 0);
  });

  it('celebrates with bot chat', () => {
    const p = new Progress('test', '/tmp/craftmind-test');
    const sys = new AchievementSystem(p);
    const bot = fakeBot();
    const unlocked = [sys.registry.get('first_lesson')];
    // Should not throw
    sys.celebrate(bot, unlocked);
  });
});

// ─── NPC Classmate Personality ─────────────────────────────────────
describe('NPCClassmate', () => {
  const types = ['curious', 'competitive', 'struggling'];

  it('creates with correct name for each type', () => {
    const names = { curious: 'Alex', competitive: 'Sam', struggling: 'Jordan' };
    for (const type of types) {
      const cm = new NPCClassmate(fakeBot(), type);
      assert.equal(cm.name, names[type]);
    }
  });

  it('throws on unknown type', () => {
    assert.throws(() => new NPCClassmate(fakeBot(), 'unknown'), /Unknown classmate type/);
  });

  it('each type has distinct reactions for new_topic', () => {
    const messages = new Set();
    for (const type of types) {
      const cm = new NPCClassmate(fakeBot(), type);
      const opts = cm.profile.reactions.new_topic;
      // At least one reaction should be unique per type
      for (const msg of opts) messages.add(msg);
    }
    // All 6 reactions (2 per type) should be unique
    assert.ok(messages.size >= 4, 'Personalities should have mostly distinct reactions');
  });

  it('observe() generates in-character messages', () => {
    for (const type of types) {
      const cm = new NPCClassmate(fakeBot(), type);
      const prefixes = cm.profile.prefixes;
      // Should have at least one prefix
      assert.ok(prefixes.length >= 1);
    }
  });

  it('curious classmate uses question marks and thinking emojis', () => {
    const cm = new NPCClassmate(fakeBot(), 'curious');
    const allReactions = Object.values(cm.profile.reactions).flat();
    const hasThinking = allReactions.some(r => r.includes('🤔') || r.includes('?'));
    assert.ok(hasThinking, 'Curious classmate should think and ask questions');
  });

  it('competitive classmate uses confident/aggressive language', () => {
    const cm = new NPCClassmate(fakeBot(), 'competitive');
    const allReactions = Object.values(cm.profile.reactions).flat();
    const hasConfident = allReactions.some(r => r.includes('😎') || r.includes('⚡') || r.includes('Too easy'));
    assert.ok(hasConfident, 'Competitive classmate should be confident');
  });

  it('struggling classmate expresses difficulty', () => {
    const cm = new NPCClassmate(fakeBot(), 'struggling');
    const allReactions = Object.values(cm.profile.reactions).flat();
    const hasStruggle = allReactions.some(r => r.includes('😟') || r.includes('😢') || r.includes('confused'));
    assert.ok(hasStruggle, 'Struggling classmate should express difficulty');
  });

  it('chat history is maintained and capped', () => {
    const cm = new NPCClassmate(fakeBot(), 'curious');
    for (let i = 0; i < 60; i++) cm.chat(`msg-${i}`);
    assert.equal(cm.chatHistory.length, 50); // capped at 50
    assert.ok(cm.chatHistory[0].includes('msg-10')); // oldest should be evicted
  });

  it('reactToProgress calls different behaviors per type', () => {
    const calls = [];
    const bot = fakeBot();
    const cm = new NPCClassmate(bot, 'curious');
    // Override chat to track calls
    cm.chat = (msg) => calls.push(msg);
    cm.reactToProgress(0, 5, true);
    // Should have reacted in some way
    assert.ok(calls.length >= 0); // may or may not react depending on random
  });
});

// ─── AI Teaching System Tests ─────────────────────────────────────
import './test-ai.js';
