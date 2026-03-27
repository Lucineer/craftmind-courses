/**
 * Multiplayer Quiz Mode — Competitive and cooperative quiz system for classrooms.
 * Teacher asks questions, students race to answer, points awarded for speed and accuracy.
 */

import { StudentTracker } from './student-tracker.js';

/**
 * @typedef {object} QuizQuestion
 * @property {string} id
 * @property {string} question
 * @property {"multiple_choice"|"true_false"|"open"} type
 * @property {string[]} [options] — For multiple choice (A, B, C, D)
 * @property {string|boolean|number} correctAnswer
 * @property {string} explanation
 * @property {number} [points] — Default 10
 * @property {string} [topic] — For tracking
 * @property {number} [timeLimit] — Seconds to answer (default: 30)
 */

/**
 * @typedef {object} QuizConfig
 * @property {"competitive"|"cooperative"} mode — Game mode
 * @property {number} questionTimeLimit — Default time limit per question (seconds)
 * @property {number} firstAnswerBonus — Bonus points for first correct answer
 * @property {number} speedBonusMultiplier — Multiplier for speed bonus
 * @property {boolean} allowReanswers — Allow students to change answers
 * @property {number} passingScore — Required score to pass (0-100)
 */

/**
 * Multiplayer Quiz System
 */
export class MultiplayerQuiz {
  /**
   * @param {import('mineflayer').Bot} teacherBot
   * @param {StudentTracker} tracker
   * @param {QuizConfig} [config]
   */
  constructor(teacherBot, tracker, config = {}) {
    this.teacher = teacherBot;
    this.tracker = tracker;

    this.config = {
      mode: 'competitive',
      questionTimeLimit: 30,
      firstAnswerBonus: 5,
      speedBonusMultiplier: 0.5,
      allowReanswers: false,
      passingScore: 70,
      ...config,
    };

    /** @type {QuizQuestion|null} */
    this.currentQuestion = null;
    this.questionActive = false;
    this.questionStartTime = null;
    this.timeLimit = null;

    /** @type {Map<string, string>} — student -> answer */
    this.answersReceived = new Map();
    /** @type {Map<string, number>} — student -> answer timestamp (ms) */
    this.answerTimes = new Map();

    /** @type {Map<string, number>} — student -> total score */
    this.scores = new Map();

    this.questionNumber = 0;
    this.timer = null;
  }

  /**
   * Ask a question to all students
   * @param {QuizQuestion} question
   * @param {number} [timeLimit] — Override default time limit
   * @returns {Promise<void>}
   */
  async ask(question, timeLimit = null) {
    if (this.questionActive) {
      throw new Error('A question is already active. Call reveal() first.');
    }

    this.currentQuestion = question;
    this.questionActive = true;
    this.questionStartTime = Date.now();
    this.timeLimit = timeLimit ?? this.config.questionTimeLimit;
    this.answersReceived.clear();
    this.answerTimes.clear();
    this.questionNumber++;

    // Build question text
    let qText = `\n📝 Question ${this.questionNumber}: ${question.question}\n`;

    if (question.type === 'multiple_choice' && question.options) {
      question.options.forEach((opt, i) => {
        qText += `  ${String.fromCharCode(65 + i)}) ${opt}\n`;
      });
      qText += '\nType your answer as !A, !B, !C, or !D';
    } else if (question.type === 'true_false') {
      qText += '  A) True\n  B) False\n';
      qText += '\nType your answer as !A or !B';
    } else {
      qText += '\nType your answer in chat with !answer <your answer>';
    }

    qText += `\n⏱️ ${this.timeLimit} seconds to answer!`;

    this.teacher.chat(qText);
    this.teacher.chat('');

    // Start timer
    this.timer = setTimeout(() => {
      if (this.questionActive) {
        this.teacher.chat('⏰ Time\'s up!');
        this.reveal();
      }
    }, this.timeLimit * 1000);
  }

  /**
   * Handle an answer from a student
   * @param {string} studentName
   * @param {string} message — Chat message
   * @returns {boolean} true if answer was processed
   */
  handleAnswer(studentName, message) {
    if (!this.questionActive || !this.currentQuestion) {
      return false;
    }

    const trimmed = message.trim();

    // Parse answer based on format
    let answer;
    if (trimmed.startsWith('!')) {
      const parts = trimmed.substring(1).toUpperCase().split(/\s+/);
      answer = parts[0];

      // For open-ended, get the full answer
      if (this.currentQuestion.type === 'open' && parts.length > 1) {
        answer = parts.slice(1).join(' ');
      }
    } else {
      return false; // Not an answer
    }

    // Check if student already answered
    if (this.answersReceived.has(studentName) && !this.config.allowReanswers) {
      this.teacher.whisper(studentName, 'You already answered! Wait for the reveal.');
      return true;
    }

    // Record answer
    this.answersReceived.set(studentName, answer);
    this.answerTimes.set(studentName, Date.now() - this.questionStartTime);

    // Check if all active students have answered
    const activeStudents = this.tracker.getActiveStudents();
    const allAnswered = activeStudents.every(s =>
      this.answersReceived.has(s.name) || !s.isActive
    );

    if (allAnswered && this.answersReceived.size > 0) {
      // All students answered, reveal early
      clearTimeout(this.timer);
      this.reveal();
    }

    return true;
  }

  /**
   * Reveal the correct answer and award points
   * @returns {object} Results summary
   */
  reveal() {
    if (!this.questionActive || !this.currentQuestion) {
      return null;
    }

    this.questionActive = false;
    clearTimeout(this.timer);

    const question = this.currentQuestion;
    const correctAnswer = this.formatAnswer(question.correctAnswer);

    // Reveal correct answer
    this.teacher.chat('');
    this.teacher.chat(`✅ Correct answer: ${correctAnswer}`);
    this.teacher.chat(`💡 ${question.explanation}`);
    this.teacher.chat('');

    // Calculate and award points
    const results = this.calculateResults();

    // Display results based on mode
    if (this.config.mode === 'competitive') {
      this.showCompetitiveResults(results);
    } else {
      this.showCooperativeResults(results);
    }

    // Record in tracker
    this.recordResults(results);

    // Reset for next question
    this.currentQuestion = null;
    this.answersReceived.clear();
    this.answerTimes.clear();

    return results;
  }

  /**
   * Calculate scores and determine winners
   * @returns {object}
   */
  calculateResults() {
    const q = this.currentQuestion;
    const results = {
      question: q.id,
      correctAnswer: q.correctAnswer,
      answers: [],
      firstCorrect: null,
      fastestCorrect: null,
      totalPoints: q.points ?? 10,
    };

    const basePoints = q.points ?? 10;
    const firstCorrectTime = Math.min(...Array.from(this.answerTimes.values()));

    for (const [student, answer] of this.answersReceived) {
      const isCorrect = this.checkAnswer(answer, q);
      const timeTaken = this.answerTimes.get(student) || 0;
      let points = 0;

      if (isCorrect) {
        // Base points
        points = basePoints;

        // First correct answer bonus
        if (!results.firstCorrect) {
          results.firstCorrect = student;
          points += this.config.firstAnswerBonus;
        }

        // Speed bonus (faster = more points)
        const speedRatio = 1 - (timeTaken / (this.timeLimit * 1000));
        const speedBonus = Math.round(basePoints * this.config.speedBonusMultiplier * speedRatio);
        points += speedBonus;

        // Track fastest
        if (timeTaken === firstCorrectTime) {
          results.fastestCorrect = student;
        }
      }

      results.answers.push({
        student,
        answer,
        isCorrect,
        timeTaken,
        points,
      });

      // Update total score
      const currentScore = this.scores.get(student) || 0;
      this.scores.set(student, currentScore + points);
    }

    return results;
  }

  /**
   * Show competitive mode results (leaderboard style)
   * @param {object} results
   */
  showCompetitiveResults(results) {
    const sorted = [...results.answers].sort((a, b) => b.points - a.points);
    const correct = sorted.filter(a => a.isCorrect);

    this.teacher.chat('🏆 Results:');

    if (correct.length > 0) {
      // Top performers
      sorted.slice(0, 3).forEach((result, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
        const trophy = result.isCorrect ? '✓' : '✗';
        this.teacher.chat(`${medal} ${result.student}: ${result.points}pts ${trophy} (${result.timeTaken / 1000}s)`);
      });

      // Special mentions
      if (results.firstCorrect) {
        const firstTime = this.answerTimes.get(results.firstCorrect) / 1000;
        this.teacher.chat(`⚡ First correct: ${results.firstCorrect} (${firstTime}s)`);
      }
    } else {
      this.teacher.chat('😅 Nobody got it right this time!');
    }

    // Show current leaderboard
    this.showLeaderboard();
  }

  /**
   * Show cooperative mode results (class average focus)
   * @param {object} results
   */
  showCooperativeResults(results) {
    const correct = results.answers.filter(a => a.isCorrect);
    const total = results.answers.length;
    const percentage = total > 0 ? Math.round((correct.length / total) * 100) : 0;

    this.teacher.chat(`🤝 Class Result: ${correct.length}/${total} correct (${percentage}%)`);

    if (percentage >= 80) {
      this.teacher.chat('🌟 Excellent teamwork!');
    } else if (percentage >= 60) {
      this.teacher.chat('👍 Good effort, team!');
    } else {
      this.teacher.chat('💪 Let\'s work together on this topic!');
    }

    // Show who got it right (for peer teaching)
    if (correct.length > 0) {
      const names = correct.map(c => c.student).join(', ');
      this.teacher.chat(`✓ Correct: ${names}`);
    }

    // Class score goal tracking
    const classScore = this.getClassScore();
    this.teacher.chat(`📊 Class Score: ${classScore.toFixed(0)}${this.getTargetProgress(classScore)}`);
  }

  /**
   * Record results in student tracker
   * @param {object} results
   */
  recordResults(results) {
    const q = this.currentQuestion;

    for (const answer of results.answers) {
      this.tracker.recordAnswer(answer.student, {
        questionId: q.id,
        question: q.question,
        givenAnswer: answer.answer,
        correctAnswer: q.correctAnswer,
        isCorrect: answer.isCorrect,
        points: answer.points,
        timeTaken: answer.timeTaken,
        topic: q.topic,
      });
    }
  }

  /**
   * Check if an answer is correct
   * @param {string} givenAnswer
   * @param {QuizQuestion} question
   * @returns {boolean}
   */
  checkAnswer(givenAnswer, question) {
    const given = givenAnswer.toUpperCase().trim();
    const correct = String(question.correctAnswer).toUpperCase().trim();

    if (question.type === 'multiple_choice' || question.type === 'true_false') {
      // Letter answer
      const givenIdx = given.charCodeAt(0) - 65; // A=0, B=1, etc.
      if (givenIdx >= 0 && givenIdx <= 25) {
        if (question.type === 'true_false') {
          return (givenIdx === 0 && correct === 'TRUE') ||
                 (givenIdx === 1 && correct === 'FALSE');
        }
        // Check against options
        if (question.options) {
          const optionText = question.options[givenIdx]?.toUpperCase() || '';
          return optionText.includes(correct) || correct.includes(optionText);
        }
      }
    }

    // Text match for open-ended
    return given.includes(correct) || correct.includes(given);
  }

  /**
   * Format answer for display
   * @param {string|boolean|number} answer
   * @returns {string}
   */
  formatAnswer(answer) {
    if (typeof answer === 'boolean') return answer ? 'True' : 'False';
    return String(answer);
  }

  /**
   * Show current leaderboard
   * @param {number} [limit] — Max entries to show
   */
  showLeaderboard(limit = 5) {
    const sorted = Array.from(this.scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    if (sorted.length === 0) return;

    this.teacher.chat('');
    this.teacher.chat('🏆 Leaderboard:');

    sorted.forEach(([name, score], i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
      this.teacher.chat(`${medal} ${name}: ${score}pts`);
    });

    this.teacher.chat('');
  }

  /**
   * Get class score for cooperative mode
   * @returns {number} Average score
   */
  getClassScore() {
    const scores = Array.from(this.scores.values());
    if (scores.length === 0) return 0;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  /**
   * Get progress towards target score (cooperative mode)
   * @param {number} currentScore
   * @returns {string} Progress bar
   */
  getTargetProgress(currentScore) {
    const target = this.config.passingScore;
    const percentage = Math.min(100, (currentScore / target) * 100);
    const filled = Math.floor(percentage / 10);
    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
    return ` [${bar}] ${percentage.toFixed(0)}%`;
  }

  /**
   * Get all student scores
   * @returns {Map<string, number>}
   */
  getScores() {
    return new Map(this.scores);
  }

  /**
   * Get detailed results for analysis
   * @returns {object}
   */
  getResults() {
    return {
      questionNumber: this.questionNumber,
      mode: this.config.mode,
      scores: Object.fromEntries(this.scores),
      tracker: this.tracker.exportData(),
    };
  }

  /**
   * End the quiz and show final results
   */
  endQuiz() {
    if (this.questionActive) {
      this.reveal();
    }

    this.teacher.chat('');
    this.teacher.chat('🏁 Quiz Complete!');

    if (this.config.mode === 'competitive') {
      this.showLeaderboard(10);

      // Award winner
      const sorted = Array.from(this.scores.entries()).sort((a, b) => b[1] - a[1]);
      if (sorted.length > 0) {
        const [winner, score] = sorted[0];
        this.teacher.chat(`👑 Winner: ${winner} with ${score} points!`);
      }
    } else {
      const classScore = this.getClassScore();
      const passed = classScore >= this.config.passingScore;

      this.teacher.chat(`📊 Final Class Score: ${classScore.toFixed(0)}`);

      if (passed) {
        this.teacher.chat('🎉 Class passed! Great teamwork!');
      } else {
        this.teacher.chat(`📚 Class score below ${this.config.passingScore}%. Let's review together!`);
      }
    }

    this.teacher.chat('');
  }

  /**
   * Reset quiz state (for new quiz session)
   */
  reset() {
    this.questionActive = false;
    this.currentQuestion = null;
    this.answersReceived.clear();
    this.answerTimes.clear();
    this.scores.clear();
    this.questionNumber = 0;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

export default MultiplayerQuiz;
