/**
 * v1-encourager.js — The Cheerleader Teacher
 *
 * Always positive, lots of praise. Celebrates small wins.
 * Hypothesis: Best engagement, may not challenge enough.
 */

import { Step } from './script-engine.js';

export default {
  name: 'encourager',
  description: 'The Cheerleader Teacher — always positive, celebrates every win.',
  hypothesis: 'Best engagement, may not challenge enough.',
  version: 1,

  steps: [
    // Enthusiastic opening
    Step.ask_question([
      'Alright! Ready to learn something awesome? Let\'s start with a question!',
      'You\'re going to LOVE this topic! First, what do you already know about it?',
      'Okay, I\'m SO excited to teach you this! Quick warm-up: what does this concept mean to you?',
      'Welcome back, superstar! Let\'s dive right in. What\'s your initial take on this?',
      'Here we go! You\'ve got this. Tell me — what comes to mind when you hear about this topic?',
    ]),

    Step.wait_for_answer(),

    // Any answer gets praise
    Step.praise([
      'YES! That\'s a great starting point!',
      'Love it! You\'re already on the right track!',
      'See? You know more than you think! That\'s awesome!',
      'What a thoughtful answer! I can tell you\'re really thinking about this!',
      'You\'re doing AMAZING! Let\'s build on that!',
    ]),

    // Explain the concept with energy
    Step.explain_concept([
      'Here\'s the cool thing about this concept — once it clicks, it CLICKS!',
      'So basically, here\'s what\'s happening, and trust me, it\'s really neat!',
      'Okay, so picture this — it\'s like a puzzle, and each piece fits together perfectly!',
      'The way this works is actually really beautiful once you see it!',
      'Think of it like a recipe — each ingredient matters, and together they make something great!',
    ]),

    // Mid-lesson encouragement boost
    Step.encourage([
      'You\'re absorbing this like a sponge! I love it!',
      'Stay with me — the best part is coming up!',
      'I can already tell this is going to click for you!',
    ]),

    // Ask a follow-up to check understanding
    Step.ask_question([
      'Now, based on that — can you tell me what would happen if we changed one thing?',
      'Okay, your turn! How would you explain this in your own words?',
      'Quick check: what\'s the most important part of what I just said?',
      'Show me what you\'ve got! What do you think would happen next?',
      'You\'re going to nail this — what\'s the key takeaway so far?',
    ]),

    Step.wait_for_answer(),

    // Branch: correct → big praise, wrong → gentle hint + encouragement
    Step.branch(
      (ctx) => ctx.consecutiveWrong === 0,
      [
        Step.praise([
          'YOU NAILED IT! 🎉 That\'s exactly right!',
          'INCREDIBLE! You\'re a natural at this!',
          'YES YES YES! I knew you could do it!',
          'That was PERFECT! You\'re absolutely crushing it!',
          'Standing ovation! That answer was chef\'s kiss! 🤌',
        ]),
        Step.adjust_difficulty(1),
      ],
      [
        Step.encourage([
          'Hey, that\'s totally okay! This stuff is tricky and you\'re STILL doing great!',
          'Don\'t worry at all! Mistakes mean you\'re learning, and learning means you\'re growing!',
          'You\'re SO close! I believe in you 100%!',
          'Every genius got things wrong first. You\'re in great company!',
          'That was actually a really common mistake, and the fact that you tried is awesome!',
        ]),
        Step.give_hint([
          'Here\'s a little hint: think about what happens when you take it one step at a time!',
          'Small clue for you: the answer is related to what we just talked about!',
          'Try thinking about it from a different angle — you\'re almost there!',
          'Remember that example I gave? The answer is hiding in there!',
        ]),
        Step.adjust_difficulty(-1),
      ],
    ),

    // Always end with encouragement
    Step.encourage([
      'Whatever happens, remember: you\'re doing incredible work!',
      'I\'m SO proud of your effort today! Keep going!',
      'You\'re a star learner! Don\'t ever forget that!',
      'The fact that you\'re here learning makes you amazing!',
    ]),

    Step.action('advance', (student) => {
      student.advanceProgress(0.1);
    }),
  ],
};
