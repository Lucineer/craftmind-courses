/**
 * NPC Teacher — AI-powered tutor that connects to an LLM and speaks in Minecraft chat.
 * Falls back to scripted responses when no API key is available.
 */
const LLM_URL = 'https://api.z.ai/api/coding/paas/v4/chat/completions';
const LLM_MODEL = 'glm-4.7-flash';

/** Scripted fallback lines keyed by context */
const SCRIPTED = {
  welcome: [
    "Hey there! Welcome to class! I'm so excited to learn with you today! 🎮",
    "Alright, let's dive in! I promise this is going to be fun!",
  ],
  hint: [
    "Hmm, try looking around — the answer might be closer than you think! 🔍",
    "Don't overthink it! Start with what you know and build from there. You got this!",
    "Here's a clue: think about what we just learned. How does it connect?",
  ],
  celebrate: [
    "YES! That was amazing! You're a natural! 🎉",
    "Incredible work! I knew you could do it! ⭐",
    "Woohoo! That's exactly right! Time to celebrate! 🎊",
  ],
  encourage: [
    "It's okay to get stuck — that's literally how everyone learns! Keep trying! 💪",
    "Take a breath. You're doing better than you think. What part is confusing?",
    "Mistakes are just proof you're trying! Let's figure this out together. 🤝",
  ],
  transition: [
    "Alright, moving on! Let's see what's next — I think you'll love this part!",
    "Great job on that one! Ready for the next challenge? Here we go!",
  ],
};

export class NPCTeacher {
  /**
   * @param {import('mineflayer').Bot} bot
   * @param {object} [opts]
   * @param {string} [opts.name] — in-game username (default "ProfBlock")
   * @param {string} [opts.subject] — e.g. "Redstone Engineering"
   * @param {import('./teaching-styles.js').TeachingStyleManager} [opts.styleManager]
   */
  constructor(bot, opts = {}) {
    this.bot = bot;
    this.name = opts.name ?? 'ProfBlock';
    this.subject = opts.subject ?? 'Minecraft';
    this.apiKey = process.env.ZAI_API_KEY ?? null;
    this.styleManager = opts.styleManager ?? null;
    /** @type {string[]} */
    this.chatHistory = [];
  }

  /** Send a message to the student via Minecraft chat. */
  chat(message) {
    this.bot.chat(message);
    this.chatHistory.push(`[Teacher]: ${message}`);
    if (this.chatHistory.length > 100) this.chatHistory.shift();
  }

  /**
   * Send a contextual message via LLM or fallback.
   * @param {string} context — "welcome" | "hint" | "celebrate" | "encourage" | "transition" | custom
   * @param {string} [extra] — additional context for the LLM
   */
  async say(context, extra = '') {
    if (this.apiKey) {
      try {
        return await this._llmSay(context, extra);
      } catch {
        // fall through to scripted
      }
    }
    const lines = SCRIPTED[context] ?? SCRIPTED.transition;
    const line = lines[Math.floor(Math.random() * lines.length)];
    this.chat(line);
    return line;
  }

  /** @private */
  async _llmSay(context, extra) {
    const recentHistory = this.chatHistory.slice(-20).join('\n');
    const stylePrompt = this.styleManager?.getPromptAddition() ?? '';
    const systemPrompt = `You are ${this.name}, a fun and encouraging Minecraft teacher specializing in ${this.subject}.
You chat in Minecraft so keep messages short (1-2 sentences max). Use occasional emojis.
You are NOT a lecturing professor — you're like a cool tutor who loves helping students learn.
${stylePrompt}
Context: ${context}${extra ? '\nExtra info: ' + extra : ''}`;

    const resp = await fetch(LLM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...(recentHistory
            ? [{ role: 'user', content: `Recent chat:\n${recentHistory}\n\nGenerate a response for context: ${context}` }]
            : [{ role: 'user', content: `Context: ${context}. Say something!` }]),
        ],
        max_tokens: 120,
        temperature: 0.85,
      }),
    });

    if (!resp.ok) throw new Error(`LLM ${resp.status}`);
    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content?.trim() ?? SCRIPTED.transition[0];
    this.chat(text);
    return text;
  }

  /**
   * React to student chat messages.
   * @param {string} username
   * @param {string} message
   */
  async onStudentChat(username, message) {
    // Simple keyword detection for scripted fallback
    const lower = message.toLowerCase();
    if (lower.match(/help|stuck|don't know|confused/)) {
      await this.say('hint', `Student said: "${message}"`);
    } else if (lower.match(/done|finished|got it|yes/)) {
      await this.say('celebrate');
    }
    // LLM-powered response if available
    if (this.apiKey) {
      await this._llmSay(`Student chat: "${message}"`, '');
    }
  }

  /**
   * Deliver a "real-world insight" moment — connecting Minecraft to real subjects.
   * These are the "aha!" moments that make learning stick.
   * @param {string} concept — the Minecraft concept
   * @param {string} realWorld — the real-world connection
   */
  realWorldInsight(concept, realWorld) {
    this.chat('');
    this.chat('🌐 Real World Insight:');
    this.chat(`Did you know that ${concept} in Minecraft works just like ${realWorld}?`);
    this.chat('Understanding these connections makes you better at BOTH! 🧠');
    this.chat('');
  }

  /**
   * Deliver adaptive feedback based on student performance.
   * @param {{action:string, message:string, reason:string}} adaptation
   */
  adaptiveFeedback(adaptation) {
    if (adaptation.action === 'continue') return; // no message needed
    this.chat(adaptation.message);
  }
}

export default NPCTeacher;
