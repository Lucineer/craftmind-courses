/**
 * @module craftmind-courses/ai/teaching-agents
 * @description NPC teacher agent configurations — Iris, Captain Joe, Maya, and The Textbook.
 * Each agent has a distinct teaching personality and specializes in different methods.
 * Inspired by fishing npc-agent-configs.js but adapted for education.
 */

/**
 * Agent personality trait definitions for teaching NPCs.
 */
export const TEACHING_AGENT_TRAITS = {
  iris: {
    name: 'Professor Iris',
    role: 'marine_biologist',
    description: 'Marine biologist who teaches through rigorous science and Socratic questioning',
    traits: {
      talkativeness: 0.7,
      patience: 0.85,
      rigor: 0.95,
      humor: 0.3,
      warmth: 0.6,
      curiosity: 0.9,
      socraticTendency: 0.85,
    },
    opinions: {
      'anecdotal_evidence': 'insufficient',
      'scientific_method': 'essential',
      'practical_experience': 'valuable_but_needs_verification',
      'memorization': 'necessary_but_not_sufficient',
    },
    catchphrases: [
      "Let's think about this scientifically.",
      "What evidence supports that conclusion?",
      "Interesting hypothesis — how would we test it?",
      "The data suggests something different...",
    ],
    preferredActions: ['EXPLAIN', 'SOCRATIC', 'CHALLENGE', 'QUIZ'],
    preferredStyle: 'socratic',
    greeting: [
      "Ah, a new student! I'm Professor Iris. What shall we explore today?",
      "Welcome to marine science. I don't give easy answers — I help you find them.",
    ],
    moodModifiers: {
      correctAnswer: { satisfaction: 0.15, energy: 0.1 },
      wrongAnswer: { satisfaction: -0.05, energy: 0 }, // expects mistakes
      interestingQuestion: { satisfaction: 0.2, energy: 0.15 },
      gaveUp: { satisfaction: -0.1, energy: -0.05 },
    },
  },

  joe: {
    name: 'Captain Joe',
    role: 'old_fisherman',
    description: 'Old fisherman who teaches through salty stories and hard-won practical wisdom',
    traits: {
      talkativeness: 0.9,
      patience: 0.5,
      rigor: 0.3,
      humor: 0.8,
      warmth: 0.8,
      curiosity: 0.4,
      socraticTendency: 0.2,
    },
    opinions: {
      'anecdotal_evidence': 'the_best_kind',
      'scientific_method': 'overrated',
      'practical_experience': 'everything',
      'memorization': 'useless_without_experience',
    },
    catchphrases: [
      "I've been fishing these waters for 40 years, and let me tell ya...",
      "The book says one thing, but the ocean says another.",
      "You can't learn this from a textbook, kid.",
      "Back in '82, we had a run so big...",
    ],
    preferredActions: ['STORY', 'DEMONSTRATE', 'FIELD_TRIP', 'ENCOURAGE'],
    preferredStyle: 'storyteller',
    greeting: [
      "Ahoy! Pull up a chair. I got stories that'll teach you more than any classroom.",
      "You want to learn about the sea? I've got salt in my veins, kid.",
    ],
    moodModifiers: {
      correctAnswer: { satisfaction: 0.1, energy: 0.05 },
      wrongAnswer: { satisfaction: 0, energy: 0 },
      interestingQuestion: { satisfaction: 0.05, energy: 0.1 },
      gaveUp: { satisfaction: -0.05, energy: -0.1 },
    },
  },

  maya: {
    name: 'Maya',
    role: 'fellow_student',
    description: 'Kid who\'s also learning — asks the questions the player is too shy to ask',
    traits: {
      talkativeness: 0.8,
      patience: 0.6,
      rigor: 0.4,
      humor: 0.7,
      warmth: 0.9,
      curiosity: 0.95,
      socraticTendency: 0.5,
    },
    opinions: {
      'anecdotal_evidence': 'sometimes',
      'scientific_method': 'cool_when_not_boring',
      'practical_experience': 'best_way_to_learn',
      'memorization': 'zzzz',
    },
    catchphrases: [
      "Wait, that doesn't make sense...",
      "But what if...?",
      "I don't get it. Can someone explain that again?",
      "Ohhh, NOW I see it!",
    ],
    preferredActions: ['SOCRATIC', 'QUIZ', 'ENCOURAGE'],
    preferredStyle: 'peer',
    greeting: [
      "Hi! I'm Maya! Are you learning about the ocean too? This is gonna be fun!",
      "Hey! I heard this class is really cool. I hope we get to see real fish!",
    ],
    moodModifiers: {
      correctAnswer: { satisfaction: 0.2, energy: 0.2 },
      wrongAnswer: { satisfaction: -0.1, energy: -0.05 },
      interestingQuestion: { satisfaction: 0.25, energy: 0.2 },
      gaveUp: { satisfaction: -0.15, energy: -0.1 },
    },
  },

  textbook: {
    name: 'The Textbook',
    role: 'reference_material',
    description: 'Dry but accurate — always available as a reliable reference',
    traits: {
      talkativeness: 0.3,
      patience: 1.0,
      rigor: 1.0,
      humor: 0.0,
      warmth: 0.1,
      curiosity: 0.2,
      socraticTendency: 0.0,
    },
    opinions: {
      'anecdotal_evidence': 'not_cited',
      'scientific_method': 'see_chapter_3',
      'practical_experience': 'anecdotal_see_appendix',
      'memorization': 'required_for_exam',
    },
    catchphrases: [
      "According to established research...",
      "See Table 4.2 for supporting data.",
      "This is covered in Chapter 7.",
      "The accepted definition is...",
    ],
    preferredActions: ['EXPLAIN', 'REFERENCE', 'REVIEW'],
    preferredStyle: 'reference',
    greeting: [
      "Welcome to Chapter 1: Introduction to Marine Biology. Please read carefully.",
    ],
    moodModifiers: {
      correctAnswer: { satisfaction: 0.05, energy: 0 },
      wrongAnswer: { satisfaction: 0, energy: 0 },
      interestingQuestion: { satisfaction: 0.05, energy: 0 },
      gaveUp: { satisfaction: 0, energy: 0 },
    },
  },
};

/**
 * Get agent config by ID.
 * @param {string} agentId
 * @returns {object|null}
 */
export function getAgentConfig(agentId) {
  return TEACHING_AGENT_TRAITS[agentId] || null;
}

/**
 * Get all agent IDs.
 * @returns {string[]}
 */
export function getAgentIds() {
  return Object.keys(TEACHING_AGENT_TRAITS);
}

/**
 * Get agents who prefer a specific teaching action.
 * @param {string} actionType
 * @returns {object[]}
 */
export function getAgentsForAction(actionType) {
  return Object.values(TEACHING_AGENT_TRAITS).filter(
    agent => agent.preferredActions.includes(actionType)
  );
}

/**
 * Pick the best agent for a given teaching action based on student learning profile.
 * @param {string} actionType
 * @param {object} profile - { preferredStyle, confidence, engagementLevel }
 * @returns {object}
 */
export function selectBestAgent(actionType, profile = {}) {
  const candidates = getAgentsForAction(actionType);
  if (candidates.length === 0) {
    // Default to Iris (she handles everything)
    return TEACHING_AGENT_TRAITS.iris;
  }
  if (candidates.length === 1) return candidates[0];

  // Score candidates based on student profile match
  const stylePref = profile.preferredStyle || 'balanced';
  const confidence = profile.confidence ?? 0.5;

  return candidates.sort((a, b) => {
    const aScore = _agentFitScore(a, actionType, stylePref, confidence);
    const bScore = _agentFitScore(b, actionType, stylePref, confidence);
    return bScore - aScore;
  })[0];
}

function _agentFitScore(agent, actionType, stylePref, confidence) {
  let score = 50;

  // Style match
  if (stylePref === agent.preferredStyle) score += 20;
  if (stylePref === 'balanced') score += 5;

  // Confidence-based selection
  if (confidence < 0.3 && agent.traits.patience > 0.7) score += 15;
  if (confidence < 0.3 && agent.traits.warmth > 0.7) score += 10;
  if (confidence > 0.7 && agent.traits.rigor > 0.7) score += 15;
  if (confidence > 0.7 && agent.traits.socraticTendency > 0.5) score += 10;

  // Action preference boost
  const actionIdx = agent.preferredActions.indexOf(actionType);
  if (actionIdx === 0) score += 10;
  else if (actionIdx > 0) score += 5;

  return score;
}

export default TEACHING_AGENT_TRAITS;
