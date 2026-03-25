/**
 * CraftMind Courses — Main orchestrator.
 *
 * Connects to Minecraft server, spawns AI teacher + classmates,
 * loads a course, and guides the student through lessons with:
 *   - Adaptive difficulty (adjusts pace based on performance)
 *   - Spaced repetition (reviews earlier concepts in later lessons)
 *   - Discovery zones (exploration-based learning with progressive hints)
 *   - Peer learning (student can help classmates)
 *   - Skill tree progress visualization
 *   - Teaching style selection
 *   - Real-world insight moments
 *   - Meaningful achievements
 */

import mineflayer from 'mineflayer';
import { Course } from './course.js';
import { NPCTeacher } from './npc-teacher.js';
import { NPCClassmate } from './npc-classmate.js';
import { Progress } from './progress.js';
import { WorldBuilder } from './world-builder.js';
import { Quiz } from './quiz.js';
import { AchievementSystem } from './achievements.js';
import { TeachingStyleManager } from './teaching-styles.js';
import { Curriculum } from './curriculum.js';
import { SkillTree } from './skill-tree.js';
import { DiscoveryZone, discoveryFromStep } from './discovery.js';

async function main() {
  const args = process.argv.slice(2);
  const host = args[args.indexOf('--host') + 1] ?? process.env.MC_HOST ?? 'localhost';
  const port = parseInt(args[args.indexOf('--port') + 1] ?? process.env.MC_PORT ?? '25565', 10);
  const coursePath = args[args.indexOf('--course') + 1] ?? process.env.COURSE_FILE ?? 'courses/redstone-basics.json';
  const teacherName = args[args.indexOf('--teacher-name') + 1] ?? process.env.TEACHER_NAME ?? 'ProfBlock';
  const teachingStyle = args[args.indexOf('--style') + 1] ?? process.env.TEACHING_STYLE ?? 'patient';

  console.log(`📚 CraftMind Courses — Loading course from ${coursePath}`);

  const course = await Course.fromFile(coursePath);
  console.log(`✅ Loaded "${course.title}" (${course.orderedLessons.length} lessons, ~${course.totalEstimatedMinutes}min)`);

  // Connect student bot
  const studentBot = mineflayer.createBot({ host, port, username: 'CM_Student', hideErrors: false });

  studentBot.once('spawn', async () => {
    console.log('🎮 Student bot spawned!');

    // Connect teacher
    const teacherBot = mineflayer.createBot({ host, port, username: teacherName, hideErrors: false });
    const teacherBotSpawn = new Promise(r => teacherBot.once('spawn', r));

    // Connect classmates
    const classmateTypes = ['curious', 'competitive', 'struggling'];
    const classmateNames = { curious: 'Alex', competitive: 'Sam', struggling: 'Jordan' };
    const classmates = classmateTypes.map(type => {
      const bot = mineflayer.createBot({ host, port, username: `CM_${classmateNames[type]}`, hideErrors: false });
      return { type, bot, spawn: new Promise(r => bot.once('spawn', r)) };
    });

    await Promise.all([teacherBotSpawn, ...classmates.map(c => c.spawn)]);
    console.log(`👨‍🏫 Teacher "${teacherName}" and classmates spawned!`);

    // Initialize all systems
    const styleManager = new TeachingStyleManager();
    styleManager.setStyle(teachingStyle);

    const progress = new Progress('student');
    await progress.load();

    const teacher = new NPCTeacher(teacherBot, {
      name: teacherName,
      subject: course.title,
      styleManager,
    });

    const classmateInstances = classmates.map(c => new NPCClassmate(c.bot, c.type, {
      peerLearning: progress.peerLearning,
    }));

    const achievements = new AchievementSystem(progress);
    const worldBuilder = new WorldBuilder(studentBot);

    // Load curriculum if available
    let curriculum = null;
    try {
      curriculum = await Curriculum.fromFile('curriculum.json');
    } catch {
      console.log('ℹ️ No curriculum.json found — single course mode.');
    }

    // Track state
    const lessonStartTimes = new Map();
    let currentDiscoveryZone = null;

    // Greeting with teaching style intro
    teacher.chat(`Hey! I'm ${teacherName}, and I'll be your teacher!`);
    teacher.chat(`Teaching style: ${styleManager.style.name} — ${styleManager.style.description}`);
    teacher.chat("If you want to change my teaching style, just ask! 🎨");
    for (const cm of classmateInstances) cm.react('new_topic');

    // Show skill tree overview
    const skillTree = SkillTree.fromCourse(course, progress, progress.adaptive, progress.spacedRep);
    teacher.chat(skillTree.toASCII());

    // Check for spaced repetition reviews before starting
    const dueReviews = progress.getDueReviews();
    if (dueReviews.length > 0) {
      teacher.chat(`\n🔄 Quick review time! You have ${dueReviews.length} topic(s) to review from earlier.`);
      // Review questions will be injected into the first quiz
    }

    // Run through course lessons
    for (const lesson of course.orderedLessons) {
      lesson.reset();
      lessonStartTimes.set(lesson.id, Date.now());
      progress.resetLessonTracking();

      // Check adaptive difficulty for this topic
      const adaptation = progress.adaptive.getAdaptation(lesson.id);
      teacher.adaptiveFeedback(adaptation);

      teacherBot.chat(`\n📖 Lesson: ${lesson.title}`);
      teacherBot.chat(lesson.description);
      teacherBot.chat(`Objectives: ${lesson.objectives.join(', ')}`);

      // Show written summary for accessibility
      teacherBot.chat(`📋 Summary: ${lesson.getSummary()}`);

      // Build world template if defined
      if (lesson.worldTemplate) {
        await buildWorldFromTemplate(worldBuilder, lesson.worldTemplate);
      }

      // Walk through steps
      while (!lesson.completed) {
        const step = lesson.currentStep;
        if (!step) break;

        const stepNum = lesson.currentStepIndex + 1;

        // Handle discovery zones (exploration-based learning)
        if (step.type === 'discovery') {
          currentDiscoveryZone = discoveryFromStep(step.discovery ?? step);
          teacherBot.chat(`\n🔍 DISCOVERY ZONE: ${currentDiscoveryZone.title}`);
          teacherBot.chat(currentDiscoveryZone.description);
          teacherBot.chat(`💡 Type "hint" if you need help (0 hints used so far — try to solve it yourself first!)`);

          // Wait for student to solve or request hints
          const discoveryResult = await handleDiscovery(studentBot, teacherBot, currentDiscoveryZone);
          if (discoveryResult.solved) {
            const q = currentDiscoveryZone.getQualityRating();
            progress.spacedRep.review(lesson.id, q);
            progress.adaptive.recordChallengeComplete(lesson.id, currentDiscoveryZone.hintsUsed === 0);

            if (currentDiscoveryZone.hintsUsed === 0) {
              teacherBot.chat(`🌟 Incredible! You figured it out completely on your own! That's real learning!`);
            } else {
              teacherBot.chat(`✅ Great job! You solved it with ${currentDiscoveryZone.hintsUsed} hint(s).`);
            }

            // Real-world insight after discovery
            if (currentDiscoveryZone.realWorldInsight) {
              teacher.realWorldInsight(lesson.id, currentDiscoveryZone.realWorldInsight);
            }
          } else {
            teacherBot.chat(`No worries — let's move on. We'll come back to this concept later!`);
          }
          currentDiscoveryZone = null;
          lesson.advanceStep();
          continue;
        }

        teacherBot.chat(`\n📌 Step ${stepNum}/${lesson.steps.length}: ${step.description}`);
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
          teacherBot.chat('💡 Type "hint" if you need a nudge.');
        }

        // Classmates react
        for (const cm of classmateInstances) {
          cm.reactToProgress(lesson.currentStepIndex, lesson.steps.length, false);
        }

        // Peer learning: struggling classmate may ask for help
        if (Math.random() < 0.1 && progress.adaptive.getConfidence(lesson.id) > 0.7) {
          const struggling = classmateInstances.find(c => c.type === 'struggling');
          if (struggling && !struggling.awaitingHelp) {
            const questions = [
              `Can you explain how ${lesson.objectives[0] ?? 'this'} works?`,
              `I'm confused about the step we just did. Can you help?`,
              `What does ${lesson.objectives[1] ?? 'it'} mean in simple terms?`,
            ];
            struggling.askForHelp(lesson.id, questions[Math.floor(Math.random() * questions.length)]);
          }
        }

        // Wait for student to proceed
        const studentMessage = await waitForChat(studentBot, ['done', 'next', 'ready', 'ok', 'hint']);

        // Handle hint requests
        if (studentMessage.toLowerCase().includes('hint')) {
          progress.recordHintUsed(lesson.id);
          await teacher.say('hint', `Step: ${step.description}`);
          // Wait for the actual "done" after the hint
          await waitForChat(studentBot, ['done', 'next', 'ready', 'ok']);
        }

        // Handle peer learning responses (student helping classmate)
        for (const cm of classmateInstances) {
          if (cm.awaitingHelp && studentMessage.length > 10) {
            // Student might be explaining to the classmate
            if (studentMessage.toLowerCase().includes('because') ||
                studentMessage.toLowerCase().includes('it works') ||
                studentMessage.toLowerCase().includes('basically') ||
                studentMessage.length > 30) {
              const helpResult = cm.receiveHelp(studentMessage);
              if (helpResult?.accepted) {
                progress.adaptive.recordPeerTeach(lesson.id);
              }
            }
          }
        }

        lesson.advanceStep();
        await teacher.say('celebrate');
      }

      // Quiz with spaced repetition review questions
      let quizPerfect = false;
      if (lesson.quiz?.length) {
        teacherBot.chat('\n📝 Time for a quiz!');

        // Collect review questions from spaced repetition
        const reviewQuestions = [];
        for (const due of dueReviews) {
          // Find quiz questions from earlier lessons
          for (const prevLesson of course.orderedLessons) {
            if (prevLesson.id === due.topic && prevLesson.quiz) {
              // Pick 1 question from each due topic
              const q = prevLesson.quiz[Math.floor(Math.random() * prevLesson.quiz.length)];
              reviewQuestions.push({ ...q, _isReview: true });
              break;
            }
          }
        }

        const quiz = new Quiz(lesson.quiz, teacherBot, {
          reviewQuestions: reviewQuestions.slice(0, 2), // max 2 review questions
          topic: lesson.id,
          progress,
        });

        const quizHandler = (username, message) => quiz.processAnswer(message);
        studentBot.on('chat', quizHandler);

        while (!quiz.isComplete) {
          const result = await quiz.askCurrent();
          if (!result) break;
          await sleep(15000);
          if (quiz.awaitingAnswer) quiz.processAnswer('');
        }

        studentBot.off('chat', quizHandler);
        quiz.showResults();
        quizPerfect = quiz.score === quiz.totalPoints;
        progress.recordQuiz(lesson.id, quiz.score, quiz.totalPoints);
      }

      // Record completion
      const lessonTime = (Date.now() - (lessonStartTimes.get(lesson.id) ?? Date.now())) / 1000;
      progress.completeLesson(lesson.id, null, lessonTime, course.id);

      // Real-world insight for this lesson
      if (curriculum) {
        const connections = curriculum.getRealWorldConnections(course.id);
        if (connections.length > 0) {
          const insight = connections[Math.floor(Math.random() * connections.length)];
          teacher.realWorldInsight(lesson.title, insight);
        }
      }

      // Check achievements
      const completedCount = [...progress.lessons.values()].filter(l => l.completed).length;
      const ctx = {
        completedLessons: completedCount,
        perfectQuiz: quizPerfect,
        perfectQuizCount: progress.perfectQuizCount,
        lastTopic: course.id,
        lastLessonTime: lessonTime,
        streak: completedCount,
        questionsAsked: progress.questionsAsked,
        helpedClassmate: progress.peerLearning.totalHelped > 0,
        topicsHelped: progress.peerLearning.topicsHelped.size,
        highQualityExplanation: false,
        independentDiscovery: false,
        completedWithZeroHints: progress.currentLessonHintsUsed === 0,
        coursesTouched: progress.courseCount,
        courseComplete: course.orderedLessons.every(l => progress.getLesson(l.id)?.completed),
        spacedRepetitionReviews: progress.spacedRepetitionReviews,
      };
      const newlyUnlocked = achievements.check(ctx);
      if (newlyUnlocked.length) achievements.celebrate(teacherBot, newlyUnlocked);

      // Update skill tree
      const updatedTree = SkillTree.fromCourse(course, progress, progress.adaptive, progress.spacedRep);
      teacherBot.chat(updatedTree.toASCII());

      // Suggest next course if curriculum available
      if (curriculum && ctx.courseComplete) {
        const nextCourse = curriculum.getRecommendedNext([...progress.coursesTouched]);
        if (nextCourse) {
          teacherBot.chat(`\n🚀 Course complete! Ready for "${nextCourse.title}"? That's the recommended next course!`);
        }
      }

      await progress.save();
      await teacher.say('transition');
    }

    teacherBot.chat('🎉 Congratulations! You\'ve completed the entire course!');
    teacherBot.chat(`📊 Final stats:`);
    teacherBot.chat(`  • Average quiz score: ${Math.round(progress.averageQuizScore * 100)}%`);
    teacherBot.chat(`  • Achievements earned: ${progress.achievements.length}`);
    teacherBot.chat(`  • Classmates helped: ${progress.peerLearning.totalHelped}`);
    teacherBot.chat(`  • Reviews completed: ${progress.spacedRepetitionReviews}`);
  });

  // Handle student chat for teaching style changes and questions
  studentBot.on('chat', (username, message) => {
    if (message.toLowerCase().startsWith('style:')) {
      // Teaching style change request — handled by main loop context
    }
    // Track questions for curiosity achievement
  });
}

/**
 * Handle a discovery zone — wait for student to solve or give up.
 */
function handleDiscovery(studentBot, teacherBot, zone) {
  return new Promise((resolve) => {
    const handler = (username, message) => {
      const lower = message.toLowerCase().trim();

      if (lower.includes('hint')) {
        const hint = zone.requestHint();
        if (hint) {
          teacherBot.chat(`💡 Hint ${zone.hintsUsed}/${zone.hints.length}: ${hint}`);
        } else {
          teacherBot.chat(`😅 I'm out of hints! The answer: ${zone.solution}`);
          zone.abandon();
          studentBot.off('chat', handler);
          resolve({ solved: false });
        }
        return;
      }

      if (lower.match(/done|solved|got it|next|give up/)) {
        if (lower.includes('give up')) {
          zone.abandon();
          studentBot.off('chat', handler);
          resolve({ solved: false });
        } else {
          zone.solve();
          studentBot.off('chat', handler);
          resolve({ solved: true });
        }
        return;
      }

      // If student is struggling, give a nudge
      if (zone.timeElapsed > 120 && zone.hintsUsed === 0) {
        teacherBot.chat(zone.getNudge());
      }
    };
    studentBot.on('chat', handler);
  });
}

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

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

main().catch(console.error);
