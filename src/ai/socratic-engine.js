/**
 * @module craftmind-courses/ai/socratic-engine
 * @description Implements Socratic method for teaching — guides students through questions
 * instead of giving direct answers. Multiple agents can collaborate (Iris leads, Joe adds
 * practical context, Maya asks peer questions).
 */

/**
 * A single question in a Socratic question chain.
 * @typedef {object} SocraticQuestion
 * @property {string} id
 * @property {string} question - The question to ask
 * @property {string[]} acceptableAnswers - Partial matches that indicate correct understanding
 * @property {string[]} hints - Progressive hints if student is stuck
 * @property {string} insight - The key insight this question targets
 * @property {number} maxAttempts - How many tries before moving on
 * @property {string} agent - Which NPC agent asks this question
 */

/**
 * A complete Socratic dialogue chain for a topic.
 * @typedef {object} SocraticChain
 * @property {string} topic
 * @property {string} targetInsight - The big-picture understanding goal
 * @property {SocraticQuestion[]} questions
 * @property {string} conclusion - Final summary after completing the chain
 */

/**
 * Built-in Socratic chains for common marine science topics.
 */
const BUILTIN_CHAINS = {
  'dawn_fishing': {
    topic: 'why_fish_bite_at_dawn',
    targetInsight: 'Fish feeding patterns are driven by light, temperature, and baitfish behavior — all of which change at dawn',
    questions: [
      {
        id: 'q1_light',
        question: 'What changes about light when the sun comes up over the ocean?',
        acceptableAnswers: ['light', 'brighter', 'sunrise', 'sun comes up', 'daylight', 'morning light'],
        hints: [
          'Think about what the sky looks like at dawn vs. the middle of the night.',
          'The sun rises — what does that do to how well you can see underwater?',
        ],
        insight: 'Dawn brings low-angle light that penetrates water and triggers predator-prey dynamics.',
        maxAttempts: 3,
        agent: 'iris',
      },
      {
        id: 'q2_temperature',
        question: 'What happens to water temperature when the sun rises?',
        acceptableAnswers: ['warms up', 'gets warmer', 'increases', 'warmer', 'heat', 'temperature rises'],
        hints: [
          'The sun heats things up, right? What does it heat?',
          'Surface water absorbs sunlight first. What does warmer water do to fish metabolism?',
        ],
        insight: 'Warming surface water activates fish metabolism and increases feeding activity.',
        maxAttempts: 3,
        agent: 'iris',
      },
      {
        id: 'q3_baitfish',
        question: 'So the light is changing and water is warming... what do you think the small baitfish do?',
        acceptableAnswers: ['come up', 'rise', 'move to surface', 'school', 'feed', 'come closer to top'],
        hints: [
          'Small fish eat plankton. Plankton needs light for photosynthesis. Where is there more light?',
          'The baitfish follow their food. And where the baitfish go...',
        ],
        insight: 'Baitfish rise to feed on plankton near the surface, attracting larger predatory fish.',
        maxAttempts: 3,
        agent: 'joe',
      },
      {
        id: 'q4_connection',
        question: 'So — light, temperature, baitfish movement... how does all of that explain why fish bite at dawn?',
        acceptableAnswers: ['predators follow bait', 'big fish eat small fish', 'feeding chain', 'food chain', 'everything comes together', 'predatory fish follow the baitfish'],
        hints: [
          'Think about the chain: light → plankton → baitfish → ...?',
          'Where the baitfish go, the big fish follow. What are the big fish doing to the baitfish?',
        ],
        insight: 'Dawn triggers a feeding cascade: light activates plankton, which draws baitfish up, which draws predatory game fish to feed aggressively.',
        maxAttempts: 4,
        agent: 'iris',
      },
    ],
    conclusion: 'Exactly! Dawn sets off a chain reaction — light, warmth, and baitfish all come together to create prime feeding time. That\'s why experienced fishermen are always on the water at first light.',
  },

  'tides_currents': {
    topic: 'how_tides_affect_fishing',
    targetInsight: 'Tides create currents that move food and concentrate fish around structure',
    questions: [
      {
        id: 't1_cause',
        question: 'What causes the tides to go in and out?',
        acceptableAnswers: ['moon', 'gravity', 'lunar', 'moon gravity', 'moon pulls'],
        hints: [
          'It\'s not the sun doing this...',
          'Think about what pulls on the ocean from space.',
        ],
        insight: 'The moon\'s gravity pulls ocean water, creating bulges that become high and low tides.',
        maxAttempts: 3,
        agent: 'iris',
      },
      {
        id: 't2_currents',
        question: 'When the tide goes in or out, what does all that moving water create?',
        acceptableAnswers: ['current', 'currents', 'water flow', 'flow', 'movement'],
        hints: [
          'Millions of gallons of water moving in one direction...',
          'Moving water creates something that can carry things along with it.',
        ],
        insight: 'Tidal movement creates underwater currents — rivers of flowing water along the ocean floor.',
        maxAttempts: 3,
        agent: 'joe',
      },
      {
        id: 't3_food',
        question: 'If you were a small fish looking for food, and there\'s a strong current flowing past a rocky point, what would you do?',
        acceptableAnswers: ['wait behind rock', 'hide behind structure', 'stay near rocks', 'let food come to me', 'ambush'],
        hints: [
          'The current carries food — plankton, small shrimp, tiny fish. Where would you wait so food comes TO you?',
          'Fish are lazy. They like to let the current do the work.',
        ],
        insight: 'Fish position themselves behind structure (rocks, kelp, pinnacles) where currents carry food directly to them.',
        maxAttempts: 3,
        agent: 'joe',
      },
    ],
    conclusion: 'Tides are the ocean\'s conveyor belt. Moving water concentrates food around structure, and fish know exactly where to wait. Fish the tide changes — that\'s when the current is strongest and the fish are most active.',
  },
};

export class SocraticEngine {
  constructor() {
    this.chains = new Map();
    this.activeChain = null;
    this.currentQuestionIdx = 0;
    this.attempts = 0;
    this.completionHistory = [];
  }

  /**
   * Register a Socratic chain for a topic.
   * @param {string} topicId
   * @param {SocraticChain} chain
   */
  registerChain(topicId, chain) {
    this.chains.set(topicId, chain);
  }

  /**
   * Get available topics.
   * @returns {string[]}
   */
  getTopics() {
    return [...this.chains.keys()];
  }

  /**
   * Start a Socratic dialogue on a topic.
   * @param {string} topicId
   * @returns {{ question: string, agent: string, chainLength: number, progress: number }}
   */
  startChain(topicId) {
    const chain = this.chains.get(topicId) || BUILTIN_CHAINS[topicId];
    if (!chain) throw new Error(`No Socratic chain for topic: ${topicId}`);

    this.activeChain = chain;
    this.currentQuestionIdx = 0;
    this.attempts = 0;

    const q = chain.questions[0];
    return {
      question: q.question,
      agent: q.agent,
      chainLength: chain.questions.length,
      progress: 0,
    };
  }

  /**
   * Process a student's answer to the current question.
   * @param {string} studentAnswer
   * @returns {{ correct: boolean, feedback: string, nextQuestion?: object, chainComplete: boolean, conclusion?: string, insight?: string, agentInterjections: string[] }}
   */
  processAnswer(studentAnswer) {
    if (!this.activeChain) throw new Error('No active Socratic chain');

    const q = this.activeChain.questions[this.currentQuestionIdx];
    const lower = studentAnswer.toLowerCase().trim();

    // Check for acceptable answers (partial match)
    const words = lower.split(/\s+/);
    const isCorrect = q.acceptableAnswers.some(
      acceptable => lower.includes(acceptable) || words.some(w => w.length > 2 && acceptable.includes(w))
    );

    if (isCorrect) {
      this.attempts = 0;
      const interjections = this._getAgentInterjections(q, true);

      // Move to next question or conclude
      this.currentQuestionIdx++;
      if (this.currentQuestionIdx >= this.activeChain.questions.length) {
        this.completionHistory.push({
          topic: this.activeChain.topic,
          completedAt: new Date().toISOString(),
          questionsAnswered: this.activeChain.questions.length,
        });
        const savedChain = this.activeChain;
        this.activeChain = null;
        return {
          correct: true,
          feedback: this._getCorrectFeedback(q, interjections),
          chainComplete: true,
          conclusion: savedChain.conclusion,
          insight: q.insight,
          agentInterjections: interjections,
        };
      }

      const nextQ = this.activeChain.questions[this.currentQuestionIdx];
      return {
        correct: true,
        feedback: this._getCorrectFeedback(q, interjections),
        nextQuestion: {
          question: nextQ.question,
          agent: nextQ.agent,
          chainLength: this.activeChain.questions.length,
          progress: this.currentQuestionIdx / this.activeChain.questions.length,
        },
        chainComplete: false,
        insight: q.insight,
        agentInterjections: interjections,
      };
    }

    // Wrong answer
    this.attempts++;
    const hintIdx = Math.min(this.attempts - 1, q.hints.length - 1);
    const interjections = this._getAgentInterjections(q, false);

    // Max attempts reached — give the answer and move on
    if (this.attempts >= q.maxAttempts) {
      this.attempts = 0;
      this.currentQuestionIdx++;

      if (this.currentQuestionIdx >= this.activeChain.questions.length) {
        this.completionHistory.push({
          topic: this.activeChain.topic,
          completedAt: new Date().toISOString(),
          questionsAnswered: this.activeChain.questions.length,
        });
        const savedChain = this.activeChain;
        this.activeChain = null;
        return {
          correct: false,
          feedback: `The answer is: ${q.insight}`,
          chainComplete: true,
          conclusion: savedChain.conclusion,
          insight: q.insight,
          agentInterjections: interjections,
        };
      }

      const nextQ = this.activeChain.questions[this.currentQuestionIdx];
      return {
        correct: false,
        feedback: `Not quite. ${q.insight} Let's keep going — `,
        nextQuestion: {
          question: nextQ.question,
          agent: nextQ.agent,
          chainLength: this.activeChain.questions.length,
          progress: this.currentQuestionIdx / this.activeChain.questions.length,
        },
        chainComplete: false,
        insight: q.insight,
        agentInterjections: interjections,
      };
    }

    // Give a hint
    const hint = q.hints[hintIdx] || 'Think about it differently...';
    return {
      correct: false,
      feedback: hint,
      chainComplete: false,
      agentInterjections: interjections,
    };
  }

  /**
   * Get other agents' reactions to the student's answer.
   * Joe adds practical context, Maya asks peer questions.
   */
  _getAgentInterjections(question, isCorrect) {
    const interjections = [];

    // Joe adds practical color when he's not the main questioner
    if (question.agent !== 'joe' && Math.random() > 0.4) {
      if (isCorrect) {
        interjections.push({
          agent: 'joe',
          message: "That's right. You can see it on the water too — the birds diving, the bait jumping...",
        });
      } else if (this.attempts >= 2) {
        interjections.push({
          agent: 'joe',
          message: "Think practical, kid. What do you SEE happening on the water at dawn?",
        });
      }
    }

    // Maya chimes in with peer questions
    if (question.agent !== 'maya' && Math.random() > 0.6) {
      if (isCorrect) {
        interjections.push({
          agent: 'maya',
          message: "Ohhh, I think I get it now too! So it's all connected?",
        });
      } else {
        interjections.push({
          agent: 'maya',
          message: "Wait, I'm confused too. Can you explain it even simpler?",
        });
      }
    }

    return interjections;
  }

  _getCorrectFeedback(question, interjections) {
    const agentFeedback = {
      iris: "Excellent reasoning! Your scientific thinking is improving.",
      joe: "Now you're thinking like a fisherman! That's exactly right.",
      maya: "YES! I was wondering the same thing! That makes so much sense!",
      textbook: "Correct. See Chapter 4 for additional supporting data.",
    };
    return agentFeedback[question.agent] || "Exactly right!";
  }

  /**
   * Get completion history.
   */
  getHistory() {
    return this.completionHistory;
  }

  /**
   * Check if a chain is currently active.
   */
  get isActive() {
    return this.activeChain !== null;
  }

  /**
   * Get current chain progress.
   */
  get progress() {
    if (!this.activeChain) return null;
    return {
      topic: this.activeChain.topic,
      current: this.currentQuestionIdx,
      total: this.activeChain.questions.length,
      percent: this.currentQuestionIdx / this.activeChain.questions.length,
    };
  }
}

// Pre-load built-in chains
const defaultEngine = new SocraticEngine();
for (const [id, chain] of Object.entries(BUILTIN_CHAINS)) {
  defaultEngine.registerChain(id, chain);
}

export { BUILTIN_CHAINS };
export default defaultEngine;
