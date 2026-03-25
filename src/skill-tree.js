/**
 * Skill Tree — visual progress model showing what the student has mastered,
 * what's in progress, and what's locked.
 *
 * Data model only (rendering would happen in a client/UI).
 * Each node is a topic or lesson with dependencies.
 */

/** @typedef {'locked'|'available'|'in_progress'|'mastered'} SkillStatus */

/** @typedef {{
 *   id: string,
 *   title: string,
 *   description: string,
 *   category: string,
 *   prerequisites: string[],
 *   status: SkillStatus,
 *   confidence: number,
 *   achievements: string[],
 *   reviewDue: boolean,
 * }} SkillNode */

export class SkillTree {
  constructor() {
    /** @type {Map<string, SkillNode>} */
    this.nodes = new Map();
  }

  /**
   * Add a skill node.
   * @param {string} id
   * @param {object} opts
   */
  addNode(id, opts = {}) {
    this.nodes.set(id, {
      id,
      title: opts.title ?? id,
      description: opts.description ?? '',
      category: opts.category ?? 'general',
      prerequisites: opts.prerequisites ?? [],
      status: 'locked',
      confidence: 0,
      achievements: [],
      reviewDue: false,
    });
  }

  /**
   * Register a lesson completion and update the skill tree.
   * @param {string} lessonId
   * @param {object} opts
   * @param {number} [opts.confidence]
   * @param {boolean} [opts.reviewDue]
   */
  completeNode(lessonId, opts = {}) {
    const node = this.nodes.get(lessonId);
    if (!node) return;
    node.status = 'mastered';
    if (opts.confidence !== undefined) node.confidence = opts.confidence;
    if (opts.reviewDue !== undefined) node.reviewDue = opts.reviewDue;
    // Unlock dependent nodes
    this._updateStatuses();
  }

  /**
   * Mark a node as in-progress (student started but hasn't completed).
   */
  startNode(lessonId, confidence = 0) {
    const node = this.nodes.get(lessonId);
    if (!node) return;
    node.status = 'in_progress';
    node.confidence = confidence;
    this._updateStatuses();
  }

  /** Add an achievement to a skill node */
  addAchievement(lessonId, achievementId) {
    const node = this.nodes.get(lessonId);
    if (node && !node.achievements.includes(achievementId)) {
      node.achievements.push(achievementId);
    }
  }

  /** Update all node statuses based on prerequisites */
  _updateStatuses() {
    for (const [id, node] of this.nodes) {
      if (node.status === 'mastered') continue;
      if (node.status === 'in_progress') continue;

      const prereqs = node.prerequisites;
      if (prereqs.length === 0) {
        node.status = 'available';
      } else {
        const allMet = prereqs.every(pid => {
          const prereq = this.nodes.get(pid);
          return prereq && prereq.status === 'mastered';
        });
        node.status = allMet ? 'available' : 'locked';
      }
    }
  }

  /** Get nodes by status */
  getByStatus(status) {
    return [...this.nodes.values()].filter(n => n.status === status);
  }

  /** Get nodes by category */
  getByCategory(category) {
    return [...this.nodes.values()].filter(n => n.category === category);
  }

  /** Get overall mastery percentage */
  get masteryPercentage() {
    if (this.nodes.size === 0) return 0;
    const mastered = [...this.nodes.values()].filter(n => n.status === 'mastered').length;
    return Math.round((mastered / this.nodes.size) * 100);
  }

  /**
   * Generate an ASCII skill tree for chat display.
   */
  toASCII() {
    const lines = ['╔══════════════════════════════╗', '║      SKILL TREE               ║', '╠══════════════════════════════╣'];

    const categories = new Map();
    for (const node of this.nodes.values()) {
      if (!categories.has(node.category)) categories.set(node.category, []);
      categories.get(node.category).push(node);
    }

    for (const [cat, nodes] of categories) {
      lines.push(`║ ${cat}:`);
      for (const node of nodes) {
        const icon = node.status === 'mastered' ? '✅' : node.status === 'in_progress' ? '🔄' : node.status === 'available' ? '🔓' : '🔒';
        lines.push(`║   ${icon} ${node.title}`);
      }
    }

    lines.push('╠══════════════════════════════╣');
    lines.push(`║ Mastery: ${this.masteryPercentage}%                  ║`);
    lines.push('╚══════════════════════════════╝');
    return lines.join('\n');
  }

  /** Build from a course */
  static fromCourse(course, progress, adaptiveEngine, spacedRepetition) {
    const tree = new SkillTree();

    for (const lesson of course.orderedLessons) {
      tree.addNode(lesson.id, {
        title: lesson.title,
        description: lesson.description,
        category: course.title,
        prerequisites: lesson.prerequisites ?? [],
        confidence: adaptiveEngine?.getConfidence(lesson.id) ?? 0,
      });

      const lessonProgress = progress?.getLesson(lesson.id);
      if (lessonProgress?.completed) {
        tree.completeNode(lesson.id, {
          confidence: adaptiveEngine?.getConfidence(lesson.id) ?? 0,
          reviewDue: spacedRepetition?.shouldInjectReview(lesson.id) ?? false,
        });
      } else if (lessonProgress) {
        tree.startNode(lesson.id, adaptiveEngine?.getConfidence(lesson.id) ?? 0);
      }
    }

    return tree;
  }
}
