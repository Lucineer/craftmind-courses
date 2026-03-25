/**
 * Peer Learning System
 *
 * AI classmates aren't just NPCs — they can be helped by the student,
 * which reinforces the student's own learning. "To teach is to learn twice."
 *
 * Implementation:
 *   - Classmates periodically get stuck on concepts the student has mastered
 *   - Student can explain the concept to the classmate (via chat)
 *   - Teacher validates the explanation
 *   - Student earns confidence boost and achievement progress
 *
 * The "struggling classmate" asks questions about topics the student
 * already understands, creating genuine teaching opportunities.
 */

export class PeerLearningSystem {
  constructor() {
    /** @type {Map<string, {classmate:string, topic:string, question:string, answered:boolean, quality:number}>[]} */
    this.helpRequests = new Map(); // keyed by topic
    this.totalHelped = 0;
    this.topicsHelped = new Set();
  }

  /**
   * Generate a help request from a classmate for a topic the student knows.
   * @param {string} topic
   * @param {string} classmateName
   * @param {string[]} classmateQuestions — pool of questions the classmate might ask
   * @returns {{question:string, classmate:string}|null}
   */
  generateHelpRequest(topic, classmateName, classmateQuestions) {
    if (!classmateQuestions.length) return null;

    const existing = this.helpRequests.get(topic) ?? [];
    // Don't spam — max 1 pending per topic per classmate
    const pending = existing.filter(r => !r.answered && r.classmate === classmateName);
    if (pending.length > 0) return null;

    const question = classmateQuestions[Math.floor(Math.random() * classmateQuestions.length)];
    const request = {
      classmate: classmateName,
      topic,
      question,
      answered: false,
      quality: 0,
    };
    existing.push(request);
    this.helpRequests.set(topic, existing);
    return { question, classmate: classmateName };
  }

  /**
   * Process a student's explanation to a classmate.
   * @param {string} topic
   * @param {string} explanation — student's chat message
   * @returns {{quality:number, feedback:string, keywords:object}}
   */
  evaluateExplanation(topic, explanation) {
    const request = this._findPendingRequest(topic);
    if (!request) return null;

    const lower = explanation.toLowerCase().trim();
    const words = lower.split(/\s+/);

    // Quality heuristic: longer explanations with topic-relevant keywords score higher
    let quality = 0;

    // Length factor (0-2 points)
    if (words.length >= 5) quality += 0.5;
    if (words.length >= 10) quality += 0.5;
    if (words.length >= 20) quality += 1;

    // Structure indicators (0-1 points)
    if (lower.includes(' because ') || lower.includes(' so ') || lower.includes(' therefore ') || lower.includes(' which means ')) {
      quality += 1;
    }

    // Examples given (0-1 points)
    if (lower.includes(' for example ') || lower.includes(' like ') || lower.includes(' imagine ') || lower.includes(' think of ')) {
      quality += 1;
    }

    // Encouragement (bonus 0.5)
    if (lower.includes(' basically ') || lower.includes(' simply ') || lower.includes(' easy ') || lower.includes(' simple ')) {
      quality += 0.5;
    }

    // Cap at 5
    quality = Math.min(5, quality);

    // Generate feedback
    let feedback;
    if (quality >= 4) {
      feedback = "Wow, that was a great explanation! You really understand this! 🌟";
    } else if (quality >= 3) {
      feedback = "That was a solid explanation! You definitely know your stuff.";
    } else if (quality >= 2) {
      feedback = "Good start! Try to explain WHY it works, not just what it does.";
    } else {
      feedback = "Hmm, try to give a more detailed explanation. Think about what you'd want to hear if you were learning this for the first time.";
    }

    request.answered = true;
    request.quality = quality;

    if (quality >= 3) {
      this.totalHelped++;
      this.topicsHelped.add(topic);
    }

    return { quality, feedback };
  }

  /**
   * Get pending help requests (for a classmate to trigger).
   * @param {string} classmateName
   * @returns {{topic:string, question:string}[]}
   */
  getPendingRequests(classmateName) {
    const all = [];
    for (const [topic, requests] of this.helpRequests) {
      for (const r of requests) {
        if (!r.answered && r.classmate === classmateName) {
          all.push({ topic, question: r.question });
        }
      }
    }
    return all;
  }

  /** Check if student has helped with a topic */
  hasHelpedTopic(topic) {
    return this.topicsHelped.has(topic);
  }

  toJSON() {
    return {
      totalHelped: this.totalHelped,
      topicsHelped: [...this.topicsHelped],
    };
  }

  _findPendingRequest(topic) {
    const requests = this.helpRequests.get(topic);
    if (!requests) return null;
    return requests.find(r => !r.answered) ?? null;
  }
}
