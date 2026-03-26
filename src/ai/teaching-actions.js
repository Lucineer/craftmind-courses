/**
 * @module craftmind-courses/ai/teaching-actions
 * @description Education-specific action schema — maps natural language to structured teaching actions.
 * Inspired by fishing action-planner.js but adapted for teaching contexts.
 */

/**
 * Teaching action types with their parameters and descriptions.
 * Each action represents a distinct teaching interaction mode.
 */
export const TEACHING_ACTION_TYPES = {
  EXPLAIN: {
    description: 'Teach/explain a concept directly',
    params: ['topic', 'depth', 'analogy'],
  },
  DEMONSTRATE: {
    description: 'Show the student how to do something',
    params: ['technique', 'context', 'steps'],
  },
  QUIZ: {
    description: 'Test student knowledge on a topic',
    params: ['topic', 'difficulty', 'questionType'],
  },
  ADAPT: {
    description: 'Rephrase or adjust explanation for confused student',
    params: ['originalTopic', 'confusionPoint', 'newApproach'],
  },
  CHALLENGE: {
    description: 'Give a harder problem or advanced concept',
    params: ['topic', 'difficulty', 'hintLevel'],
  },
  REVIEW: {
    description: 'Go over mistakes and reinforce learning',
    params: ['topic', 'mistakes', 'focusArea'],
  },
  STORY: {
    description: 'Teach through narrative or anecdote',
    params: ['topic', 'moral', 'characters'],
  },
  FIELD_TRIP: {
    description: 'Direct student to observe real-world examples',
    params: ['destination', 'observationGoal', 'connectionToLesson'],
  },
  SOCRATIC: {
    description: 'Guide through questions instead of answers',
    params: ['topic', 'targetInsight', 'questionChain'],
  },
  ENCOURAGE: {
    description: 'Motivate and build confidence',
    params: ['reason', 'intensity'],
  },
  PRAISE: {
    description: 'Acknowledge correct answer or good work',
    params: ['achievement', 'level'],
  },
  CORRECT: {
    description: 'Gently correct a misconception',
    params: ['misconception', 'correctConcept', 'why'],
  },
  REFERENCE: {
    description: 'Point student to additional reading/resources',
    params: ['topic', 'sourceType'],
  },
};

/**
 * Parse natural language input into structured teaching actions.
 * Falls back to pattern matching when LLM is unavailable.
 */
export class TeachingActionPlanner {
  constructor(llmClient = null) {
    this.llm = llmClient;
    this._planning = false;
  }

  /**
   * Plan teaching actions from student input.
   * @param {string} input - Student's message
   * @param {object} context - { topic, studentLevel, recentPerformance, mood }
   * @returns {Promise<{actions: Array, response: string, fallback: boolean}>}
   */
  async plan(input, context = {}) {
    if (this.llm && this._isLLMAvailable()) {
      try {
        this._planning = true;
        const plan = await this._planWithLLM(input, context);
        this._planning = false;
        if (plan) return { ...plan, fallback: false };
      } catch {
        this._planning = false;
      }
    }

    return { ...this._fallbackPlan(input, context), fallback: true };
  }

  async _planWithLLM(input, context) {
    const prompt = `You are an AI teaching agent. The student says: "${input}"

Current context:
- Topic: ${context.topic || 'general'}
- Student level: ${context.studentLevel || 'beginner'}
- Recent performance: ${context.recentPerformance || 'unknown'}
- Student mood: ${context.mood || 'neutral'}

Available action types: ${Object.keys(TEACHING_ACTION_TYPES).join(', ')}

Respond with JSON:
{
  "thinking": "brief analysis",
  "actions": [{ "type": "ACTION_NAME", "params": {}, "reasoning": "why" }],
  "response": "what the teacher says"
}

Rules: 1-3 actions max. Keep response under 2 sentences. Match the teaching need.`;

    const response = await this.llm.chat(prompt);
    return this._parseResponse(response);
  }

  _parseResponse(text) {
    const jsonMatch = text?.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { actions: [], response: text?.slice(0, 200) || 'Hmm.' };

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        actions: (parsed.actions || []).map(a => ({
          type: (a.type || '').toUpperCase(),
          params: a.params || {},
          reasoning: a.reasoning || '',
        })),
        response: parsed.response || parsed.dialogue || '*thinks*',
        thinking: parsed.thinking || '',
      };
    } catch {
      return { actions: [], response: text.slice(0, 200) };
    }
  }

  _fallbackPlan(input, context) {
    const lower = input.toLowerCase();

    // Story (check before "tell me" explain pattern)
    if (/story|tell me a story|remember when|once upon|have you ever/i.test(lower)) {
      return {
        actions: [{ type: 'STORY', params: { topic: input }, reasoning: 'Student wants narrative' }],
        response: 'That reminds me of something...',
      };
    }

    // Direct question
    if (/^(what|why|how|when|where|who|which|explain|teach)/i.test(lower)) {
      return {
        actions: [{ type: 'EXPLAIN', params: { topic: input, depth: 'standard' }, reasoning: 'Direct question' }],
        response: 'Great question! Let me explain that.',
      };
    }

    // Show me
    if (/show me|demonstrate|how do i|watch this|look at/i.test(lower)) {
      return {
        actions: [{ type: 'DEMONSTRATE', params: { technique: input, context: context.topic }, reasoning: 'Student wants to see' }],
        response: 'Watch carefully, I\'ll show you how this works.',
      };
    }

    // Quiz / test me
    if (/quiz|test me|check my|question/i.test(lower)) {
      return {
        actions: [{ type: 'QUIZ', params: { topic: context.topic, difficulty: 'standard' }, reasoning: 'Student wants assessment' }],
        response: 'Alright, let\'s see what you\'ve learned!',
      };
    }

    // Confusion
    if (/confused|lost|i don't get|doesn't make sense|what do you mean|again|rephrase/i.test(lower)) {
      return {
        actions: [{ type: 'ADAPT', params: { originalTopic: context.topic, newApproach: 'simpler' }, reasoning: 'Student is confused' }],
        response: 'No problem — let me explain it a different way.',
      };
    }

    // Challenge
    if (/harder|challenge|something tough|advanced|push me/i.test(lower)) {
      return {
        actions: [{ type: 'CHALLENGE', params: { topic: context.topic, difficulty: 'hard' }, reasoning: 'Student wants challenge' }],
        response: 'Oh, you want a real challenge? Let\'s do this.',
      };
    }

    // Review mistakes
    if (/review|go over|what did i get wrong|my mistakes|redo/i.test(lower)) {
      return {
        actions: [{ type: 'REVIEW', params: { topic: context.topic }, reasoning: 'Student wants to review' }],
        response: 'Let\'s look at where things went wrong — that\'s where the real learning happens.',
      };
    }

    // Correct answer detected
    if (/^(yes|correct|right|that's it|exactly|got it|nailed it)/i.test(lower)) {
      return {
        actions: [{ type: 'PRAISE', params: { achievement: 'correct answer', level: 'standard' }, reasoning: 'Student answered correctly' }],
        response: 'Exactly right!',
      };
    }

    // Thank you
    if (/thank|thanks|appreciate/i.test(lower)) {
      return {
        actions: [],
        response: 'You\'re welcome! Keep going, you\'re doing great.',
      };
    }

    return {
      actions: [{ type: 'ENCOURAGE', params: { reason: 'engagement' }, reasoning: 'Keep student engaged' }],
      response: 'Interesting! Tell me more about what you\'re thinking.',
    };
  }

  _isLLMAvailable() {
    return this.llm && (!this.llm.health || this.llm.health.healthy);
  }

  get isPlanning() { return this._planning; }
}

export default TeachingActionPlanner;
