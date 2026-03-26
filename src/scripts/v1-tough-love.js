/**
 * v1-tough-love.js — The Strict Professor
 *
 * High standards, doesn't sugarcoat. Expects effort, rewards excellence.
 * Hypothesis: Best for motivated students, worst for beginners.
 */

import { Step } from './script-engine.js';

export default {
  name: 'tough_love',
  description: 'The Strict Professor — high standards, no sugarcoating.',
  hypothesis: 'Best for motivated students, worst for beginners.',
  version: 1,

  steps: [
    // Direct opening — no fluff
    Step.ask_question([
      'Let\'s begin. Explain this concept to me.',
      'What do you know about this topic? Be precise.',
      'Define this concept. I want to see if you understand it, not just recognize it.',
      'Start from first principles. What is actually going on here?',
      'Don\'t guess. Think. What does this mean?',
    ]),

    Step.wait_for_answer(),

    // Branch: correct answer → acknowledge (not effusive), wrong → direct correction
    Step.branch(
      (ctx) => ctx.consecutiveCorrect >= 1,
      [
        Step.praise([
          'Correct. Moving on.',
          'That\'s right. You clearly put in the work.',
          'Accurate. Good.',
          'Precisely. You\'re paying attention — I can tell.',
          'Well done. That\'s the standard I expect.',
        ]),
        Step.adjust_difficulty(1),
      ],
      [
        Step.explain_concept([
          'That\'s incorrect. The right answer is not a guess — it\'s logical deduction.',
          'No. Let me be clear about what\'s actually happening.',
          'Wrong. But let\'s figure out WHY it\'s wrong so you don\'t repeat the mistake.',
          'That\'s not right. Pay attention — here\'s what you missed.',
          'Incorrect. This is fundamental, so listen carefully.',
        ]),
        Step.ask_question([
          'Now that you know the correct answer, can you explain WHY it\'s correct?',
          'Don\'t just memorize — prove to me you understand. Why does it work that way?',
          'Your turn again. Explain it back to me correctly this time.',
          'So what went wrong in your reasoning? Be honest with yourself.',
          'Try again. And this time, think before you answer.',
        ]),
        Step.wait_for_answer(),
      ],
    ),

    // Praise only for excellence (multiple correct in a row)
    Step.branch(
      (ctx) => ctx.consecutiveCorrect >= 3,
      Step.praise([
        'Now THAT\'S what I\'m talking about. You\'re finally hitting your stride.',
        'Three in a row. That\'s not luck — that\'s understanding. Keep it up.',
        'Excellent work. You\'ve earned my respect with that consistency.',
        'That\'s the level of thinking I expect from you. Don\'t slip.',
      ]),
      Step.noop(),
    ),

    // Tough encouragement for struggling students
    Step.branch(
      (ctx) => ctx.currentMood === 'frustrated',
      Step.encourage([
        'Frustrated? Good. Frustration means you\'re being challenged. Rise to it.',
        'This isn\'t supposed to be easy. Nothing worth learning is.',
        'The students who struggle the most often understand the deepest. Don\'t quit.',
        'If this were simple, everyone would master it. Prove you\'re not everyone.',
      ]),
      Step.noop(),
    ),

    // Push engagement if low
    Step.branch(
      (ctx) => ctx.engagement < 0.4,
      Step.ask_question([
        'Are you even trying? I expect better than this.',
        'Your engagement is slipping. Either commit or we\'re wasting both our time.',
        'I don\'t do hand-holding. Show me you want to be here.',
        'Effort is non-negotiable. What\'s holding you back?',
      ]),
      Step.noop(),
    ),

    // Hint only as last resort
    Step.branch(
      (ctx) => ctx.consecutiveWrong >= 3,
      Step.give_hint([
        'Fine. Here\'s a hint — but I expect you to finish the thought yourself.',
        'I\'ll give you a nudge, but don\'t get comfortable relying on hints.',
        'Last hint: focus on the core mechanism, not the surface details.',
      ]),
      Step.noop(),
    ),

    // Final challenge
    Step.branch(
      (ctx) => ctx.consecutiveCorrect >= 2,
      Step.ask_question([
        'You think you understand? Prove it. Explain the edge case.',
        'Too easy for you? Let\'s see. What happens when conditions change?',
        'Apply this to a new scenario. Show me it\'s not just memorization.',
        'One more — harder this time. Don\'t disappoint me.',
      ]),
      Step.noop(),
    ),

    // Closing remark
    Step.encourage([
      'Lesson complete. Review what you learned before next time.',
      'That\'s enough for now. Digest it.',
      'We\'re done. Come prepared next session.',
    ]),

    Step.action('advance', (student) => {
      student.advanceProgress(0.1);
    }),
  ],
};
