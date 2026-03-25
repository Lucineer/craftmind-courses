/**
 * Teaching Styles — different teacher personalities for different students.
 *
 * Based on educational research on matching teaching style to learner preference:
 *   - Patient guide: slow-paced, lots of encouragement, extra examples
 *   - Challenger: fast-paced, assumes competence, pushes harder
 *   - Socratic: asks questions instead of giving answers
 *   - Hands-on: focuses on doing, minimal explanation
 *   - Storyteller: connects everything to narratives and analogies
 */

/** @typedef {{id:string, name:string, description:string, traits:string[], promptModifier:string, responseStyle:string}} TeachingStyle */

export const TEACHING_STYLES = {
  patient: {
    id: 'patient',
    name: 'Patient Guide',
    description: 'Slow-paced with lots of encouragement and extra examples. Great for beginners.',
    traits: ['encouraging', 'detailed', 'repetitive', 'gentle'],
    promptModifier: 'You are extremely patient. You explain things slowly, repeat key points, and always offer extra examples. You celebrate small wins enthusiastically. Never rush the student.',
    responseStyle: 'gentle',
    /** How many extra examples to give on wrong answers */
    extraExamplesOnWrong: 2,
    /** Time multiplier for waiting on student responses (1.0 = normal) */
    paceMultiplier: 1.5,
    /** How quickly to offer hints */
    hintEagerness: 0.8, // 0-1, higher = more eager to hint
    /** Emoji density */
    emojiDensity: 'high',
  },
  challenger: {
    id: 'challenger',
    name: 'Challenger',
    description: 'Fast-paced, pushes you harder, assumes you can figure it out. For experienced players.',
    traits: ['concise', 'demanding', 'efficient', 'confident'],
    promptModifier: 'You are direct and efficient. You assume the student is smart and can figure things out. Keep explanations short. If they get something wrong, say so plainly and move on. Add extra challenge when they succeed.',
    responseStyle: 'direct',
    extraExamplesOnWrong: 0,
    paceMultiplier: 0.6,
    hintEagerness: 0.2,
    emojiDensity: 'low',
  },
  socratic: {
    id: 'socratic',
    name: 'Socratic Questioner',
    description: 'Asks questions instead of giving answers. Helps you discover the solution yourself.',
    traits: ['questioning', 'guiding', 'thoughtful', 'inquisitive'],
    promptModifier: 'Instead of giving answers, ask guiding questions that help the student discover the solution themselves. Use "What do you think would happen if...?" and "Why do you suppose...?" frequently. Only give direct answers after 3+ failed attempts.',
    responseStyle: 'questioning',
    extraExamplesOnWrong: 0, // gives questions instead
    paceMultiplier: 1.2,
    hintEagerness: 0.1,
    emojiDensity: 'medium',
  },
  hands_on: {
    id: 'hands_on',
    name: 'Hands-On Mentor',
    description: 'Minimal talking, maximum doing. "Watch me, then you try."',
    traits: ['practical', 'demonstrative', 'brief', 'action-oriented'],
    promptModifier: 'Keep explanations very brief (1 sentence max). Focus on action: "Try doing X" or "Build this, then tell me what happens." Let the student learn by doing, not by listening.',
    responseStyle: 'brief',
    extraExamplesOnWrong: 1,
    paceMultiplier: 0.8,
    hintEagerness: 0.4,
    emojiDensity: 'low',
  },
  storyteller: {
    id: 'storyteller',
    name: 'Storyteller',
    description: 'Connects concepts to narratives, analogies, and real-world examples. Makes learning memorable.',
    traits: ['narrative', 'analogical', 'engaging', 'imaginative'],
    promptModifier: 'Wrap every explanation in a story, analogy, or real-world connection. "Redstone is like electricity in your house..." "Think of a repeater like a relay runner..." Make concepts memorable through vivid comparisons.',
    responseStyle: 'narrative',
    extraExamplesOnWrong: 1,
    paceMultiplier: 1.0,
    hintEagerness: 0.5,
    emojiDensity: 'medium',
  },
};

export class TeachingStyleManager {
  constructor() {
    this.currentStyle = 'patient'; // default
  }

  setStyle(styleId) {
    if (!TEACHING_STYLES[styleId]) throw new Error(`Unknown teaching style: ${styleId}`);
    this.currentStyle = styleId;
  }

  get style() {
    return TEACHING_STYLES[this.currentStyle];
  }

  /** Get a style-appropriate system prompt addition */
  getPromptAddition() {
    return this.style.promptModifier;
  }

  /** Get emoji-appropriate message decoration */
  decorateMessage(message) {
    const density = this.style.emojiDensity;
    if (density === 'low') return message;
    if (density === 'high') return message + ' 🌟';
    return message;
  }

  /** How many extra examples to show based on style */
  getExtraExampleCount() {
    return this.style.extraExamplesOnWrong;
  }

  /** Get style description for student selection */
  static getStyleList() {
    return Object.values(TEACHING_STYLES).map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
    }));
  }

  /** Create ASCII selection menu */
  static getSelectionMenu() {
    const lines = ['\n🎨 Choose your teaching style:', ''];
    const styles = Object.values(TEACHING_STYLES);
    styles.forEach((s, i) => {
      lines.push(`  ${i + 1}) ${s.name} — ${s.description}`);
    });
    lines.push('', 'Type the number or name of your preferred style!');
    return lines.join('\n');
  }
}
