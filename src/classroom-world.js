/**
 * Classroom World Builder — Advanced RCON-based classroom construction.
 * Builds complete multiplayer classrooms with desks, blackboard, lighting, and entrance.
 */

/**
 * @typedef {object} ClassroomConfig
 * @property {number} x — X coordinate of classroom center
 * @property {number} y — Y coordinate of classroom floor
 * @property {number} z — Z coordinate of classroom center
 * @property {number} width — Room width (default: 15)
 * @property {number} depth — Room depth (default: 10)
 * @property {number} height — Room height (default: 5)
 * @property {string} lessonTitle — Title to display on blackboard
 * @property {number} studentDesks — Number of student desks (default: 4)
 * @property {string} wallBlock — Block ID for walls (default: oak_planks)
 * @property {string} floorBlock — Block ID for floor (default: stone)
 * @property {string} ceilingBlock — Block ID for ceiling (default: glass)
 */

/**
 * RCON Client for Minecraft server commands
 */
class RCONClient {
  /**
   * @param {string} host
   * @param {number} port
   * @param {string} password
   */
  constructor(host, port, password) {
    this.host = host;
    this.port = port;
    this.password = password;
    this.connected = false;
  }

  /**
   * Connect to RCON server
   * Note: This is a simplified version. For production, use a proper RCON library.
   */
  async connect() {
    // In production, use a proper RCON library like 'rcon-client' or 'minecraft-rcon'
    this.connected = true;
    return true;
  }

  /**
   * Send a command via RCON
   * @param {string} command
   * @returns {Promise<string>}
   */
  async send(command) {
    if (!this.connected) {
      throw new Error('RCON not connected. Call connect() first.');
    }

    // Simplified - in production, actual RCON protocol happens here
    console.log(`[RCON] ${command}`);
    return '';
  }

  /**
   * Disconnect from RCON
   */
  disconnect() {
    this.connected = false;
  }
}

/**
 * Classroom World Builder — Constructs multiplayer classrooms
 */
export class ClassroomWorldBuilder {
  /**
   * @param {RCONClient} rcon
   * @param {ClassroomConfig} config
   */
  constructor(rcon, config) {
    this.rcon = rcon;
    this.config = {
      x: 0,
      y: 64,
      z: 0,
      width: 15,
      depth: 10,
      height: 5,
      lessonTitle: '📚 LESSON',
      studentDesks: 4,
      wallBlock: 'oak_planks',
      floorBlock: 'stone',
      ceilingBlock: 'glass',
      ...config,
    };
  }

  /**
   * Build the complete classroom
   * @returns {Promise<void>}
   */
  async buildClassroom() {
    const { x, y, z, width, depth, height } = this.config;

    // Calculate bounds
    const halfWidth = Math.floor(width / 2);
    const halfDepth = Math.floor(depth / 2);
    const minX = x - halfWidth;
    const maxX = x + halfWidth;
    const minZ = z - halfDepth;
    const maxZ = z + halfDepth;

    // Build components in sequence
    await this.clearArea(minX, y, minZ, maxX, y + height + 2, maxZ);
    await this.buildFloor(minX, y - 1, minZ, maxX, maxZ);
    await this.buildWalls(minX, y, minZ, maxX, y + height, maxZ);
    await this.buildCeiling(minX, y + height, minZ, maxX, maxZ);
    await this.buildTeacherDesk(x, y, z - halfDepth + 2);
    await this.buildStudentDesks(x, y, z + 2);
    await this.buildBlackboard(x, y + 2, minZ + 1);
    await this.buildBookshelf(minX + 1, y, minZ + 1);
    await this.buildEntrance(minX + 2, y, maxZ);
    await this.addLighting(x, y + height - 1, z);

    console.log('✅ Classroom built successfully!');
  }

  /**
   * Clear the area before building
   * @param {number} minX
   * @param {number} minY
   * @param {number} minZ
   * @param {number} maxX
   * @param {number} maxY
   * @param {number} maxZ
   */
  async clearArea(minX, minY, minZ, maxX, maxY, maxZ) {
    await this.rcon.send(`/fill ${minX} ${minY} ${minZ} ${maxX} ${maxY} ${maxZ} air replace`);
    await this.delay(50);
  }

  /**
   * Build the classroom floor
   * @param {number} minX
   * @param {number} y
   * @param {number} minZ
   * @param {number} maxX
   * @param {number} maxZ
   */
  async buildFloor(minX, y, minZ, maxX, maxZ) {
    await this.rcon.send(`/fill ${minX} ${y} ${minZ} ${maxX} ${y} ${maxZ} ${this.config.floorBlock}`);
    await this.delay(100);
  }

  /**
   * Build classroom walls
   * @param {number} minX
   * @param {number} minY
   * @param {number} minZ
   * @param {number} maxX
   * @param {number} maxY
   * @param {number} maxZ
   */
  async buildWalls(minX, minY, minZ, maxX, maxY, maxZ) {
    // North wall (with blackboard space)
    await this.rcon.send(`/fill ${minX} ${minY} ${minZ} ${maxX} ${maxY} ${minZ} ${this.config.wallBlock} replace`);
    await this.delay(100);

    // South wall (with door space)
    await this.rcon.send(`/fill ${minX} ${minY} ${maxZ} ${maxX} ${maxY} ${maxZ} ${this.config.wallBlock} replace`);
    await this.delay(100);

    // East wall
    await this.rcon.send(`/fill ${maxX} ${minY} ${minZ} ${maxX} ${maxY} ${maxZ} ${this.config.wallBlock} replace`);
    await this.delay(100);

    // West wall
    await this.rcon.send(`/fill ${minX} ${minY} ${minZ} ${minX} ${maxY} ${maxZ} ${this.config.wallBlock} replace`);
    await this.delay(100);
  }

  /**
   * Build glass ceiling
   * @param {number} minX
   * @param {number} y
   * @param {number} minZ
   * @param {number} maxX
   * @param {number} maxZ
   */
  async buildCeiling(minX, y, minZ, maxX, maxZ) {
    await this.rcon.send(`/fill ${minX} ${y} ${minZ} ${maxX} ${y} ${maxZ} ${this.config.ceilingBlock}`);
    await this.delay(100);
  }

  /**
   * Build teacher desk at front of classroom
   * @param {number} x
   * @param {number} y
   * @param {number} z
   */
  async buildTeacherDesk(x, y, z) {
    // Desk surface (3x2)
    await this.rcon.send(`/fill ${x - 1} ${y} ${z} ${x + 1} ${y} ${z + 1} oak_slab[type=top]`);
    await this.delay(50);

    // Desk legs
    await this.rcon.send(`/setblock ${x - 1} ${y - 1} ${z} oak_fence`);
    await this.rcon.send(`/setblock ${x + 1} ${y - 1} ${z} oak_fence`);
    await this.rcon.send(`/setblock ${x - 1} ${y - 1} ${z + 1} oak_fence`);
    await this.rcon.send(`/setblock ${x + 1} ${y - 1} ${z + 1} oak_fence`);
    await this.delay(50);

    // Teacher chair
    await this.rcon.send(`/setblock ${x} ${y} ${z - 1} oak_stairs`);
    await this.delay(50);
  }

  /**
   * Build student desks facing the teacher
   * @param {number} centerX
   * @param {number} y
   * @param {number} startZ
   */
  async buildStudentDesks(centerX, y, startZ) {
    const numDesks = this.config.studentDesks;
    const deskSpacing = 3;
    const desksPerRow = Math.min(numDesks, 4);

    for (let i = 0; i < numDesks; i++) {
      const row = Math.floor(i / desksPerRow);
      const col = i % desksPerRow;

      // Offset from center, alternating left/right
      const offsetX = (col - Math.floor(desksPerRow / 2)) * deskSpacing;
      const offsetZ = startZ + row * 3;

      const deskX = centerX + offsetX;
      const deskZ = offsetZ;

      // Desk surface (2x1)
      await this.rcon.send(`/fill ${deskX - 1} ${y} ${deskZ} ${deskX} ${y} ${deskZ} oak_slab[type=top]`);
      await this.delay(30);

      // Chair behind desk
      await this.rcon.send(`/setblock ${deskX - 0.5} ${y} ${deskZ + 1} oak_stairs[facing=south]`);
      await this.delay(30);
    }
  }

  /**
   * Build blackboard on front wall
   * @param {number} x
   * @param {number} y
   * @param {number} z
   */
  async buildBlackboard(x, y, z) {
    // Blackboard surface (dark prismarine)
    const boardWidth = 7;
    const boardHeight = 3;

    await this.rcon.send(`/fill ${x - Math.floor(boardWidth / 2)} ${y} ${z} ${x + Math.floor(boardWidth / 2)} ${y + boardHeight} ${z} dark_prismarine`);
    await this.delay(100);

    // Frame
    await this.rcon.send(`/fill ${x - Math.floor(boardWidth / 2) - 1} ${y - 1} ${z} ${x + Math.floor(boardWidth / 2) + 1} ${y + boardHeight + 1} ${z} spruce_fence`);
    await this.delay(100);

    // Lesson title sign (using data merge for text)
    const signX = x;
    const signY = y + 1;
    const signZ = z - 1;

    await this.rcon.send(`/setblock ${signX} ${signY} ${signZ} oak_wall_sign[facing=north]`);
    await this.delay(50);

    // Set sign text with lesson title
    const title = this.config.lessonTitle;
    await this.rcon.send(`/data merge block ${signX} ${signY} ${signZ} {Text1:'{"text":"${title}","bold":true,"color":"black"}',Text2:'{"text":"-----------","color":"dark_gray"}',Text3:'{"text":"Ready to","color":"dark_blue"}',Text4:'{"text":"Learn!","color":"dark_blue"}'}`);
    await this.delay(100);
  }

  /**
   * Build bookshelf with course materials
   * @param {number} x
   * @param {number} y
   * @param {number} z
   */
  async buildBookshelf(x, y, z) {
    // Bookshelf blocks (2x3x1)
    await this.rcon.send(`/fill ${x} ${y} ${z} ${x + 1} ${y + 2} ${z} bookshelf`);
    await this.delay(50);

    // Add some books as item frames
    await this.rcon.send(`/setblock ${x} ${y + 1} ${z - 1} item_frame{Facing:west,Item:{id:"minecraft:book",Count:1}}`);
    await this.delay(50);
  }

  /**
   * Build classroom entrance with door and sign
   * @param {number} x
   * @param {number} y
   * @param {number} z
   */
  async buildEntrance(x, y, z) {
    // Clear doorway
    await this.rcon.send(`/fill ${x} ${y} ${z} ${x + 1} ${y + 2} ${z} air`);
    await this.delay(50);

    // Door
    await this.rcon.send(`/setblock ${x} ${y} ${z} oak_door[hanging=east,facing=east,open=false]`);
    await this.rcon.send(`/setblock ${x} ${y + 1} ${z} oak_door[hanging=half,facing=east,open=false]`);
    await this.delay(100);

    // Welcome sign
    await this.rcon.send(`/setblock ${x - 1} ${y + 1} ${z + 1} oak_sign[rotation=4]`);
    await this.delay(50);

    // Sign text
    await this.rcon.send(`/data merge block ${x - 1} ${y + 1} ${z + 1} {Text1:'{"text":"Classroom 101","bold":true}',Text2:'{"text":"-----------"}',Text3:'{"text":"Type !join","color":"green"}',Text4:'{"text":"to enter!","color":"green"}'}`);
    await this.delay(100);
  }

  /**
   * Add lighting with glowstone in ceiling
   * @param {number} centerX
   * @param {number} y
   * @param {number} centerZ
   */
  async addLighting(centerX, y, centerZ) {
    // Center light
    await this.rcon.send(`/setblock ${centerX} ${y} ${centerZ} glowstone`);
    await this.delay(50);

    // Corner lights for even coverage
    const { width, depth } = this.config;
    const halfWidth = Math.floor(width / 2);
    const halfDepth = Math.floor(depth / 2);

    const positions = [
      { x: centerX - halfWidth + 2, z: centerZ - halfDepth + 2 },
      { x: centerX + halfWidth - 2, z: centerZ - halfDepth + 2 },
      { x: centerX - halfWidth + 2, z: centerZ + halfDepth - 2 },
      { x: centerX + halfWidth - 2, z: centerZ + halfDepth - 2 },
    ];

    for (const pos of positions) {
      await this.rcon.send(`/setblock ${pos.x} ${y} ${pos.z} sea_lantern`);
      await this.delay(50);
    }
  }

  /**
   * Clear the classroom (for teardown)
   * @returns {Promise<void>}
   */
  async clearClassroom() {
    const { x, y, z, width, depth, height } = this.config;
    const halfWidth = Math.floor(width / 2);
    const halfDepth = Math.floor(depth / 2);

    await this.rcon.send(`/fill ${x - halfWidth - 5} ${y - 2} ${z - halfDepth - 5} ${x + halfWidth + 5} ${y + height + 5} ${z + halfDepth + 5} air replace`);
    console.log('🧹 Classroom cleared.');
  }

  /**
   * Utility: delay between commands to prevent server overload
   * @param {number} ms
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update the blackboard with new text
   * @param {string} title
   * @param {string[]} lines — up to 3 additional lines
   */
  async updateBlackboard(title, lines = []) {
    const { x, y, z } = this.config;
    const signX = x;
    const signY = y + 3;
    const signZ = z - Math.floor(this.config.depth / 2);

    const textLines = [
      `"${title.substring(0, 20)}"`,
      lines[0] ? `"${lines[0].substring(0, 20)}"` : '""',
      lines[1] ? `"${lines[1].substring(0, 20)}"` : '""',
      lines[2] ? `"${lines[2].substring(0, 20)}"` : '""',
    ];

    await this.rcon.send(`/data merge block ${signX} ${signY} ${signZ} {Text1:'{"text":${textLines[0]},"bold":true}',Text2:'{"text":${textLines[1]}}',Text3:'{"text":${textLines[2]}}',Text4:'{"text":${textLines[3]}}'}`);
  }
}

/**
 * Factory function to create a classroom builder
 * @param {object} opts
 * @param {string} opts.host — RCON host
 * @param {number} opts.port — RCON port
 * @param {string} opts.password — RCON password
 * @param {ClassroomConfig} opts.config — Classroom configuration
 * @returns {Promise<ClassroomWorldBuilder>}
 */
export async function createClassroomBuilder(opts) {
  const rcon = new RCONClient(opts.host, opts.port, opts.password);
  await rcon.connect();

  return new ClassroomWorldBuilder(rcon, opts.config);
}

export default ClassroomWorldBuilder;
