/**
 * Lesson Flow Controller — Orchestrates classroom lesson phases.
 * Manages INTRO → TEACH → QUIZ → PRACTICE → REVIEW → DISMISS transitions.
 */

import { MultiplayerQuiz } from './multiplayer-quiz.js';
import { StudentTracker } from './student-tracker.js';

/**
 * @typedef {object} PhaseConfig
 * @property {number} duration — Phase duration in seconds (0 = indefinite)
 * @property {boolean} skippable — Can students vote to skip
 * @property {string} announcement — Message to announce phase start
 * @property {string} completion — Message when phase completes
 */

/**
 * Lesson phases
 */
export const LessonPhases = {
  INTRO: 'INTRO',
  TEACH: 'TEACH',
  QUIZ: 'QUIZ',
  PRACTICE: 'PRACTICE',
  REVIEW: 'REVIEW',
  DISMISS: 'DISMISS',
};

/**
 * Phase configurations
 */
const PhaseDefaults = {
  [LessonPhases.INTRO]: {
    duration: 120, // 2 minutes
    skippable: true,
    announcement: '📖 Welcome to class! Let\'s get started.',
    completion: '✅ Introduction complete!',
  },
  [LessonPhases.TEACH]: {
    duration: 600, // 10 minutes
    skippable: false,
    announcement: '👨‍🏫 Time to learn something new!',
    completion: '✅ Lesson delivered!',
  },
  [LessonPhases.QUIZ]: {
    duration: 300, // 5 minutes
    skippable: true,
    announcement: '📝 Quiz time! Let\'s see what you learned.',
    completion: '✅ Quiz complete!',
  },
  [LessonPhases.PRACTICE]: {
    duration: 420, // 7 minutes
    skippable: true,
    announcement: '🔨 Practice time! Apply what you learned.',
    completion: '✅ Practice complete!',
  },
  [LessonPhases.REVIEW]: {
    duration: 180, // 3 minutes
    skippable: false,
    announcement: '📚 Let\'s review what we learned today.',
    completion: '✅ Review complete!',
  },
  [LessonPhases.DISMISS]: {
    duration: 30, // 30 seconds
    skippable: false,
    announcement: '👋 Great job today! Class dismissed.',
    completion: '🏁 Session complete!',
  },
};

/**
 * Lesson Flow Controller
 */
export class LessonFlow {
  /**
   * @param {import('mineflayer').Bot} teacherBot
   * @param {MultiplayerQuiz} quiz
   * @param {StudentTracker} tracker
   * @param {object} [opts]
   * @param {object} [opts.phaseConfig] — Custom phase configurations
   * @param {Function} [opts.onPhaseChange] — Callback(phase, previousPhase)
   * @param {Function} [opts.onPhaseComplete] — Callback(phase, duration)
   */
  constructor(teacherBot, quiz, tracker, opts = {}) {
    this.teacher = teacherBot;
    this.quiz = quiz;
    this.tracker = tracker;

    this.phaseConfig = {
      ...PhaseDefaults,
      ...opts.phaseConfig,
    };

    this.onPhaseChange = opts.onPhaseChange || null;
    this.onPhaseComplete = opts.onPhaseComplete || null;

    this.currentPhase = null;
    this.previousPhase = null;
    this.phaseStartTime = null;
    this.phaseTimer = null;
    this.isPaused = false;
    this.pauseTime = null;

    this.lesson = null;
    this.started = false;
    this.completed = false;
  }

  /**
   * Start the lesson flow
   * @param {object} lesson — Lesson object from course
   * @param {string} [startPhase] — Phase to start from (default: INTRO)
   */
  async start(lesson, startPhase = LessonPhases.INTRO) {
    if (this.started) {
      throw new Error('Lesson already started. Use nextPhase() or resume().');
    }

    this.lesson = lesson;
    this.started = true;
    this.completed = false;

    console.log(`📖 Starting lesson: ${lesson.title}`);
    await this.transitionTo(startPhase);
  }

  /**
   * Transition to a specific phase
   * @param {string} phase
   */
  async transitionTo(phase) {
    if (this.completed && phase !== LessonPhases.DISMISS) {
      throw new Error('Lesson is completed. Cannot transition to new phase.');
    }

    // Clear existing timer
    if (this.phaseTimer) {
      clearTimeout(this.phaseTimer);
      this.phaseTimer = null;
    }

    this.previousPhase = this.currentPhase;
    this.currentPhase = phase;
    this.phaseStartTime = Date.now();

    const config = this.phaseConfig[phase];
    if (!config) {
      throw new Error(`Unknown phase: ${phase}`);
    }

    // Announce phase
    this.teacher.chat('');
    this.teacher.chat(config.announcement);
    this.teacher.chat('');

    // Execute phase-specific actions
    await this.executePhase(phase);

    // Notify callback
    if (this.onPhaseChange) {
      this.onPhaseChange(phase, this.previousPhase);
    }

    // Set timer for phase completion
    if (config.duration > 0 && !this.isPaused) {
      this.phaseTimer = setTimeout(() => {
        this.completePhase();
      }, config.duration * 1000);
    }
  }

  /**
   * Execute phase-specific actions
   * @param {string} phase
   */
  async executePhase(phase) {
    switch (phase) {
      case LessonPhases.INTRO:
        await this.executeIntro();
        break;

      case LessonPhases.TEACH:
        await this.executeTeach();
        break;

      case LessonPhases.QUIZ:
        await this.executeQuiz();
        break;

      case LessonPhases.PRACTICE:
        await this.executePractice();
        break;

      case LessonPhases.REVIEW:
        await this.executeReview();
        break;

      case LessonPhases.DISMISS:
        await this.executeDismiss();
        break;
    }
  }

  /**
   * Execute INTRO phase
   */
  async executeIntro() {
    const lesson = this.lesson;

    // Lesson title and description
    this.teacher.chat(`📖 ${lesson.title}`);
    this.teacher.chat('');
    this.teacher.chat(lesson.description);
    this.teacher.chat('');

    // Objectives
    this.teacher.chat('🎯 Today\'s objectives:');
    lesson.objectives.forEach((obj, i) => {
      this.teacher.chat(`  ${i + 1}. ${obj}`);
    });
    this.teacher.chat('');

    // Difficulty
    const difficultyStars = '⭐'.repeat(lesson.difficulty || 3);
    this.teacher.chat(`Difficulty: ${difficultyStars} (${lesson.estimatedMinutes || 10} min)`);
    this.teacher.chat('');

    // Prerequisites check
    if (lesson.prerequisites && lesson.prerequisites.length > 0) {
      this.teacher.chat('📚 Prerequisites:');
      lesson.prerequisites.forEach(prereq => {
        this.teacher.chat(`  • ${prereq}`);
      });
      this.teacher.chat('');
    }

    // Welcome message
    this.teacher.chat('👋 Welcome, everyone! Let\'s dive in!');
    this.teacher.chat('');
  }

  /**
   * Execute TEACH phase
   */
  async executeTeach() {
    const lesson = this.lesson;

    // Walk through lesson steps
    if (lesson.steps && lesson.steps.length > 0) {
      this.teacher.chat(`📚 We have ${lesson.steps.length} steps to cover today.`);
      this.teacher.chat('');

      for (let i = 0; i < lesson.steps.length; i++) {
        if (this.isPaused) {
          await this.waitForResume();
        }

        const step = lesson.steps[i];
        const stepNum = i + 1;

        this.teacher.chat(`📍 Step ${stepNum}/${lesson.steps.length}: ${step.description}`);

        // Handle different step types
        switch (step.type) {
          case 'navigate_to':
            this.teacher.chat(`🗺️ Go to: ${step.target.x}, ${step.target.y}, ${step.target.z}`);
            break;

          case 'build_block':
            this.teacher.chat(`🔨 Build: ${step.blockType} at the specified location.`);
            break;

          case 'interact_npc':
            this.teacher.chat('💬 Come to me when you\'re ready to discuss!');
            break;

          case 'observe':
            this.teacher.chat('👀 Watch this demonstration carefully.');
            break;

          case 'solve_puzzle':
            this.teacher.chat('🧩 Puzzle time! Use what you\'ve learned.');
            break;

          case 'complete_challenge':
            this.teacher.chat('🏆 Challenge: Put your skills to the test!');
            break;

          case 'discovery':
            this.teacher.chat(`🔍 ${step.discovery?.title || 'Discovery Zone'}`);
            break;

          default:
            this.teacher.chat(`➡️ ${step.description}`);
        }

        // Wait for students to complete step
        await this.delay(5000); // 5 seconds per step (adjust as needed)
        this.teacher.chat('');
      }
    }

    this.teacher.chat('✅ Teaching complete! Any questions before we move on?');
    this.teacher.chat('');
  }

  /**
   * Execute QUIZ phase
   */
  async executeQuiz() {
    const lesson = this.lesson;

    if (!lesson.quiz || lesson.quiz.length === 0) {
      this.teacher.chat('📝 No quiz for this lesson. Moving on...');
      return;
    }

    this.teacher.chat(`📝 Quiz time! ${lesson.quiz.length} questions.`);
    this.teacher.chat('');

    // Run quiz questions
    for (let i = 0; i < lesson.quiz.length; i++) {
      if (this.isPaused) {
        await this.waitForResume();
      }

      const q = lesson.quiz[i];
      await this.quiz.ask(q);

      // Wait for quiz to complete (reveal is called automatically or manually)
      await this.delay(3000); // Brief pause between questions
    }

    // End quiz
    this.quiz.endQuiz();
  }

  /**
   * Execute PRACTICE phase
   */
  async executePractice() {
    this.teacher.chat('🔨 Practice time!');
    this.teacher.chat('Apply what you learned. Work together if you get stuck!');
    this.teacher.chat('');
    this.teacher.chat('💡 Tip: Teach your classmates — it helps you learn too!');
    this.teacher.chat('');

    // In a real implementation, this would set up practice challenges
    // For now, we'll announce and let students work
    this.teacher.chat('🎯 Practice challenge set up. Begin when ready!');
  }

  /**
   * Execute REVIEW phase
   */
  async executeReview() {
    const stats = this.tracker.getClassroomStats();
    const leaderboard = this.tracker.getLeaderboard(5);

    this.teacher.chat('📚 Let\'s review what we learned today.');
    this.teacher.chat('');

    // Class performance
    this.teacher.chat(`📊 Class Performance:`);
    this.teacher.chat(`  Total Answers: ${stats.totalAnswers}`);
    this.teacher.chat(`  Accuracy: ${(stats.classAccuracy * 100).toFixed(0)}%`);
    this.teacher.chat(`  Best Streak: ${stats.bestStreak}`);
    this.teacher.chat('');

    // Top performers
    if (leaderboard.length > 0) {
      this.teacher.chat('🏆 Top Performers:');
      leaderboard.forEach((student, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
        this.teacher.chat(`  ${medal} ${student.name}: ${student.totalScore}pts`);
      });
      this.teacher.chat('');
    }

    // Topics to review
    const weakTopics = this.identifyWeakTopics();
    if (weakTopics.length > 0) {
      this.teacher.chat('💪 Areas to review:');
      weakTopics.forEach(topic => {
        this.teacher.chat(`  • ${topic}`);
      });
      this.teacher.chat('');
    }

    // Spaced repetition reminder
    this.teacher.chat('🔄 Remember: Review this material in a few days for best retention!');
    this.teacher.chat('');
  }

  /**
   * Execute DISMISS phase
   */
  async executeDismiss() {
    const stats = this.tracker.getClassroomStats();

    this.teacher.chat('👋 Great work today, everyone!');
    this.teacher.chat('');

    // Final stats
    this.teacher.chat(`📊 Session Summary:`);
    this.teacher.chat(`  Students: ${stats.totalStudents}`);
    this.teacher.chat(`  Answers: ${stats.totalAnswers}`);
    this.teacher.chat(`  Accuracy: ${(stats.classAccuracy * 100).toFixed(0)}%`);
    this.teacher.chat(`  Duration: ${Math.floor(stats.classroomDuration / 60)}min`);
    this.teacher.chat('');

    // Homework / next lesson
    this.teacher.chat('📚 Don\'t forget to review your notes!');
    this.teacher.chat('📅 See you next time!');
    this.teacher.chat('');

    this.completed = true;
    this.started = false;
  }

  /**
   * Complete current phase and move to next
   */
  completePhase() {
    if (!this.currentPhase) return;

    const config = this.phaseConfig[this.currentPhase];
    const duration = this.phaseStartTime ? (Date.now() - this.phaseStartTime) / 1000 : 0;

    this.teacher.chat(config.completion);

    // Notify callback
    if (this.onPhaseComplete) {
      this.onPhaseComplete(this.currentPhase, duration);
    }

    // Auto-transition to next phase
    this.nextPhase();
  }

  /**
   * Move to the next phase in sequence
   */
  nextPhase() {
    const phases = Object.values(LessonPhases);
    const currentIndex = phases.indexOf(this.currentPhase);

    if (currentIndex === -1) {
      throw new Error(`Invalid current phase: ${this.currentPhase}`);
    }

    const nextIndex = currentIndex + 1;

    if (nextIndex >= phases.length) {
      // End of lesson
      this.completed = true;
      this.started = false;
      return;
    }

    this.transitionTo(phases[nextIndex]);
  }

  /**
   * Pause the lesson flow
   */
  pause() {
    if (this.isPaused) return;

    this.isPaused = true;
    this.pauseTime = Date.now();

    if (this.phaseTimer) {
      clearTimeout(this.phaseTimer);
      this.phaseTimer = null;
    }

    this.teacher.chat('⏸️ Lesson paused.');
  }

  /**
   * Resume the lesson flow
   */
  resume() {
    if (!this.isPaused) return;

    this.isPaused = false;
    const pausedDuration = Date.now() - this.pauseTime;

    // Adjust phase start time to account for pause
    if (this.phaseStartTime) {
      this.phaseStartTime += pausedDuration;
    }

    const config = this.phaseConfig[this.currentPhase];
    if (config && config.duration > 0) {
      const remainingTime = (config.duration * 1000) - (Date.now() - this.phaseStartTime);

      if (remainingTime > 0) {
        this.phaseTimer = setTimeout(() => {
          this.completePhase();
        }, remainingTime);
      } else {
        // Phase already expired during pause
        this.completePhase();
      }
    }

    this.teacher.chat('▶️ Lesson resumed.');
  }

  /**
   * Skip to next phase (if allowed)
   */
  skip() {
    if (!this.currentPhase) return;

    const config = this.phaseConfig[this.currentPhase];
    if (!config.skippable) {
      this.teacher.chat('❌ This phase cannot be skipped.');
      return;
    }

    this.teacher.chat('⏭️ Skipping phase...');
    this.completePhase();
  }

  /**
   * Get current phase information
   * @returns {object}
   */
  getCurrentPhase() {
    if (!this.currentPhase) return null;

    const config = this.phaseConfig[this.currentPhase];
    const elapsed = this.phaseStartTime ? (Date.now() - this.phaseStartTime) / 1000 : 0;
    const remaining = config.duration - elapsed;

    return {
      phase: this.currentPhase,
      config,
      elapsed,
      remaining,
      isPaused: this.isPaused,
    };
  }

  /**
   * Identify topics that need review based on class performance
   * @returns {string[]}
   */
  identifyWeakTopics() {
    const weak = new Set();

    for (const [name, record] of this.tracker.students) {
      const stats = record.getAllTopicStats();
      stats.forEach(topicStat => {
        if (topicStat.comprehensionScore < 0.7) {
          weak.add(topicStat.topic);
        }
      });
    }

    return Array.from(weak);
  }

  /**
   * Wait for resume if paused
   */
  async waitForResume() {
    while (this.isPaused) {
      await this.delay(100);
    }
  }

  /**
   * Utility: delay
   * @param {number} ms
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * End the lesson immediately
   */
  end() {
    if (this.phaseTimer) {
      clearTimeout(this.phaseTimer);
      this.phaseTimer = null;
    }

    this.completed = true;
    this.started = false;

    this.teacher.chat('🏁 Lesson ended.');
  }
}

export default LessonFlow;
