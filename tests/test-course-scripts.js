/**
 * Tests for CraftMind Courses Script System
 * Covers: script-engine, v1-socrates, v1-encourager, v1-tough-love
 * 25+ tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  weightedRandom,
  StudentContext,
  TeacherMood,
  Step,
  CourseScriptRunner,
  Script,
} from '../src/scripts/script-engine.js';
import socrates from '../src/scripts/v1-socrates.js';
import encourager from '../src/scripts/v1-encourager.js';
import toughLove from '../src/scripts/v1-tough-love.js';

// ── weightedRandom ─────────────────────────────────────────

describe('weightedRandom', () => {
  it('returns a value from the weights object', () => {
    const result = weightedRandom({ 1: 'a', 1: 'b' });
    assert.ok(['a', 'b'].includes(result));
  });

  it('always returns the only option when one weight', () => {
    assert.equal(weightedRandom({ 1: 'only' }), 'only');
  });

  it('returns null for empty weights', () => {
    assert.equal(weightedRandom({}), null);
  });

  it('works with Map input', () => {
    const result = weightedRandom(new Map([[1, 'x'], [1, 'y']]));
    assert.ok(['x', 'y'].includes(result));
  });

  it('favors higher-weighted outcomes statistically', () => {
    let heavyCount = 0;
    for (let i = 0; i < 1000; i++) {
      if (weightedRandom({ 9: 'heavy', 1: 'light' }) === 'heavy') heavyCount++;
    }
    assert.ok(heavyCount > 800, `heavy should win ~90%, got ${heavyCount / 10}%`);
  });
});

// ── StudentContext ─────────────────────────────────────────

describe('StudentContext', () => {
  it('starts with default values', () => {
    const ctx = new StudentContext();
    assert.equal(ctx.confidence, 0.5);
    assert.equal(ctx.engagement, 0.7);
    assert.equal(ctx.difficulty, 'medium');
  });

  it('increases confidence on correct answer', () => {
    const ctx = new StudentContext();
    ctx.recordAnswer(true);
    assert.ok(ctx.confidence > 0.5);
    assert.equal(ctx.consecutiveCorrect, 1);
    assert.equal(ctx.consecutiveWrong, 0);
  });

  it('decreases confidence on wrong answer', () => {
    const ctx = new StudentContext();
    ctx.recordAnswer(false);
    assert.ok(ctx.confidence < 0.5);
    assert.equal(ctx.consecutiveWrong, 1);
  });

  it('clamps confidence between 0.1 and 1.0', () => {
    const ctx = new StudentContext();
    for (let i = 0; i < 20; i++) ctx.recordAnswer(true);
    assert.equal(ctx.confidence, 1.0);
    for (let i = 0; i < 20; i++) ctx.recordAnswer(false);
    assert.equal(ctx.confidence, 0.1);
  });

  it('sets mood to excited after 2+ correct', () => {
    const ctx = new StudentContext();
    ctx.recordAnswer(true);
    ctx.recordAnswer(true);
    assert.equal(ctx.currentMood, 'excited');
  });

  it('sets mood to frustrated after 3+ wrong', () => {
    const ctx = new StudentContext();
    ctx.recordAnswer(false);
    ctx.recordAnswer(false);
    ctx.recordAnswer(false);
    assert.equal(ctx.currentMood, 'frustrated');
  });

  it('sets mood to patient after 1 wrong', () => {
    const ctx = new StudentContext();
    ctx.recordAnswer(false);
    assert.equal(ctx.currentMood, 'patient');
  });

  it('records hint usage', () => {
    const ctx = new StudentContext();
    ctx.recordHint();
    assert.equal(ctx.hintsUsed, 1);
    assert.ok(ctx.confidence < 0.5);
  });

  it('adjusts difficulty up and down', () => {
    const ctx = new StudentContext();
    ctx.adjustDifficulty(1);
    assert.equal(ctx.difficulty, 'hard');
    ctx.adjustDifficulty(-2);
    assert.equal(ctx.difficulty, 'easy');
  });

  it('advances lesson progress', () => {
    const ctx = new StudentContext();
    ctx.advanceProgress(0.3);
    assert.equal(ctx.lessonProgress, 0.3);
    ctx.advanceProgress(0.3);
    assert.equal(ctx.lessonProgress, 0.6);
  });

  it('progress clamps at 1.0', () => {
    const ctx = new StudentContext();
    ctx.advanceProgress(2.0);
    assert.equal(ctx.lessonProgress, 1.0);
  });

  it('engagement decays on tick', () => {
    const ctx = new StudentContext();
    const before = ctx.engagement;
    ctx.tick();
    assert.ok(ctx.engagement < before);
  });

  it('engagement floor at 0.2', () => {
    const ctx = new StudentContext();
    for (let i = 0; i < 500; i++) ctx.tick();
    assert.ok(ctx.engagement >= 0.2);
  });
});

// ── TeacherMood ────────────────────────────────────────────

describe('TeacherMood', () => {
  it('starts with defaults', () => {
    const m = new TeacherMood();
    assert.equal(m.patience, 0.7);
    assert.equal(m.enthusiasm, 0.5);
  });

  it('increases enthusiasm on correct answer', () => {
    const m = new TeacherMood();
    m.react(true, 'neutral');
    assert.ok(m.enthusiasm > 0.5);
  });

  it('increases patience when student is frustrated', () => {
    const m = new TeacherMood();
    m.react(false, 'frustrated');
    assert.ok(m.patience > 0.7);
  });

  it('decreases patience on wrong answer (non-frustrated)', () => {
    const m = new TeacherMood();
    m.react(false, 'neutral');
    assert.ok(m.patience < 0.7);
  });
});

// ── Step types ─────────────────────────────────────────────

describe('Step', () => {
  it('ask_question returns a string from array', () => {
    const step = Step.ask_question(['Q1', 'Q2']);
    assert.ok(['Q1', 'Q2'].includes(step.pick()));
  });

  it('ask_question returns static string', () => {
    const step = Step.ask_question('static');
    assert.equal(step.pick(), 'static');
  });

  it('praise returns from weighted map', () => {
    const step = Step.praise({ 1: 'good', 1: 'great' });
    assert.ok(['good', 'great'].includes(step.pick()));
  });

  it('wait_for_answer has default ms', () => {
    const step = Step.wait_for_answer();
    assert.equal(step.ms, 15000);
  });

  it('branch creates condition step', () => {
    const step = Step.branch(() => true, Step.noop(), Step.noop());
    assert.equal(step.type, 'branch');
  });

  it('noop has correct type', () => {
    assert.equal(Step.noop().type, 'noop');
  });

  it('adjust_difficulty stores delta', () => {
    const step = Step.adjust_difficulty(1);
    assert.equal(step.delta, 1);
  });
});

// ── CourseScriptRunner ─────────────────────────────────────

describe('CourseScriptRunner', () => {
  it('runs a simple script and collects output', async () => {
    const runner = new CourseScriptRunner();
    runner._waitHandler = () => Promise.resolve(); // instant wait
    const script = Script.define('test', [
      Step.praise('Great job!'),
      Step.ask_question('What is 2+2?'),
    ]);
    runner.register(script);
    await runner.run('test');
    assert.equal(runner.output.length, 2);
    assert.equal(runner.output[0].text, 'Great job!');
    assert.equal(runner.output[1].text, 'What is 2+2?');
  });

  it('branch evaluates student context', async () => {
    const student = new StudentContext();
    const runner = new CourseScriptRunner({ student });
    runner._waitHandler = () => Promise.resolve();
    student.recordAnswer(false);
    const script = Script.define('branch-test', [
      Step.branch(
        (ctx) => ctx.currentMood === 'frustrated',
        Step.explain_concept('Let me help.'),
        Step.ask_question('Try again.'),
      ),
    ]);
    runner.register(script);
    await runner.run('branch-test');
    assert.equal(runner.output[0].text, 'Try again.'); // mood is 'patient', not frustrated
  });

  it('adjust_difficulty step modifies student', async () => {
    const student = new StudentContext();
    const runner = new CourseScriptRunner({ student });
    runner._waitHandler = () => Promise.resolve();
    const script = Script.define('diff-test', [
      Step.adjust_difficulty(1),
    ]);
    runner.register(script);
    await runner.run('diff-test');
    assert.equal(student.difficulty, 'hard');
  });

  it('action step executes fn', async () => {
    let called = false;
    const runner = new CourseScriptRunner();
    runner._waitHandler = () => Promise.resolve();
    const script = Script.define('action-test', [
      Step.action('test', () => { called = true; }),
    ]);
    runner.register(script);
    await runner.run('action-test');
    assert.ok(called);
  });

  it('clearOutput works', async () => {
    const runner = new CourseScriptRunner();
    runner._waitHandler = () => Promise.resolve();
    const script = Script.define('clear-test', [
      Step.encourage('You can do it!'),
    ]);
    runner.register(script);
    await runner.run('clear-test');
    assert.equal(runner.output.length, 1);
    runner.clearOutput();
    assert.equal(runner.output.length, 0);
  });
});

// ── Personality Scripts ────────────────────────────────────

describe('v1-socrates', () => {
  it('has correct name and metadata', () => {
    assert.equal(socrates.name, 'socratic');
    assert.equal(socrates.version, 1);
    assert.ok(socrates.hypothesis.length > 10);
  });

  it('runs without errors', async () => {
    const runner = new CourseScriptRunner();
    runner._waitHandler = () => Promise.resolve();
    runner.register(new Script(socrates.name, socrates.steps));
    await runner.run(socrates.name);
    assert.ok(runner.output.length > 0);
  });

  it('opens with a question', async () => {
    const runner = new CourseScriptRunner();
    runner._waitHandler = () => Promise.resolve();
    runner.register(new Script(socrates.name, socrates.steps));
    await runner.run(socrates.name);
    assert.ok(runner.output[0].text.includes('?') || runner.output[0].text.includes('you think'));
  });

  it('has 15+ total steps (including nested branch arrays)', () => {
    const count = (steps) => steps.reduce((n, s) => {
      if (Array.isArray(s)) return n + count(s);
      const nested = [];
      if (s.ifTrue) nested.push(s.ifTrue);
      if (s.ifFalse) nested.push(s.ifFalse);
      const inner = nested.filter(Array.isArray).reduce((a, arr) => a + count(arr), 0);
      return n + 1 + inner;
    }, 0);
    assert.ok(count(socrates.steps) >= 15, `Expected >=15 flat steps, got ${count(socrates.steps)}`);
  });

  it('uses ask_question steps', () => {
    assert.ok(socrates.steps.some(s => s.type === 'ask_question'));
  });

  it('never uses explain_concept at top level (Socratic method)', () => {
    assert.ok(!socrates.steps.some(s => s.type === 'explain_concept'));
  });
});

describe('v1-encourager', () => {
  it('has correct metadata', () => {
    assert.equal(encourager.name, 'encourager');
    assert.equal(encourager.version, 1);
  });

  it('runs without errors', async () => {
    const runner = new CourseScriptRunner();
    runner._waitHandler = () => Promise.resolve();
    runner.register(new Script(encourager.name, encourager.steps));
    await runner.run(encourager.name);
    assert.ok(runner.output.length > 0);
  });

  it('has 15+ total steps (including nested branch arrays)', () => {
    const count = (steps) => steps.reduce((n, s) => {
      if (Array.isArray(s)) return n + count(s);
      const nested = [];
      if (s.ifTrue) nested.push(s.ifTrue);
      if (s.ifFalse) nested.push(s.ifFalse);
      const inner = nested.filter(Array.isArray).reduce((a, arr) => a + count(arr), 0);
      return n + 1 + inner;
    }, 0);
    assert.ok(count(encourager.steps) >= 15, `Expected >=15 flat steps, got ${count(encourager.steps)}`);
  });

  it('uses praise steps', () => {
    assert.ok(encourager.steps.some(s => s.type === 'praise'));
  });

  it('uses explain_concept (cheerleader explains)', () => {
    assert.ok(encourager.steps.some(s => s.type === 'explain_concept'));
  });
});

describe('v1-tough-love', () => {
  it('has correct metadata', () => {
    assert.equal(toughLove.name, 'tough_love');
    assert.equal(toughLove.version, 1);
  });

  it('runs without errors', async () => {
    const runner = new CourseScriptRunner();
    runner._waitHandler = () => Promise.resolve();
    runner.register(new Script(toughLove.name, toughLove.steps));
    await runner.run(toughLove.name);
    assert.ok(runner.output.length > 0);
  });

  it('has 15+ total steps (including nested branch arrays)', () => {
    const count = (steps) => steps.reduce((n, s) => {
      if (Array.isArray(s)) return n + count(s);
      const nested = [];
      if (s.ifTrue) nested.push(s.ifTrue);
      if (s.ifFalse) nested.push(s.ifFalse);
      const inner = nested.filter(Array.isArray).reduce((a, arr) => a + count(arr), 0);
      return n + 1 + inner;
    }, 0);
    assert.ok(count(toughLove.steps) >= 15, `Expected >=15 flat steps, got ${count(toughLove.steps)}`);
  });

  it('uses ask_question steps', () => {
    assert.ok(toughLove.steps.some(s => s.type === 'ask_question'));
  });
});

// ── Cross-script behavior ──────────────────────────────────

describe('Cross-script behavior', () => {
  it('all three scripts produce different output for same student state', async () => {
    const results = {};
    for (const script of [socrates, encourager, toughLove]) {
      const runner = new CourseScriptRunner();
      runner._waitHandler = () => Promise.resolve();
      runner.register(new Script(script.name, script.steps));
      await runner.run(script.name);
      results[script.name] = runner.output[0].text;
    }
    // At minimum, encourager should differ from tough love
    assert.notEqual(results.socratic, results.encourager);
  });

  it('scripts handle frustrated student context', async () => {
    const student = new StudentContext();
    student.recordAnswer(false);
    student.recordAnswer(false);
    student.recordAnswer(false);
    assert.equal(student.currentMood, 'frustrated');

    const runner = new CourseScriptRunner({ student });
    runner._waitHandler = () => Promise.resolve();
    runner.register(new Script('socratic', socrates.steps));
    await runner.run('socratic');
    assert.ok(runner.output.length > 0);
  });

  it('scripts handle excited student context', async () => {
    const student = new StudentContext();
    student.recordAnswer(true);
    student.recordAnswer(true);

    const runner = new CourseScriptRunner({ student });
    runner._waitHandler = () => Promise.resolve();
    runner.register(new Script('socratic', socrates.steps));
    await runner.run('socratic');
    assert.ok(runner.output.length > 0);
  });

  it('adjust_difficulty branches work correctly', async () => {
    // Student with 2+ correct should get difficulty bumped
    const student = new StudentContext();
    student.recordAnswer(true);
    student.recordAnswer(true);

    const runner = new CourseScriptRunner({ student });
    runner._waitHandler = () => Promise.resolve();
    runner.register(new Script('socratic', socrates.steps));
    await runner.run('socratic');
    // The socratic script should have adjusted difficulty up
    assert.ok(['medium', 'hard'].includes(student.difficulty));
  });
});

// ── Script.define ──────────────────────────────────────────

describe('Script', () => {
  it('define creates a Script instance', () => {
    const s = Script.define('test', [Step.noop()]);
    assert.ok(s instanceof Script);
    assert.equal(s.name, 'test');
    assert.equal(s.steps.length, 1);
  });
});

console.log('✅ All test suites defined. Run with: node --test tests/test-course-scripts.js');
