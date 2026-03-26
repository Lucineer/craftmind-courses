/**
 * Stochastic Script Engine for CraftMind Courses
 *
 * Adapted from craftmind-fishing's script-engine.js but oriented toward
 * Socratic teaching: asking questions, giving hints, adjusting difficulty,
 * and managing student engagement.
 *
 * Actions: ask_question, explain_concept, give_hint, wait_for_answer,
 *          praise, encourage, adjust_difficulty
 *
 * Context: student progress, topic, difficulty level, engagement score
 * Mood:    patient, excited, frustrated
 */

export function weightedRandom(weights) {
  const entries = weights instanceof Map ? [...weights.entries()] : Object.entries(weights);
  const total = entries.reduce((s, [w]) => s + parseFloat(w), 0);
  if (total <= 0) return entries[0]?.[1] ?? null;
  let roll = Math.random() * total;
  for (const [w, outcome] of entries) {
    roll -= parseFloat(w);
    if (roll <= 0) return outcome;
  }
  return entries[entries.length - 1][1];
}

// ── Student Context ────────────────────────────────────────

export class StudentContext {
  constructor() {
    this.topic = null;
    this.confidence = 0.5;
    this.engagement = 0.7;
    this.consecutiveCorrect = 0;
    this.consecutiveWrong = 0;
    this.hintsUsed = 0;
    this.questionsAnswered = 0;
    this.lessonProgress = 0;
    this.difficulty = 'medium'; // easy, medium, hard
    this.currentMood = 'neutral'; // patient, excited, frustrated, neutral
  }

  recordAnswer(correct) {
    this.questionsAnswered++;
    if (correct) {
      this.consecutiveCorrect++;
      this.consecutiveWrong = 0;
      this.confidence = Math.min(1.0, this.confidence + 0.15);
      this.engagement = Math.min(1.0, this.engagement + 0.05);
    } else {
      this.consecutiveWrong++;
      this.consecutiveCorrect = 0;
      this.confidence = Math.max(0.1, this.confidence - 0.12);
    }
    this._updateMood();
  }

  recordHint() {
    this.hintsUsed++;
    this.confidence = Math.max(0.1, this.confidence - 0.03);
  }

  setTopic(topic) {
    this.topic = topic;
    this.lessonProgress = 0;
  }

  advanceProgress(amount = 0.1) {
    this.lessonProgress = Math.min(1.0, this.lessonProgress + amount);
  }

  adjustDifficulty(delta) {
    const levels = ['easy', 'medium', 'hard'];
    const idx = levels.indexOf(this.difficulty);
    const newIdx = Math.max(0, Math.min(2, idx + delta));
    this.difficulty = levels[newIdx];
  }

  _updateMood() {
    if (this.consecutiveWrong >= 3) {
      this.currentMood = 'frustrated';
    } else if (this.consecutiveCorrect >= 2) {
      this.currentMood = 'excited';
    } else if (this.consecutiveWrong >= 1) {
      this.currentMood = 'patient';
    } else {
      this.currentMood = 'neutral';
    }
  }

  /** Decay engagement slowly over time */
  tick() {
    this.engagement = Math.max(0.2, this.engagement - 0.002);
  }
}

// ── Teaching Step Types ────────────────────────────────────

export class Step {
  /** Ask the student a question */
  static ask_question(msgs) {
    return {
      type: 'ask_question',
      pick: () => {
        if (typeof msgs === 'string') return msgs;
        if (Array.isArray(msgs)) return msgs[Math.floor(Math.random() * msgs.length)];
        return weightedRandom(msgs);
      },
    };
  }

  /** Explain a concept directly */
  static explain_concept(msgs) {
    return {
      type: 'explain_concept',
      pick: () => {
        if (typeof msgs === 'string') return msgs;
        if (Array.isArray(msgs)) return msgs[Math.floor(Math.random() * msgs.length)];
        return weightedRandom(msgs);
      },
    };
  }

  /** Give a hint (partial answer) */
  static give_hint(msgs) {
    return {
      type: 'give_hint',
      pick: () => {
        if (typeof msgs === 'string') return msgs;
        if (Array.isArray(msgs)) return msgs[Math.floor(Math.random() * msgs.length)];
        return weightedRandom(msgs);
      },
    };
  }

  /** Wait for student to answer (or type something) */
  static wait_for_answer(ms = 15000) {
    return { type: 'wait_for_answer', ms };
  }

  /** Praise the student for a correct answer or good attempt */
  static praise(msgs) {
    return {
      type: 'praise',
      pick: () => {
        if (typeof msgs === 'string') return msgs;
        if (Array.isArray(msgs)) return msgs[Math.floor(Math.random() * msgs.length)];
        return weightedRandom(msgs);
      },
    };
  }

  /** Encourage the student (neutral, no judgment) */
  static encourage(msgs) {
    return {
      type: 'encourage',
      pick: () => {
        if (typeof msgs === 'string') return msgs;
        if (Array.isArray(msgs)) return msgs[Math.floor(Math.random() * msgs.length)];
        return weightedRandom(msgs);
      },
    };
  }

  /** Adjust difficulty up or down */
  static adjust_difficulty(delta = 0) {
    return { type: 'adjust_difficulty', delta };
  }

  /** Conditional branch */
  static branch(condition, ifTrue, ifFalse) {
    return { type: 'branch', condition, ifTrue, ifFalse };
  }

  /** Pause */
  static wait(ms) {
    return { type: 'wait', ms };
  }

  /** Custom action */
  static action(name, fn) {
    return { type: 'action', name, fn };
  }

  /** No-op */
  static noop() {
    return { type: 'noop' };
  }

  /** Set context value */
  static set(key, value) {
    return { type: 'set', key, value };
  }
}

// ── Mood System (teacher side) ─────────────────────────────

export class TeacherMood {
  constructor() {
    this.patience = 0.7;
    this.enthusiasm = 0.5;
  }

  /** React to student answer */
  react(studentCorrect, studentMood) {
    if (studentCorrect) {
      this.enthusiasm = Math.min(1.0, this.enthusiasm + 0.1);
      this.patience = Math.min(1.0, this.patience + 0.05);
    } else if (studentMood === 'frustrated') {
      this.patience = Math.min(1.0, this.patience + 0.1);
      this.enthusiasm = Math.max(0.2, this.enthusiasm - 0.05);
    } else {
      this.patience = Math.max(0.1, this.patience - 0.05);
    }
  }

  /** Natural drift toward neutral */
  tick() {
    this.patience += (0.7 - this.patience) * 0.01;
    this.enthusiasm += (0.5 - this.enthusiasm) * 0.01;
  }
}

// ── Script + Runner ────────────────────────────────────────

export class Script {
  constructor(name, steps) {
    this.name = name;
    this.steps = steps;
  }

  static define(name, steps) {
    return new Script(name, steps);
  }
}

export class CourseScriptRunner {
  constructor(options = {}) {
    this.scripts = new Map();
    this.student = options.student || new StudentContext();
    this.mood = options.mood || new TeacherMood();
    this._output = [];          // collected messages for testing
    this._running = false;
    this._waitHandler = null;   // override for testing: fn(ms) => Promise
  }

  /** Register a script */
  register(script) {
    this.scripts.set(script.name, script);
    return this;
  }

  /** Get collected output (for tests) */
  get output() {
    return [...this._output];
  }

  /** Clear output */
  clearOutput() {
    this._output = [];
  }

  /** Emit a message (or collect for testing) */
  emit(msg) {
    this._output.push({ type: 'message', text: msg, timestamp: Date.now() });
  }

  async run(scriptNameOrScript) {
    const script = typeof scriptNameOrScript === 'string'
      ? this.scripts.get(scriptNameOrScript)
      : scriptNameOrScript;

    if (!script) throw new Error(`Script not found: ${scriptNameOrScript}`);

    this._running = true;
    try {
      await this._executeSteps(script.steps);
    } finally {
      this._running = false;
    }
  }

  interrupt() {
    this._running = false;
  }

  get isRunning() {
    return this._running;
  }

  async _executeSteps(steps) {
    for (const step of steps) {
      if (!this._running) return;
      await this._executeStep(step);
    }
  }

  async _executeStep(step) {
    if (!this._running) return;

    switch (step.type) {
      case 'ask_question':
      case 'explain_concept':
      case 'give_hint':
      case 'praise':
      case 'encourage': {
        const msg = step.pick();
        if (msg) this.emit(msg);
        break;
      }

      case 'wait_for_answer':
        await this._wait(step.ms);
        break;

      case 'wait':
        await this._wait(step.ms);
        break;

      case 'adjust_difficulty':
        this.student.adjustDifficulty(step.delta);
        break;

      case 'branch': {
        const result = step.condition(this.student, this.mood);
        const branch = result ? step.ifTrue : step.ifFalse;
        if (Array.isArray(branch)) await this._executeSteps(branch);
        else await this._executeStep(branch);
        break;
      }

      case 'action':
        await step.fn(this.student, this.mood);
        break;

      case 'set':
        this.student[step.key] = step.value;
        break;

      case 'noop':
        break;
    }
  }

  _wait(ms) {
    if (this._waitHandler) return this._waitHandler(ms);
    return new Promise(r => setTimeout(r, ms));
  }
}
