# Arena Strike

A browser-based 3D first-person shooter built with [Three.js](https://threejs.org/). Fight a fully armored AI enemy in a closed arena — use cover, aim with the mouse, and land your shots before the bot takes you down.

## Features

- First-person 3D arena with walls, obstacles, and dynamic lighting
- Mouse look with pointer lock
- Visible bullet tracers for player and enemy
- Right-click zoom with target lock onto the enemy
- Detailed enemy bot with armor, glowing eyes, and rifle
- Health HUD, crosshair, hit effects, and win/lose screens

## Controls

| Input | Action |
|-------|--------|
| ↑ / ↓ | Move forward / backward |
| ← / → | Turn left / right (fallback when pointer lock is inactive) |
| Mouse | Aim / look around |
| Left click | Shoot |
| Right click (hold) | Zoom in and lock onto the enemy |

## Getting started

The game uses ES modules and loads Three.js from a CDN, so run it through a local server rather than opening `index.html` directly.

### Option 1 — Python

```bash
cd "Arena Strike - 3d shooter arcade"
python -m http.server 3456
```

Then open [http://localhost:3456](http://localhost:3456).

### Option 2 — Node.js

```bash
cd "Arena Strike - 3d shooter arcade"
npx serve .
```

Click **START GAME**, then click the canvas to capture the mouse.

## Gameplay

- You and the enemy each start with **100 HP**
- Your shots deal **25 damage** (4 hits to eliminate the enemy)
- Enemy shots deal **12 damage**
- The bot patrols the arena, chases you when you're nearby, and fires back with some aim spread
- Use obstacles for cover and right-click to snap zoom toward the enemy when lining up a shot

## Project structure

```
├── index.html   # Page shell, menu, and HUD
├── style.css    # Menu, HUD, and crosshair styling
├── game.js      # Three.js scene, player, AI, and combat logic
└── LICENSE      # MIT License
```

## Tech stack

- **Three.js** (v0.162) — 3D rendering
- **Vanilla JavaScript** — game logic, input, and AI
- **HTML / CSS** — UI and overlay

## License

MIT — see [LICENSE](LICENSE).
