/**
 * Curriculum — multi-course system with prerequisites, recommended paths, and skill requirements.
 *
 * Connects courses into learning paths:
 *   "Redstone Basics" → "Advanced Redstone" → "Redstone Computers"
 *   "Building Basics" → "Interior Design" → "Architecture"
 *   "Survival 101" → "Redstone Basics" (cross-course prereqs)
 */

/** @typedef {{
 *   id: string,
 *   title: string,
 *   path: string,
 *   courseIds: string[],
 *   prerequisites: {courseId:string, minProgress:number}[],
 *   description: string,
 *   estimatedHours: number,
 *   realWorldConnections: string[],
 * }} LearningPath */

/** @typedef {{
 *   id: string,
 *   title: string,
 *   courseFile: string,
 *   difficulty: number,
 *   prerequisites: string[], // course IDs
 *   requiredSkills: string[], // skill/concept IDs needed
 *   awardsSkills: string[],
 *   realWorldConnections: string[],
 * }} CourseMeta */

export class Curriculum {
  constructor() {
    /** @type {Map<string, CourseMeta>} */
    this.courses = new Map();
    /** @type {Map<string, LearningPath>} */
    this.paths = new Map();
  }

  /** Register a course in the curriculum */
  addCourse(meta) {
    this.courses.set(meta.id, meta);
  }

  /** Register a learning path */
  addPath(path) {
    this.paths.set(path.id, path);
  }

  /**
   * Check if a student is eligible for a course.
   * @param {string} courseId
   * @param {Map<string, {completed:boolean, quizScore:number}>} completedCourses
   * @returns {{eligible:boolean, blockedBy:string[]}}
   */
  checkEligibility(courseId, completedCourses) {
    const course = this.courses.get(courseId);
    if (!course) return { eligible: false, blockedBy: ['Unknown course'] };

    const blockedBy = [];
    for (const prereqId of course.prerequisites) {
      const prereq = completedCourses.get(prereqId);
      if (!prereq?.completed) {
        blockedBy.push(this.courses.get(prereqId)?.title ?? prereqId);
      }
    }
    return { eligible: blockedBy.length === 0, blockedBy };
  }

  /**
   * Get recommended next course for a student.
   * @param {string[]} completedCourseIds
   * @returns {CourseMeta|null}
   */
  getRecommendedNext(completedCourseIds) {
    const completed = new Set(completedCourseIds);
    const eligible = [];

    for (const course of this.courses.values()) {
      if (completed.has(course.id)) continue;
      const { eligible: isEligible } = this.checkEligibility(course.id, new Map());
      // Check manually since we don't have progress here
      const prereqsMet = course.prerequisites.every(pid => completed.has(pid));
      if (prereqsMet) eligible.push(course);
    }

    if (eligible.length === 0) return null;
    // Prefer courses on a learning path, then by difficulty
    eligible.sort((a, b) => {
      const aOnPath = this._isOnAnyPath(a.id);
      const bOnPath = this._isOnAnyPath(b.id);
      if (aOnPath !== bOnPath) return bOnPath - aOnPath;
      return a.difficulty - b.difficulty;
    });
    return eligible[0];
  }

  /**
   * Get the full learning path for a student from current state.
   * @param {string[]} completedCourseIds
   * @returns {LearningPath|null}
   */
  getSuggestedPath(completedCourseIds) {
    const completed = new Set(completedCourseIds);
    for (const path of this.paths.values()) {
      // Check if this path is relevant (student has started it or is eligible)
      const firstCourse = path.courseIds[0];
      const prereqsMet = (path.prerequisites ?? []).every(p => {
        const prog = completed.get(p.courseId);
        return prog?.completed;
      });
      if (prereqsMet && !completed.has(path.courseIds[path.courseIds.length - 1])) {
        return path;
      }
    }
    return null;
  }

  /** Get real-world connections for a completed course */
  getRealWorldConnections(courseId) {
    return this.courses.get(courseId)?.realWorldConnections ?? [];
  }

  /** Load from a curriculum.json file */
  static async fromFile(filePath) {
    const { readFile } = await import('node:fs/promises');
    const raw = JSON.parse(await readFile(filePath, 'utf-8'));
    const curriculum = new Curriculum();

    if (raw.courses) {
      for (const c of raw.courses) curriculum.addCourse(c);
    }
    if (raw.paths) {
      for (const p of raw.paths) curriculum.addPath(p);
    }
    return curriculum;
  }

  _isOnAnyPath(courseId) {
    for (const path of this.paths.values()) {
      if (path.courseIds.includes(courseId)) return true;
    }
    return false;
  }
}
