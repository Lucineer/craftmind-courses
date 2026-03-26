/**
 * v1-socrates.js — The Classical Socratic Teacher
 *
 * Never gives direct answers, only questions. Patient but relentless.
 * Hypothesis: Best for deep learning, worst for impatient students.
 */

import { Step } from './script-engine.js';

export default {
  name: 'socratic',
  description: 'The Classical Socratic — never gives answers, only asks questions.',
  hypothesis: 'Best for deep learning, worst for impatient students.',
  version: 1,

  steps: [
    // Open with a provocative question
    Step.ask_question([
      'Let me ask you something. What do you think this concept really means?',
      'Before we dive in — what do YOU think is happening here?',
      'I want you to think about this for a moment. What is the core idea here?',
      'Consider this: why does this work the way it does?',
      'Start with your intuition. What does your gut tell you about this topic?',
    ]),

    // Wait for the student to answer
    Step.wait_for_answer(),

    // Branch based on whether student seems to have an idea
    Step.branch(
      (ctx) => ctx.currentMood !== 'frustrated',
      // Student is trying — follow up with another question
      [
        Step.ask_question([
          'Interesting. And why do you think that is?',
          'That\'s one way to look at it. But consider — what if the opposite were true?',
          'Hmm, I see your reasoning. But can you think of a case where that wouldn\'t work?',
          'Good start. Now push further — what are the implications of that?',
          'So you\'re saying X leads to Y? What evidence supports that?',
          'Fair point. But let me ask — what assumptions are you making?',
        ]),
        Step.wait_for_answer(),
      ],
      // Student is frustrated — gentle redirect
      [
        Step.ask_question([
          'I know this is tough. Let\'s simplify — what\'s the ONE thing you do understand about this?',
          'That\'s okay. Nobody gets it right away. What part feels the most confusing?',
          'Let\'s step back. If you had to explain this to a five-year-old, what would you say?',
          'Frustration means you\'re learning. Let\'s try a smaller question — what\'s the first thing that comes to mind?',
        ]),
        Step.wait_for_answer(),
        Step.give_hint([
          'Think about what happens at the boundary — when one thing changes into another.',
          'Consider the simplest possible example. What would happen there?',
          'Imagine removing all the complexity. What\'s left?',
          'Look at it from the opposite direction. If you worked backward, what would you see?',
        ]),
      ],
    ),

    // Adjust difficulty based on how they're doing
    Step.branch(
      (ctx) => ctx.consecutiveWrong >= 2,
      Step.adjust_difficulty(-1),
      Step.noop(),
    ),

    Step.branch(
      (ctx) => ctx.consecutiveCorrect >= 2,
      Step.adjust_difficulty(1),
      Step.noop(),
    ),

    // Praise (Socratic style — always understated)
    Step.branch(
      (ctx) => ctx.consecutiveCorrect >= 1,
      Step.praise([
        'Now you\'re thinking.',
        'That shows real understanding.',
        'You arrived at the right conclusion through your own reasoning. That\'s the goal.',
        'I didn\'t teach you that — you discovered it yourself.',
      ]),
      Step.noop(),
    ),

    // Encourage if struggling
    Step.branch(
      (ctx) => ctx.currentMood === 'frustrated',
      Step.encourage([
        'The struggle IS the lesson. Keep pushing.',
        'Socrates said "I know that I know nothing." You\'re in good company.',
        'Every wrong answer gets you closer to the right question.',
        'Confusion is the beginning of understanding. Stay with it.',
      ]),
      Step.noop(),
    ),

    // Second question round for deeper exploration
    Step.ask_question([
      'Now, let me push you further. What would happen if we applied this to a different case?',
      'Good. But I want you to think about the edge case. What breaks down?',
      'Follow-up question: how does this connect to what we discussed earlier?',
    ]),

    Step.wait_for_answer(),

    // Final encouragement regardless of outcome
    Step.encourage([
      'The act of questioning is more valuable than the answer itself.',
      'Keep questioning. That\'s the mark of an educated mind.',
      'Remember — wisdom begins in wonder.',
    ]),

    // Advance progress
    Step.action('advance', (student) => {
      student.advanceProgress(0.1);
    }),
  ],
};
