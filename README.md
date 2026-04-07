You remember when you accidentally learned more building a mine than you did in an entire semester? This helps make that happen on purpose.

# CraftMind Courses
AI-powered Minecraft education. AI teachers, NPC classmates, and interactive lessons through gameplay. No homework. No dashboards. Just play. 🛠️

---

## Try It Right Now
You do not need to install anything. Point your vanilla Minecraft server's bot whitelist to:
```
https://the-fleet.casey-digennaro.workers.dev/craftmind
```
Join the world. The teacher will find you.

---

## Why This Exists
Most edtech is just digital worksheets. You do not learn best when you are being talked at. This meets you where you already are: inside Minecraft, building things. It does not try to turn Minecraft into school. It turns school into Minecraft.

## What Makes This Different
*   **No Logins or Dashboards**: Nothing ever pops up over the game. All learning happens in chat and through play.
*   **Respects Your Focus**: It will not interrupt you mid-build. Teachers wait here.
*   **Fully Forkable**: Deploy once, run forever, and modify every part. No paid tiers or hidden API keys.

## Quick Start (Fork-First)
1.  **Fork** this repository. This is a fork-first project.
2.  Deploy directly to Cloudflare Workers (zero dependencies; ~90-second setup).
3.  Point your Minecraft server's bot whitelist to your new worker URL.
4.  Customize teacher personalities and courses by editing plain text files.

## Core Features
*   **AI Teachers**: Choose from teaching styles like patient, challenger, Socratic, or hands-on.
*   **Adaptive Learning**: Tracks confidence and slows down before you get frustrated.
*   **NPC Classmates**: You teach concepts back to NPCs—a proven learning method.
*   **Skill Trees**: Your progress is visualized on in-game map walls.
*   **Discovery Zones**: Open-ended puzzles that only give hints when the system detects you are stuck.

## Architecture
A lightweight agent runtime built on the Cocapn Fleet protocol. Each NPC is an independent fleet agent. All state persists at the edge with no backend database required.

## Bring Your Own Knowledge
This is a framework, not a fixed course pack. You can add new subjects and rewrite teacher behavior by editing prompt templates and curriculum files.
> **An Honest Limitation**: Creating effective custom courses requires comfort with basic prompt engineering. Expect to spend 5-10 hours iterating on a new course module to get the pacing and dialogue right.

## Contributing
Open source. Contributions are welcome. Please open an issue first for significant changes.

## License
MIT

Superinstance and Lucineer (DiGennaro et al.)

<div style="text-align:center;padding:16px;color:#64748b;font-size:.8rem"><a href="https://the-fleet.casey-digennaro.workers.dev" style="color:#64748b">The Fleet</a> &middot; <a href="https://cocapn.ai" style="color:#64748b">Cocapn</a></div>