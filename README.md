You remember when you accidentally learned more building a mine than you did in an entire semester? This helps make that happen on purpose.

# CraftMind Courses
AI-powered Minecraft education. AI teachers, NPC classmates, and interactive lessons through gameplay. No homework. No dashboards. Just play.

---

## Why this exists
Most edtech is digital worksheets. Kids do not learn best when they are being talked at. This meets them where they already are: inside Minecraft, building things.

It does not try to turn Minecraft into school. It turns school into Minecraft.

## Try it right now
You don't need to install anything. Point any vanilla Minecraft server's bot whitelist to:
`https://the-fleet.casey-digennaro.workers.dev/craftmind`

Join the world. The teacher will find you.

---

## What makes this different
- Runs on Cloudflare Workers. Zero dependencies. Minimal running costs for small groups.
- No logins or admin portals. Every interaction happens in-game.
- You own 100% of it. Change every line. Make a course for your kid, classroom, or friend group.
- Built on the open Cocapn Fleet protocol. This is not a walled product.

## Features
- **AI Teacher System** – Pick teaching styles: patient, challenger, Socratic, hands-on, or the one that tells subject-specific jokes.
- **Adaptive Learning** – Tracks confidence, not just answers. It will slow down before a student gets frustrated.
- **Spaced Repetition** – Uses a retention algorithm, but reviews happen naturally while you mine or build.
- **Discovery Zones** – Open-ended puzzles that give hints only when you are stuck.
- **NPC Classmates** – Students can teach concepts back to NPCs, a highly effective way to confirm understanding.
- **Skill Trees** – Progress is plotted on in-game map walls. Everyone sees what they have mastered.

## Quick Start
1. **Fork** this repository.
2. Deploy it to Cloudflare Workers. No extra configuration is required.
3. Point your Minecraft server's bot whitelist to your worker URL.
4. Customize the teacher personalities and course content by editing text files.

## Architecture
A lightweight agent runtime built on the Cocapn Fleet protocol. Every NPC is an independent fleet agent. All state is edge stored.

## Bring Your Own Knowledge
This is a framework. You can add new courses and define teaching behavior by editing prompt templates and curriculum files. An honest limitation: effective customization requires familiarity with basic prompt engineering.

## Contributing
This project follows a fork-first philosophy. Fork it. Build the thing you need. If you make something useful, send a pull request.

---

MIT License · Superinstance & Lucineer (DiGennaro et al.)

<div align="center">
  <a href="https://the-fleet.casey-digennaro.workers.dev">The Fleet</a> · 
  <a href="https://cocapn.ai">Cocapn</a>
</div>