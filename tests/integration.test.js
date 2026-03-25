import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Course } from '../src/course.js';
import { Lesson } from '../src/lesson.js';
import { Progress } from '../src/progress.js';
import { Quiz } from '../src/quiz.js';
import { AchievementSystem } from '../src/achievements.js';
import { TeachingStyleManager } from '../src/teaching-styles.js';
import { SkillTree } from '../src/skill-tree.js';
import { SpacedRepetition } from '../src/spaced-repetition.js';
import { DiscoveryZone } from '../src/discovery.js';
import { Curriculum } from '../src/curriculum.js';
import { AdaptiveEngine } from '../src/adaptive.js';
import { PeerLearningSystem } from '../src/peer-learning.js';

describe('Course & Lesson', () => {
  it('creates a course with lessons', () => {
    const course = new Course({ id: 'test', title: 'Test Course', lessons: [] });
    assert.ok(course);
    assert.equal(course.title, 'Test Course');
  });

  it('lesson tracks steps and completion', () => {
    const lesson = new Lesson({
      id: 'l1', title: 'Test Lesson', description: 'desc',
      objectives: ['learn x'], steps: [{ type: 'observe', description: 'look' }],
    });
    assert.ok(!lesson.completed);
    lesson.advanceStep();
    assert.ok(lesson.completed, 'should be complete after all steps');
  });
});

describe('Progress Tracking', () => {
  it('tracks lesson completion', () => {
    const progress = new Progress('student1');
    progress.completeLesson('lesson1', 0.9, 300, 'course1');
    const lesson = progress.getLesson('lesson1');
    assert.ok(lesson.completed);
  });

  it('records quiz scores', () => {
    const progress = new Progress('student2');
    progress.recordQuiz('lesson1', 8, 10);
    assert.ok(progress.averageQuizScore > 0);
  });
});

describe('Quiz System', () => {
  it('creates a quiz with questions', () => {
    const quiz = new Quiz([
      { question: 'What is redstone?', options: ['a', 'b', 'c', 'd'], correct: 0 },
    ]);
    assert.ok(quiz);
    assert.equal(quiz.totalPoints, 1);
  });
});

describe('Teaching Styles', () => {
  it('loads all teaching styles', () => {
    const mgr = new TeachingStyleManager();
    mgr.setStyle('patient');
    assert.equal(mgr.style.name, 'Patient Guide');
    mgr.setStyle('socratic');
    assert.ok(mgr.style.name, 'should have name');
  });

  it('has multiple teaching styles available', () => {
    const mgr = new TeachingStyleManager();
    mgr.setStyle('patient');
    assert.ok(mgr.style);
    mgr.setStyle('socratic');
    assert.ok(mgr.style);
  });
});

describe('SkillTree', () => {
  it('creates skill tree from course', () => {
    const course = new Course({ id: 'test', title: 'Test', lessons: [
      { id: 'l1', title: 'Lesson 1', objectives: ['obj1'] },
    ]});
    const progress = new Progress('s');
    const tree = SkillTree.fromCourse(course, progress, new AdaptiveEngine(), new SpacedRepetition());
    assert.ok(tree);
  });

  it('renders ASCII representation', () => {
    const course = new Course({ id: 'test', title: 'Test', lessons: [] });
    const tree = SkillTree.fromCourse(course, new Progress('s'), new AdaptiveEngine(), new SpacedRepetition());
    const ascii = tree.toASCII();
    assert.ok(typeof ascii === 'string');
    assert.ok(ascii.length > 0);
  });
});

describe('Spaced Repetition', () => {
  it('reviews topics over time', () => {
    const sr = new SpacedRepetition();
    sr.register('topic1', 'lesson1');
    sr.review('topic1', 0.8);
    const due = sr.getDueTopics();
    assert.ok(Array.isArray(due));
  });
});

describe('DiscoveryZone', () => {
  it('creates discovery zone with hints', () => {
    const zone = new DiscoveryZone({
      id: 'dz1', title: 'Find the switch', description: 'Look around',
      hints: [{ text: 'Check the wall' }, { text: 'Look behind the painting' }],
      solution: 'hidden lever',
    });
    assert.equal(zone.hints.length, 2);
    const hint1 = zone.requestHint();
    assert.ok(hint1, 'should return hint text');
    assert.equal(zone.hintsUsed, 1);
  });

  it('can be solved', () => {
    const zone = new DiscoveryZone({
      id: 'dz2', title: 'Test', description: 'test',
      hints: ['hint'], solution: 'answer',
    });
    zone.solve();
    assert.ok(zone.getQualityRating() > 0);
  });
});

describe('AchievementSystem', () => {
  it('checks achievements based on context', () => {
    const progress = new Progress('s');
    progress.completeLesson('l1', 1.0, 100, 'c1');
    const ach = new AchievementSystem(progress);
    const unlocked = ach.check({ completedLessons: 1, perfectQuiz: true });
    assert.ok(Array.isArray(unlocked));
  });
});

describe('PeerLearningSystem', () => {
  it('generates and evaluates help requests', () => {
    const pl = new PeerLearningSystem();
    const request = pl.generateHelpRequest('struggling', 'topic1', 'What is redstone?');
    assert.ok(request);
    const result = pl.evaluateExplanation(request.id, 'Redstone is like electricity in Minecraft');
    assert.ok(result !== undefined);
  });
});
