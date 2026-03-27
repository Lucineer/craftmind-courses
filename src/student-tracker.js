/**
 * Student Tracking System — Multi-student progress tracking for multiplayer classrooms.
 * Records join times, answers, comprehension scores, and learning streaks.
 */

/**
 * @typedef {object} StudentRecord
 * @property {string} name — Student username
 * @property {Date} joinTime — When student joined the classroom
 * @property {Date} lastActive — Last activity timestamp
 * @property {Answer[]} answers — List of all answers given
 * @property {Map<string, TopicStats>} topicStats — Per-topic statistics
 * @property {number} currentStreak — Current consecutive correct answers
 * @property {number} bestStreak — Best streak achieved
 * @property {number} totalScore — Total points earned
 * @property {boolean} isActive — Whether student is currently in classroom
 */

/**
 * @typedef {object} Answer
 * @property {string} questionId
 * @property {string} question
 * @property {string} givenAnswer
 * @property {string|boolean|number} correctAnswer
 * @property {boolean} isCorrect
 * @property {number} points — Points awarded
 * @property {number} timeTaken — Milliseconds to answer
 * @property {Date} timestamp
 * @property {string} [topic] — Topic for confidence tracking
 */

/**
 * @typedef {object} TopicStats
 * @property {string} topic
 * @property {number} totalAttempts — Total questions attempted
 * @property {number} correctAnswers — Correct answers given
 * @property {number} averageTime — Average time to answer (ms)
 * @property {number} comprehensionScore — 0.0-1.0 comprehension score
 * @property {Date} lastAttempt — Last time this topic was tested
 */

/**
 * Student Record — Individual student data
 */
class StudentRecord {
  /**
   * @param {string} name
   */
  constructor(name) {
    this.name = name;
    this.joinTime = new Date();
    this.lastActive = new Date();
    this.answers = [];
    this.topicStats = new Map();
    this.currentStreak = 0;
    this.bestStreak = 0;
    this.totalScore = 0;
    this.isActive = true;
  }

  /**
   * Record an answer from this student
   * @param {object} answerData
   * @param {string} answerData.questionId
   * @param {string} answerData.question
   * @param {string} answerData.givenAnswer
   * @param {string|boolean|number} answerData.correctAnswer
   * @param {boolean} answerData.isCorrect
   * @param {number} answerData.points
   * @param {number} answerData.timeTaken
   * @param {string} [answerData.topic]
   */
  recordAnswer(answerData) {
    const answer = {
      ...answerData,
      timestamp: new Date(),
    };

    this.answers.push(answer);
    this.lastActive = new Date();
    this.totalScore += answer.points;

    // Update streak
    if (answer.isCorrect) {
      this.currentStreak++;
      this.bestStreak = Math.max(this.bestStreak, this.currentStreak);
    } else {
      this.currentStreak = 0;
    }

    // Update topic stats
    if (answer.topic) {
      this.updateTopicStats(answer.topic, answer);
    }
  }

  /**
   * Update statistics for a specific topic
   * @param {string} topic
   * @param {Answer} answer
   */
  updateTopicStats(topic, answer) {
    let stats = this.topicStats.get(topic);

    if (!stats) {
      stats = {
        topic,
        totalAttempts: 0,
        correctAnswers: 0,
        totalTime: 0,
        comprehensionScore: 0.5,
        lastAttempt: new Date(),
      };
      this.topicStats.set(topic, stats);
    }

    stats.totalAttempts++;
    stats.totalTime += answer.timeTaken;
    stats.lastAttempt = new Date();

    if (answer.isCorrect) {
      stats.correctAnswers++;
    }

    // Calculate comprehension score
    // Weight: 60% accuracy, 40% speed (relative to average)
    const accuracy = stats.correctAnswers / stats.totalAttempts;
    const avgTime = stats.totalTime / stats.totalAttempts;
    const speedScore = Math.max(0, Math.min(1, 10000 / avgTime)); // 10s baseline
    stats.comprehensionScore = (accuracy * 0.6) + (speedScore * 0.4);
  }

  /**
   * Get statistics for a specific topic
   * @param {string} topic
   * @returns {TopicStats|null}
   */
  getTopicStats(topic) {
    const stats = this.topicStats.get(topic);
    if (!stats) return null;

    return {
      ...stats,
      averageTime: stats.totalTime / stats.totalAttempts,
    };
  }

  /**
   * Get all topic statistics
   * @returns {TopicStats[]}
   */
  getAllTopicStats() {
    return Array.from(this.topicStats.values()).map(stats => ({
      ...stats,
      averageTime: stats.totalTime / stats.totalAttempts,
    }));
  }

  /**
   * Calculate overall accuracy
   * @returns {number} 0.0-1.0
   */
  getOverallAccuracy() {
    if (this.answers.length === 0) return 0;
    const correct = this.answers.filter(a => a.isCorrect).length;
    return correct / this.answers.length;
  }

  /**
   * Get average time per answer
   * @returns {number} milliseconds
   */
  getAverageAnswerTime() {
    if (this.answers.length === 0) return 0;
    const totalTime = this.answers.reduce((sum, a) => sum + a.timeTaken, 0);
    return totalTime / this.answers.length;
  }

  /**
   * Mark student as inactive (left classroom)
   */
  markInactive() {
    this.isActive = false;
    this.lastActive = new Date();
  }

  /**
   * Mark student as active (returned to classroom)
   */
  markActive() {
    this.isActive = true;
    this.lastActive = new Date();
  }

  /**
   * Get session duration in seconds
   * @returns {number}
   */
  getSessionDuration() {
    return Math.floor((this.lastActive - this.joinTime) / 1000);
  }

  /**
   * Get a summary of this student's performance
   * @returns {object}
   */
  getSummary() {
    return {
      name: this.name,
      joinTime: this.joinTime,
      lastActive: this.lastActive,
      isActive: this.isActive,
      totalAnswers: this.answers.length,
      correctAnswers: this.answers.filter(a => a.isCorrect).length,
      accuracy: this.getOverallAccuracy(),
      averageTime: this.getAverageAnswerTime(),
      currentStreak: this.currentStreak,
      bestStreak: this.bestStreak,
      totalScore: this.totalScore,
      sessionDuration: this.getSessionDuration(),
      topicCount: this.topicStats.size,
    };
  }
}

/**
 * Student Tracker — Manages all students in a multiplayer classroom
 */
export class StudentTracker {
  constructor() {
    /** @type {Map<string, StudentRecord>} */
    this.students = new Map();
    this.classroomStartTime = new Date();
  }

  /**
   * Add a student to the tracker
   * @param {string} studentName
   * @returns {StudentRecord}
   */
  addStudent(studentName) {
    if (this.students.has(studentName)) {
      const existing = this.students.get(studentName);
      existing.markActive();
      console.log(`📝 Student re-joined: ${studentName}`);
      return existing;
    }

    const record = new StudentRecord(studentName);
    this.students.set(studentName, record);
    console.log(`✅ Student joined: ${studentName}`);
    return record;
  }

  /**
   * Remove a student from the classroom
   * @param {string} studentName
   */
  removeStudent(studentName) {
    const record = this.students.get(studentName);
    if (record) {
      record.markInactive();
      console.log(`👋 Student left: ${studentName}`);
    }
  }

  /**
   * Record an answer from a student
   * @param {string} studentName
   * @param {object} answerData
   * @returns {boolean} true if recorded, false if student not found
   */
  recordAnswer(studentName, answerData) {
    const record = this.students.get(studentName);
    if (!record) {
      console.warn(`⚠️ Unknown student: ${studentName}`);
      return false;
    }

    record.recordAnswer(answerData);
    return true;
  }

  /**
   * Get progress data for a specific student
   * @param {string} studentName
   * @returns {StudentRecord|null}
   */
  getProgress(studentName) {
    return this.students.get(studentName) || null;
  }

  /**
   * Get summary for a specific student
   * @param {string} studentName
   * @returns {object|null}
   */
  getStudentSummary(studentName) {
    const record = this.students.get(studentName);
    return record ? record.getSummary() : null;
  }

  /**
   * Get all active students
   * @returns {StudentRecord[]}
   */
  getActiveStudents() {
    return Array.from(this.students.values()).filter(s => s.isActive);
  }

  /**
   * Get all students (including inactive)
   * @returns {StudentRecord[]}
   */
  getAllStudents() {
    return Array.from(this.students.values());
  }

  /**
   * Get leaderboard sorted by score
   * @param {number} limit — Maximum number of entries
   * @returns {object[]}
   */
  getLeaderboard(limit = 10) {
    return this.getAllStudents()
      .map(record => record.getSummary())
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, limit);
  }

  /**
   * Get comprehension scores for all students by topic
   * @param {string} [topic] — Filter by specific topic
   * @returns {Map<string, TopicStats[]>}
   */
  getComprehensionScores(topic = null) {
    const result = new Map();

    for (const [name, record] of this.students) {
      const stats = topic
        ? record.getTopicStats(topic)
        : record.getAllTopicStats();

      if (stats) {
        result.set(name, Array.isArray(stats) ? stats : [stats]);
      }
    }

    return result;
  }

  /**
   * Get students with weak comprehension in a topic
   * @param {string} topic
   * @param {number} threshold — Maximum comprehension score (default: 0.6)
   * @returns {Array<{name:string, score:number}>}
   */
  getStudentsNeedingHelp(topic, threshold = 0.6) {
    const weak = [];

    for (const [name, record] of this.students) {
      const stats = record.getTopicStats(topic);
      if (stats && stats.comprehensionScore < threshold) {
        weak.push({ name, score: stats.comprehensionScore });
      }
    }

    return weak.sort((a, b) => a.score - b.score);
  }

  /**
   * Get top performers for a topic
   * @param {string} topic
   * @param {number} limit — Maximum number of students
   * @returns {Array<{name:string, score:number}>}
   */
  getTopPerformers(topic, limit = 3) {
    const performers = [];

    for (const [name, record] of this.students) {
      const stats = record.getTopicStats(topic);
      if (stats) {
        performers.push({ name, score: stats.comprehensionScore });
      }
    }

    return performers
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Calculate classroom-wide statistics
   * @returns {object}
   */
  getClassroomStats() {
    const students = this.getAllStudents();
    const active = this.getActiveStudents();

    const totalAnswers = students.reduce((sum, s) => sum + s.answers.length, 0);
    const correctAnswers = students.reduce(
      (sum, s) => sum + s.answers.filter(a => a.isCorrect).length,
      0
    );
    const totalScore = students.reduce((sum, s) => sum + s.totalScore, 0);
    const bestStreak = Math.max(...students.map(s => s.bestStreak), 0);

    return {
      totalStudents: students.length,
      activeStudents: active.length,
      totalAnswers,
      correctAnswers,
      classAccuracy: totalAnswers > 0 ? correctAnswers / totalAnswers : 0,
      totalScore,
      averageScore: students.length > 0 ? totalScore / students.length : 0,
      bestStreak,
      classroomDuration: Math.floor((new Date() - this.classroomStartTime) / 1000),
    };
  }

  /**
   * Export data for analysis/persistence
   * @returns {object}
   */
  exportData() {
    return {
      classroomStartTime: this.classroomStartTime,
      exportTime: new Date(),
      students: Array.from(this.students.entries()).map(([name, record]) => ({
        name,
        ...record.getSummary(),
        answers: record.answers,
        topicStats: record.getAllTopicStats(),
      })),
      stats: this.getClassroomStats(),
    };
  }

  /**
   * Import data from previous session
   * @param {object} data
   */
  importData(data) {
    this.classroomStartTime = new Date(data.classroomStartTime);

    for (const studentData of data.students) {
      const record = new StudentRecord(studentData.name);
      record.joinTime = new Date(studentData.joinTime);
      record.lastActive = new Date(studentData.lastActive);
      record.answers = studentData.answers;
      record.currentStreak = studentData.currentStreak;
      record.bestStreak = studentData.bestStreak;
      record.totalScore = studentData.totalScore;
      record.isActive = studentData.isActive;

      // Restore topic stats
      for (const stats of studentData.topicStats) {
        record.topicStats.set(stats.topic, stats);
      }

      this.students.set(studentData.name, record);
    }
  }

  /**
   * Clear all tracking data
   */
  clear() {
    this.students.clear();
    this.classroomStartTime = new Date();
  }
}

export default StudentTracker;
