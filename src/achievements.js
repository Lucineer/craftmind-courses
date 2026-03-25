/**
 * Achievements — meaningful badge system based on demonstrated competence, not participation.
 *
 * Design principles:
 *   - Achievements should feel earned, not given
 *   - "Built a working AND gate without hints" > "Completed Lesson 3"
 *   - Track hint usage, time, peer teaching, and independent discovery
 *   - Categories: mastery, speed, exploration, social, curriculum
 */

/** @typedef {{id:string, name:string, description:string, icon:string, category:string, rarity:'common'|'rare'|'epic'|'legendary', condition:(ctx:object)=>boolean}} Achievement */

export const ACHIEVEMENTS = [
  // === Mastery (demonstrating competence) ===
  { id: 'first_lesson', name: 'First Steps', description: 'Complete your very first lesson', icon: '🏗️',
    category: 'mastery', rarity: 'common',
    condition: (ctx) => ctx.completedLessons >= 1 },
  { id: 'perfect_quiz', name: 'Quiz Ace', description: 'Get a perfect score on any quiz', icon: '🏆',
    category: 'mastery', rarity: 'rare',
    condition: (ctx) => ctx.perfectQuiz },
  { id: 'speed_runner', name: 'Speed Runner', description: 'Complete a lesson in under 5 minutes', icon: '🏃',
    category: 'mastery', rarity: 'rare',
    condition: (ctx) => ctx.lastLessonTime < 300 },

  // === Independent Discovery (solving without help) ===
  { id: 'independent_solver', name: 'Independent Thinker', description: 'Complete a discovery zone without using any hints', icon: '💡',
    category: 'exploration', rarity: 'epic',
    condition: (ctx) => ctx.independentDiscovery },
  { id: 'three_perfect', name: 'Triple Threat', description: 'Get perfect scores on 3 different quizzes', icon: '⭐',
    category: 'mastery', rarity: 'epic',
    condition: (ctx) => ctx.perfectQuizCount >= 3 },
  { id: 'no_hints_lesson', name: 'Self-Sufficient', description: 'Complete an entire lesson without requesting any hints', icon: '🧠',
    category: 'exploration', rarity: 'rare',
    condition: (ctx) => ctx.completedWithZeroHints },

  // === Social (peer learning) ===
  { id: 'first_teacher', name: 'First Teacher', description: 'Successfully explain a concept to a classmate', icon: '🤝',
    category: 'social', rarity: 'rare',
    condition: (ctx) => ctx.helpedClassmate },
  { id: 'mentor', name: 'Mentor', description: 'Help classmates with 5 different topics', icon: '👨‍🏫',
    category: 'social', rarity: 'epic',
    condition: (ctx) => ctx.topicsHelped >= 5 },
  { id: 'patience', name: 'Infinite Patience', description: 'Give a detailed explanation that scores quality 4+ when helping a classmate', icon: '📖',
    category: 'social', rarity: 'rare',
    condition: (ctx) => ctx.highQualityExplanation },

  // === Curriculum (long-term progression) ===
  { id: 'course_graduate', name: 'Course Graduate', description: 'Complete all lessons in a course', icon: '🎓',
    category: 'curriculum', rarity: 'epic',
    condition: (ctx) => ctx.courseComplete },
  { id: 'multi_course', name: 'Renaissance Crafter', description: 'Complete lessons in 3 different courses', icon: '🌟',
    category: 'curriculum', rarity: 'epic',
    condition: (ctx) => ctx.coursesTouched >= 3 },
  { id: 'full_curriculum', name: 'Master of All Trades', description: 'Complete every available course', icon: '👑',
    category: 'curriculum', rarity: 'legendary',
    condition: (ctx) => ctx.allCoursesComplete },

  // === Streaks (sustained effort) ===
  { id: 'streak_3', name: 'On Fire', description: 'Complete 3 lessons in a row', icon: '🔥',
    category: 'streak', rarity: 'common',
    condition: (ctx) => ctx.streak >= 3 },
  { id: 'streak_5', name: 'Unstoppable', description: 'Complete 5 lessons in a row', icon: '💎',
    category: 'streak', rarity: 'rare',
    condition: (ctx) => ctx.streak >= 5 },
  { id: 'streak_10', name: 'Dedicated Learner', description: 'Complete 10 lessons in a row', icon: '🏅',
    category: 'streak', rarity: 'epic',
    condition: (ctx) => ctx.streak >= 10 },

  // === Curiosity ===
  { id: 'curious_mind', name: 'Curious Mind', description: 'Ask 10 questions during lessons', icon: '🤔',
    category: 'exploration', rarity: 'rare',
    condition: (ctx) => ctx.questionsAsked >= 10 },
  { id: 'review_master', name: 'Review Master', description: 'Successfully review 10 topics through spaced repetition', icon: '🔄',
    category: 'mastery', rarity: 'rare',
    condition: (ctx) => ctx.spacedRepetitionReviews >= 10 },
  { id: 'redstone_master', name: 'Redstone Master', description: 'Complete all redstone courses with average quiz score above 80%', icon: '🔌',
    category: 'curriculum', rarity: 'legendary',
    condition: (ctx) => ctx.redstoneMaster },
];

export class AchievementSystem {
  /** @param {import('./progress.js').Progress} progress */
  constructor(progress) {
    this.progress = progress;
    /** @type {Map<string, Achievement>} */
    this.registry = new Map(ACHIEVEMENTS.map(a => [a.id, a]));
  }

  /**
   * Check all achievements against current context and unlock new ones.
   * @param {object} ctx — context with properties matching condition checks
   * @returns {Achievement[]} newly unlocked achievements
   */
  check(ctx) {
    const newlyUnlocked = [];
    for (const ach of ACHIEVEMENTS) {
      if (this.progress.achievements.includes(ach.id)) continue;
      if (ach.condition(ctx)) {
        this.progress.unlockAchievement(ach.id);
        newlyUnlocked.push(ach);
      }
    }
    return newlyUnlocked;
  }

  /**
   * Announce unlocked achievements in chat with rarity-appropriate fanfare.
   */
  celebrate(bot, achievements) {
    for (const ach of achievements) {
      const rarityColors = { common: '⬜', rare: '🟦', epic: '🟪', legendary: '🟨' };
      const rarityLabel = ach.rarity.toUpperCase();
      const color = rarityColors[ach.rarity] ?? '⬜';

      bot.chat('');
      bot.chat(`${color}════════════════════════════${color}`);
      bot.chat(`  ${ach.icon} ACHIEVEMENT UNLOCKED!`);
      bot.chat(`  [${rarityLabel}] ${ach.name}`);
      bot.chat(`  ${ach.description}`);
      if (ach.rarity === 'legendary') {
        bot.chat(`  🌟🌟🌟 LEGENDARY! 🌟🌟🌟`);
      }
      bot.chat(`${color}════════════════════════════${color}`);
      bot.chat('');
    }
  }

  /** Get all achievements with unlock status */
  getAllWithStatus() {
    return ACHIEVEMENTS.map(a => ({
      ...a,
      unlocked: this.progress.achievements.includes(a.id),
    }));
  }

  /** Get achievements by category */
  getByCategory(category) {
    return ACHIEVEMENTS.filter(a => a.category === category).map(a => ({
      ...a,
      unlocked: this.progress.achievements.includes(a.id),
    }));
  }
}
