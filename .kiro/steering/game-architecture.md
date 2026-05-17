---
inclusion: auto
---

# Game Architecture Standards

## Modular Systems

### System Responsibilities

Each system is a self-contained class with a single responsibility. Systems communicate through the GameEngine orchestrator — never directly between each other.

```
┌─────────────────────────────────────────────────────┐
│                    GameEngine                        │
│  (orchestrates init, update, render, state flow)    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐    │
│  │  Player   │  │PipeSystem│  │DifficultySystem│   │
│  └──────────┘  └──────────┘  └───────────────┘    │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐    │
│  │ScoreSystem│ │AudioSystem│  │ StateManager  │    │
│  └──────────┘  └──────────┘  └───────────────┘    │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐    │
│  │InputHandler│ │Background│  │  CloudSystem  │    │
│  └──────────┘  └──────────┘  └───────────────┘    │
│                                                     │
│  ┌──────────────┐  ┌─────────────────────┐         │
│  │BatchRenderer  │  │PerformanceMonitor   │         │
│  └──────────────┘  └─────────────────────┘         │
└─────────────────────────────────────────────────────┘
```

### System Interface Contract

Every system follows this lifecycle:

```javascript
class System {
  constructor(config) { /* store config, set initial state */ }
  init() { /* async setup: load assets, pre-warm pools */ }
  update(deltaTime) { /* per-frame logic */ }
  render(ctx) { /* per-frame drawing (if visual) */ }
  reset() { /* return to initial state for restart */ }
  destroy() { /* cleanup listeners, buffers */ }
}
```

### System Registration

GameEngine maintains an ordered list of systems:

```javascript
class GameEngine {
  constructor() {
    this._systems = [];
  }

  register(system) {
    this._systems.push(system);
  }

  async init() {
    for (const system of this._systems) {
      await system.init();
    }
  }

  update(deltaTime) {
    for (const system of this._systems) {
      system.update(deltaTime);
    }
  }

  render() {
    for (const system of this._systems) {
      if (system.render) system.render(this._ctx);
    }
  }
}
```

### System Initialization Order

```
1. StateManager       (no dependencies)
2. InputHandler       (depends on StateManager)
3. AudioSystem        (no dependencies, async asset load)
4. ScoreSystem        (depends on localStorage)
5. DifficultySystem   (no dependencies)
6. Player             (depends on GAME_CONFIG)
7. PipeSystem         (depends on ObjectPool, DifficultySystem)
8. Background         (depends on GAME_CONFIG)
9. CloudSystem        (depends on GAME_CONFIG)
10. BatchRenderer     (depends on canvas)
11. PerformanceMonitor (no dependencies)
```

### Update Order (Per Frame)

```
1. InputHandler       → process queued inputs
2. StateManager       → validate state (time gates)
3. Player             → apply gravity, update position
4. PipeSystem         → move pipes, spawn/recycle, check score
5. DifficultySystem   → recalculate speed/gap/spacing
6. CloudSystem        → move clouds
7. Background         → scroll parallax
8. CollisionCheck     → player vs pipes/boundaries
9. ScoreSystem        → update if pipe passed
10. AudioSystem       → trigger sounds based on events
```

### Render Order (Back to Front)

```
1. Background         → sky + city skyline
2. PipeSystem         → green pipes with caps
3. CloudSystem        → semi-transparent clouds
4. Player             → ghosty sprite with rotation
5. HUD                → score bar, overlays
```

---

## Event Handling Patterns

### Input Event Architecture

Decouple DOM events from game logic using an action queue:

```javascript
class InputHandler {
  constructor() {
    this._actionQueue = [];
    this._bindings = new Map();
  }

  bind(canvas) {
    this._onKeyDown = (e) => this._handleKey(e);
    this._onClick = () => this._handleClick();
    document.addEventListener('keydown', this._onKeyDown);
    canvas.addEventListener('click', this._onClick);
  }

  unbind() {
    document.removeEventListener('keydown', this._onKeyDown);
    // ... remove all listeners
  }

  _handleKey(event) {
    switch (event.code) {
      case 'Space':
        event.preventDefault();
        this._actionQueue.push('jump');
        break;
      case 'KeyP':
      case 'Escape':
        this._actionQueue.push('pause');
        break;
    }
  }

  _handleClick() {
    this._actionQueue.push('interact');
  }

  flush() {
    const actions = [...this._actionQueue];
    this._actionQueue.length = 0;
    return actions;
  }
}
```

### Action Routing by State

The GameEngine routes actions based on current state:

```javascript
processInput(actions, stateManager) {
  const state = stateManager.current;

  for (const action of actions) {
    switch (state) {
      case 'Inicio':
        if (action === 'jump' || action === 'interact') {
          stateManager.transition('Playing');
        }
        break;

      case 'Playing':
        if (action === 'jump') this.player.jump();
        if (action === 'pause') stateManager.transition('Paused');
        break;

      case 'Paused':
        if (action === 'pause' || action === 'interact') {
          stateManager.transition('Playing');
        }
        break;

      case 'Game_Over':
        if (action === 'jump' || action === 'interact') {
          if (stateManager.timeInState() >= 1000) {
            this.reset();
            stateManager.transition('Playing');
          }
        }
        break;
    }
  }
}
```

### Event Rules

| Rule | Rationale |
|------|-----------|
| Queue inputs, process once per frame | Prevents multiple jumps per frame |
| Flush queue at start of update | Consistent ordering |
| Ignore inputs in wrong state | Prevents invalid transitions |
| preventDefault on Space | Stops page scroll |
| Use `event.code` not `event.key` | Layout-independent |
| Remove listeners on destroy | Prevents memory leaks |

### Game Events (Internal)

For system-to-system communication, use a lightweight callback pattern:

```javascript
class GameEngine {
  constructor() {
    this._callbacks = {};
  }

  on(event, callback) {
    (this._callbacks[event] ||= []).push(callback);
  }

  emit(event, data) {
    for (const cb of this._callbacks[event] || []) {
      cb(data);
    }
  }
}

// Usage in init:
engine.on('score', (score) => {
  audioSystem.playScore();
  difficultySystem.update(score);
});

engine.on('collision', () => {
  audioSystem.playCollision();
  stateManager.transition('Game_Over');
});

engine.on('jump', () => {
  audioSystem.playFlap();
});
```

---

## State Management

### State Diagram

```
         ┌─────────────────────────────────────┐
         │                                     │
         ▼                                     │
    ┌─────────┐    jump/click    ┌─────────┐   │
    │  Inicio  │ ──────────────► │ Playing  │   │
    └─────────┘                  └─────────┘   │
                                   │     ▲     │
                              P/Esc│     │P/Esc│
                                   ▼     │     │
                                ┌─────────┐    │
                                │ Paused  │    │
                                └─────────┘    │
                                               │
                    collision                   │
         Playing ──────────────► ┌──────────┐  │
                                 │ Game_Over │──┘
                                 └──────────┘
                                  (after 1s)
```

### Valid Transitions Table

```javascript
const VALID_TRANSITIONS = {
  Inicio:    ['Playing'],
  Playing:   ['Paused', 'Game_Over'],
  Paused:    ['Playing'],
  Game_Over: ['Playing']  // only after 1s time gate
};
```

### State Manager Implementation

```javascript
class StateManager {
  constructor() {
    this.current = 'Inicio';
    this._stateEnteredAt = performance.now();
  }

  transition(newState) {
    if (!VALID_TRANSITIONS[this.current]?.includes(newState)) {
      return false;
    }

    // Time gate for Game_Over → Playing
    if (this.current === 'Game_Over' && newState === 'Playing') {
      if (this.timeInState() < 1000) return false;
    }

    this.current = newState;
    this._stateEnteredAt = performance.now();
    return true;
  }

  timeInState() {
    return performance.now() - this._stateEnteredAt;
  }

  get isPlaying() { return this.current === 'Playing'; }
  get isPaused() { return this.current === 'Paused'; }
  get isGameOver() { return this.current === 'Game_Over'; }
}
```

### State-Dependent Behavior Matrix

| System | Inicio | Playing | Paused | Game_Over |
|--------|--------|---------|--------|-----------|
| Player physics | frozen | active | frozen | frozen |
| Pipe movement | frozen | active | frozen | frozen |
| Pipe spawning | off | active | off | off |
| Background scroll | slow (30px/s) | parallax | frozen | frozen |
| Cloud movement | slow | active | frozen | frozen |
| Input: jump | start game | jump | ignored | restart (after 1s) |
| Input: pause | ignored | pause | resume | ignored |
| Audio | silent | active | muted | collision once |
| Score display | high score only | current + high | current + high | final + high |

### Reset Protocol

On transition from Game_Over → Playing:

```javascript
reset() {
  this.player.reset();        // position, velocity → initial
  this.pipeSystem.reset();    // clear all pipes, release to pool
  this.scoreSystem.reset();   // score → 0 (preserve high score)
  this.difficultySystem.reset(); // speed/gap/spacing → base values
  this.cloudSystem.reset();   // optional: reposition clouds
  this.background.reset();    // reset scroll offset
}
```

**Invariant:** After `reset()`, the game state is identical to first entering Playing from Inicio, except high score is preserved.
