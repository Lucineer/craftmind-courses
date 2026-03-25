import mineflayer from 'mineflayer';
import { Course } from './course.js';
import { NPCTeacher } from './npc-teacher.js';
import { NPCClassmate } from './npc-classmate.js';
import { Progress } from './progress.js';
import { WorldBuilder } from './world-builder.js';
import { Quiz } from './quiz.js';
import { AchievementSystem } from './achievements.js';

/**
 * Main entry — connects to Minecraft server, spawns AI teacher + classmates,
 * loads a course, and guides the student through lessons.
 *
 * Usage:  node src/index.js [--host localhost] [--port 25565] [--course courses/redstone-basics.json]
 */
async function main() {
  const args = process.argv.slice(2);
  const host = args[args.indexOf('--host') + 1] ?? process.env.MC_HOST ?? 'localhost';
  const port = parseInt(args[args.indexOf('--port') + 1] ?? process.env.MC_PORT ?? '25565', 10);
  const coursePath = args[args.indexOf('--course') + 1] ?? process.env.COURSE_FILE ?? 'courses/redstone-basics.json';
  const teacherName = args[args.indexOf('--teacher-name') + 1] ?? process.env.TEACHER_NAME ?? 'ProfBlock';

  console.log(`📚 CraftMind Courses — Loading course from ${coursePath}`);

  const course = await Course.fromFile(coursePath);
  console.log(`✅ Loaded "${course.title}" (${course.orderedLessons.length} lessons, ~${course.totalEstimatedMinutes}min)`);

  // Connect student bot (the player that receives guidance)
  const studentBot = mineflayer.createBot({ host, port, username: 'CM_Student', hideErrors: false });

  studentBot.once('spawn', async () => {
    console.log('🎮 Student bot spawned!');

    // Connect teacher
    const teacherBot = mineflayer.createBot({ host, port, username: teacherName, hideErrors: false });
    teacherBot.once('spawn', () => {
      console.log(`👨\u200D🏫 Teacher "${teacherName}" spawned!`);
    });

    // Connect classmates with proper names
    const classmateTypes = ['curious', 'competitive', 'struggling'];
    const classmateNames = { curious: 'Alex', competitive: 'Sam', struggling: 'Jordan' };
    const classmates = classmateTypes.map((type) => {
      const bot = mineflayer.createBot({ host, port, username: `CM_${classmateNames[type]}`, hideErrors: false });
      return { type, bot };
    });

    // Wait for all bots to spawn
    await Promise.all([
      new Promise(r => teacherBot.once('spawn', r)),
      ...classmates.map(c => new Promise(r => c.bot.once('spawn', r))),
    ]);

    // Initialize systems
    const teacher = new NPCTeacher(teacherBot, { name: teacherName, subject: course.title });
    const classmateInstances = classmates.map(c => new NPCClassmate(c.bot, c.type));
    const progress = new Progress('student');
    await progress.load();
    const achievements = new AchievementSystem(progress);
    const worldBuilder = new WorldBuilder(studentBot);

    // Track lesson start times for achievement checks
    /** @type {Map<string, number>} lessonId → start timestamp */
    const lessonStartTimes = new Map();

    // Greet
    await teacher.say('welcome');
    for (const cm of classmateInstances) cm.react('new_topic');

    // Run through course lessons
    for (const lesson of course.orderedLessons) {
      lesson.reset();
      lessonStartTimes.set(lesson.id, Date.now());

      teacherBot.chat(`\n📖 Lesson: ${lesson.title}`);
      teacherBot.chat(lesson.description);
      teacherBot.chat(`Objectives: ${lesson.objectives.join(', ')}`);

      // Build world template if defined
      if (lesson.worldTemplate) {
        await buildWorldFromTemplate(worldBuilder, lesson.worldTemplate);
      }

      // Walk through steps
      while (!lesson.completed) {
        const step = lesson.currentStep;
        if (!step) break;

        teacherBot.chat(`\n📌 Step ${lesson.currentStepIndex + 1}/${lesson.steps.length}: ${step.description}`);
        if (step.type === 'observe') {
          teacherBot.chat('👀 Take a look around and observe what\'s happening...');
          await sleep(5000);
        } else if (step.type === 'navigate_to' && step.target) {
          teacherBot.chat(`🧭 Head to: ${step.target.x}, ${step.target.y}, ${step.target.z}`);
        } else if (step.type === 'build_block') {
          teacherBot.chat('🔨 Time to build! Follow the instructions.');
        } else if (step.type === 'interact_npc') {
          teacherBot.chat('💬 Come talk to me when you\'re ready to discuss what you observed!');
        } else if (step.type === 'solve_puzzle' || step.type === 'complete_challenge') {
          teacherBot.chat('🧩 Puzzle time! Give it your best shot!');
        }

        // Classmates react
        for (const cm of classmateInstances) {
          cm.reactToProgress(lesson.currentStepIndex, lesson.steps.length, false);
        }

        // Wait for student to proceed (chat "done" or "next")
        await waitForChat(studentBot, ['done', 'next', 'ready', 'ok']);
        const isNowComplete = lesson.advanceStep();
        await teacher.say('celebrate');
      }

      // Quiz
      let quizPerfect = false;
      if (lesson.quiz?.length) {
        teacherBot.chat('\n📝 Time for a quiz!');
        const quiz = new Quiz(lesson.quiz, teacherBot);

        // Wire up chat handler for quiz answers
        const quizHandler = (username, message) => {
          quiz.processAnswer(message);
        };
        studentBot.on('chat', quizHandler);

        while (!quiz.isComplete) {
          const result = await quiz.askCurrent();
          if (!result) break;
          // Wait briefly for the answer to be processed via chat handler
          await sleep(15000); // 15s timeout per question
          if (quiz.awaitingAnswer) {
            // Auto-advance if no answer
            quiz.processAnswer('');
          }
        }
        studentBot.off('chat', quizHandler);
        quiz.showResults();
        quizPerfect = quiz.score === quiz.totalPoints;
        progress.recordQuiz(lesson.id, quiz.score);
      }

      // Record completion with actual time
      const lessonTime = (Date.now() - (lessonStartTimes.get(lesson.id) ?? Date.now())) / 1000;
      progress.completeLesson(lesson.id, null, lessonTime);

      // Check achievements
      const completedCount = [...progress.lessons.values()].filter(l => l.completed).length;
      const ctx = {
        completedLessons: completedCount,
        perfectQuiz: quizPerfect,
        lastTopic: course.id,
        lastLessonTime: lessonTime,
        streak: completedCount,
        questionsAsked: 0,
        helpedClassmate: false,
        courseComplete: course.orderedLessons.every(l => progress.getLesson(l.id)?.completed),
      };
      const newlyUnlocked = achievements.check(ctx);
      if (newlyUnlocked.length) achievements.celebrate(teacherBot, newlyUnlocked);

      await progress.save();
      await teacher.say('transition');
    }

    teacherBot.chat('🎉 Congratulations! You\'ve completed the entire course! You\'re amazing!');
  });

  // Helper: wait for specific chat messages
  /**
   * Wait for the student bot to receive a chat message matching one of the triggers.
   * @param {import('mineflayer').Bot} bot
   * @param {string[]} triggers — if empty, matches any message
   * @returns {Promise<string>} the matched message
   */
  function waitForChat(bot, triggers) {
    return new Promise((resolve) => {
      const handler = (username, message) => {
        const lower = message.toLowerCase().trim();
        if (triggers.length === 0 || triggers.some(t => lower.includes(t))) {
          bot.off('chat', handler);
          resolve(message);
        }
      };
      bot.on('chat', handler);
    });
  }
}

/** Build a simple world from a lesson template. */
/**
 * Build learning environment structures from a lesson's worldTemplate definition.
 * @param {WorldBuilder} builder
 * @param {object} template — worldTemplate from lesson JSON
 */
async function buildWorldFromTemplate(builder, template) {
  if (template.room) {
    const { Vec3 } = await import('vec3');
    await builder.buildRoom(Vec3.fromObject(template.room.corner), template.room.dims, template.room.blockId ?? 1);
  }
  if (template.signs) {
    const { Vec3 } = await import('vec3');
    for (const s of template.signs) {
      await builder.placeSign(Vec3.fromObject(s.pos), s.lines);
    }
  }
}

/** @param {number} ms @returns {Promise<void>} */
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

main().catch(console.error);
