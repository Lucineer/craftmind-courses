import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { AdaptiveEngine } from './adaptive.js';
import { SpacedRepetition } from './spaced-repetition.js';
import { PeerLearningSystem } from './peer-learning.js';

const DEFAULT_DIR = 'progress';

/**
 * Progress — tracks student progress: completed lessons, quiz scores, time spent,
 * achievements, confidence scores, spaced repetition, and peer learning.
 */
export class Progress {
  /**
   * @param {string} studentName
   * @param {string} [saveDir]
   */
  constructor(studentName, saveDir = DEFAULT_DIR) {
    this.studentName = studentName;
    this.saveDir = saveDir;
    /** @type {Map<string, {completed:boolean, quizScore:number|null, timeSpent:number, completedAt:string|null, attempts:number, hintsUsed:number, coursesTouched:string[]}>} */
    this.lessons = new Map();
    /** @type {string[]} */
    this.achievements = [];
    this.startedAt = new Date().toISOString();
    /** @type {Set<string>} courses touched */
    this.coursesTouched = new Set();

    // Sub-systems
    this.adaptive = new AdaptiveEngine();
    this.spacedRep = new SpacedRepetition();
    this.peerLearning = new PeerLearningSystem();

    // Per-session tracking
    this.currentLessonHintsUsed = 0;
    this.questionsAsked = 0;
    this.perfectQuizCount = 0;
    this.spacedRepetitionReviews = 0;
  }

  /** @param {string} lessonId */
  getLesson(lessonId) {
    return this.lessons.get(lessonId);
  }

  /** Record a lesson as completed. */
  completeLesson(lessonId, quizScore = null, timeSpent = 0, courseId = null) {
    const existing = this.lessons.get(lessonId) ?? { attempts: 0 };
    this.lessons.set(lessonId, {
      ...existing,
      completed: true,
      quizScore,
      timeSpent: (existing.timeSpent ?? 0) + timeSpent,
      completedAt: new Date().toISOString(),
      attempts: existing.attempts + 1,
      hintsUsed: this.currentLessonHintsUsed,
      coursesTouched: courseId ? [...(existing.coursesTouched ?? []), courseId] : existing.coursesTouched ?? [],
    });
    if (courseId) this.coursesTouched.add(courseId);

    // Spaced repetition: register for future review
    this.spacedRep.register(lessonId, 1); // review in 1 hour
    if (quizScore !== null) {
      this.spacedRep.reviewFromQuiz(lessonId, quizScore > 0, this.currentLessonHintsUsed > 0);
    }
  }

  /** Record a quiz attempt. */
  recordQuiz(lessonId, score, totalPoints) {
    const existing = this.lessons.get(lessonId) ?? {};
    this.lessons.set(lessonId, { ...existing, quizScore: score, attempts: (existing.attempts ?? 0) + 1 });

    // Update adaptive engine
    const topic = lessonId;
    this.adaptive.recordQuizAnswer(topic, score > 0);
    if (score === totalPoints && totalPoints > 0) {
      this.perfectQuizCount++;
      this.adaptive.recordPerfectQuiz(topic);
    }
  }

  /** Record that a hint was used in the current lesson. */
  recordHintUsed(lessonId) {
    this.currentLessonHintsUsed++;
    this.adaptive.recordHintUsed(lessonId);
  }

  /** Reset per-lesson tracking. */
  resetLessonTracking() {
    this.currentLessonHintsUsed = 0;
    this.adaptive.resetLessonCounters();
  }

  /** Record a spaced repetition review. */
  recordReview(topic, quality) {
    this.spacedRep.review(topic, quality);
    this.spacedRepetitionReviews++;
  }

  /** @param {string} achievementId @returns {boolean} true if newly unlocked */
  unlockAchievement(achievementId) {
    if (this.achievements.includes(achievementId)) return false;
    this.achievements.push(achievementId);
    return true;
  }

  /** @param {string} courseId @returns {number} 0-1 */
  courseProgress(courseId, totalLessons) {
    let completed = 0;
    for (const l of this.lessons.values()) if (l.completed) completed++;
    return totalLessons ? completed / totalLessons : 0;
  }

  /** @returns {number} Average quiz score across completed lessons. */
  get averageQuizScore() {
    const scores = [...this.lessons.values()].map(l => l.quizScore).filter(s => s !== null && s !== undefined);
    return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  }

  /** @returns {number} Number of distinct courses with at least one completed lesson */
  get courseCount() {
    return this.coursesTouched.size;
  }

  /** Get topics due for spaced repetition review */
  getDueReviews() {
    return this.spacedRep.getDueTopics();
  }

  /** Persist to disk. */
  async save() {
    const dir = join(process.cwd(), this.saveDir);
    await mkdir(dir, { recursive: true });
    const data = {
      studentName: this.studentName,
      startedAt: this.startedAt,
      achievements: this.achievements,
      lessons: Object.fromEntries(this.lessons),
      coursesTouched: [...this.coursesTouched],
      perfectQuizCount: this.perfectQuizCount,
      spacedRepetitionReviews: this.spacedRepetitionReviews,
      questionsAsked: this.questionsAsked,
      adaptive: this.adaptive.toJSON(),
      spacedRep: this.spacedRep.toJSON(),
      peerLearning: this.peerLearning.toJSON(),
    };
    await writeFile(join(dir, `${this.studentName}.json`), JSON.stringify(data, null, 2));
  }

  /** Load from disk. */
  async load() {
    try {
      const raw = JSON.parse(await readFile(join(process.cwd(), this.saveDir, `${this.studentName}.json`), 'utf-8'));
      this.startedAt = raw.startedAt ?? this.startedAt;
      this.achievements = raw.achievements ?? [];
      this.lessons = new Map(Object.entries(raw.lessons ?? {}));
      this.coursesTouched = new Set(raw.coursesTouched ?? []);
      this.perfectQuizCount = raw.perfectQuizCount ?? 0;
      this.spacedRepetitionReviews = raw.spacedRepetitionReviews ?? 0;
      this.questionsAsked = raw.questionsAsked ?? 0;
      if (raw.adaptive) this.adaptive = AdaptiveEngine.fromJSON(raw.adaptive);
      if (raw.spacedRep) this.spacedRep = SpacedRepetition.fromJSON(raw.spacedRep);
      if (raw.peerLearning) {
        this.peerLearning = new PeerLearningSystem();
        this.peerLearning.totalHelped = raw.peerLearning.totalHelped ?? 0;
        this.peerLearning.topicsHelped = new Set(raw.peerLearning.topicsHelped ?? []);
      }
      return true;
    } catch {
      return false;
    }
  }
}

export default Progress;
