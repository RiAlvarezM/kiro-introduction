---
inclusion: auto
---

# Game Coding Standards

## JavaScript Game Patterns

### Single-File Architecture

All game code lives in `game.js`. Organize with clear section comments:

```javascript
// ============================================================
// SECTION: Configuration
// ============================================================

// ============================================================
// SECTION: Utilities
// ============================================================

// ============================================================
// SECTION: Core Systems
// ============================================================
```

### Game Loop Pattern

Use a fixed-timestep game loop with delta time:

```javascript
loop(timestamp) {
  const deltaTime = Math.min((timestamp - this.lastTime) / 1000, 1 / 30);
  this.lastTime = timestamp;
  if (deltaTime <= 0) return requestAnimationFrame(this.loop);

  this.update(deltaTime);
  this.render();
  requestAnimationFrame(this.loop);
}
```

- Always clamp deltaTime to prevent spiral-of-death on tab switch
- Use seconds (not milliseconds) for all physics calculations
- Never use `setInterval` for game loops

### State Machine Pattern

Manage game states with explicit transitions:

```javascript
class StateManager {
  transition(newState) {
    if (!this.validTransitions[this.current].includes(newState)) return false;
    this.current = newState;
    this.stateEnteredAt = performance.now();
    return true;
  }
}
```

### Entity-Component Pattern

Separate data (components) from behavior (systems) for flexible composition:

```javascript
// Components are plain data holders
class TransformComponent {
  constructor(x = 0, y = 0, rotation = 0) {
    this.x = x;
    this.y = y;
    this.rotation = rotation;
  }
}

class PhysicsComponent {
  constructor() {
    this.velocity = 0;
    this.gravity = GAME_CONFIG.PHYSICS.GRAVITY;
    this.maxFallSpeed = 500;
  }
}

class SpriteComponent {
  constructor(image, width = 32, height = 32) {
    this.image = image;
    this.width = width;
    this.height = height;
  }
}

class ColliderComponent {
  constructor(radius) {
    this.radius = radius;
    this.active = true;
  }
}
```

Entities compose components to define capabilities:

```javascript
class Entity {
  constructor() {
    this.components = new Map();
  }

  addComponent(name, component) {
    this.components.set(name, component);
    return this;
  }

  getComponent(name) {
    return this.components.get(name);
  }

  hasComponent(name) {
    return this.components.has(name);
  }
}

// Example: Player entity composed from components
function createPlayer(sprite) {
  return new Entity()
    .addComponent('transform', new TransformComponent(160, 300))
    .addComponent('physics', new PhysicsComponent())
    .addComponent('sprite', new SpriteComponent(sprite, 32, 32))
    .addComponent('collider', new ColliderComponent(12));
}
```

Systems operate on entities that have the required components:

```javascript
// Systems process entities with matching components
class PhysicsSystem {
  update(entities, deltaTime) {
    for (const entity of entities) {
      if (!entity.hasComponent('physics') || !entity.hasComponent('transform')) continue;
      const physics = entity.getComponent('physics');
      const transform = entity.getComponent('transform');

      physics.velocity = Math.min(
        physics.velocity + physics.gravity * deltaTime,
        physics.maxFallSpeed
      );
      transform.y += physics.velocity * deltaTime;
    }
  }
}

class RenderSystem {
  render(entities, ctx) {
    for (const entity of entities) {
      if (!entity.hasComponent('sprite') || !entity.hasComponent('transform')) continue;
      const sprite = entity.getComponent('sprite');
      const transform = entity.getComponent('transform');

      ctx.drawImage(sprite.image, transform.x, transform.y, sprite.width, sprite.height);
    }
  }
}

class CollisionSystem {
  check(entity, obstacles) {
    if (!entity.hasComponent('collider') || !entity.hasComponent('transform')) return false;
    const collider = entity.getComponent('collider');
    const transform = entity.getComponent('transform');
    // ... collision logic using transform + collider data
  }
}
```

**When to use entity-component vs. plain classes:**

| Approach | Use When |
|----------|----------|
| Entity-Component | Multiple entity types share behaviors (e.g., player and enemies both have physics) |
| Plain Class | Single-purpose objects with fixed behavior (e.g., `ScoreSystem`, `AudioSystem`) |

For Flappy Kiro, systems like `PipeSystem`, `AudioSystem`, `ScoreSystem` remain plain classes since they are singletons with fixed responsibilities. The entity-component pattern applies to game objects that share physics/rendering/collision behavior.

### Entity Interface

All game entities (whether using components or not) follow a consistent interface:

```javascript
class Entity {
  update(deltaTime) { /* physics, movement */ }
  render(ctx) { /* drawing */ }
  reset() { /* return to initial state */ }
}
```

### Object Pool Pattern

Reuse objects to avoid garbage collection pauses:

```javascript
class ObjectPool {
  acquire() { return this.pool.pop() || this.factory(); }
  release(obj) { obj.reset(); this.pool.push(obj); }
  prewarm(count) { /* pre-allocate objects */ }
}
```

---

## Class Naming Conventions

### Classes (PascalCase)

| Class | Responsibility |
|-------|---------------|
| `GameEngine` | Top-level orchestrator, owns the game loop |
| `Player` | Ghost character physics and state |
| `PipeSystem` | Pipe generation, movement, scoring detection |
| `DifficultySystem` | Progressive speed/gap/spacing scaling |
| `StateManager` | Game state transitions |
| `ScoreSystem` | Score tracking and localStorage persistence |
| `AudioSystem` | Sound loading and playback |
| `InputHandler` | Keyboard/mouse event routing |
| `Background` | Parallax city skyline rendering |
| `CloudSystem` | Multi-layer cloud parallax |
| `BatchRenderer` | Offscreen canvas pre-rendering |
| `PerformanceMonitor` | FPS tracking and degradation detection |
| `ObjectPool` | Generic reusable object pool |

### Methods (camelCase)

- `update(deltaTime)` — frame logic
- `render(ctx)` — draw to canvas
- `reset()` — return to initial state
- `init()` — one-time setup
- `destroy()` — cleanup resources

### Constants (UPPER_SNAKE_CASE within GAME_CONFIG)

```javascript
const GAME_CONFIG = {
  PHYSICS: { GRAVITY: 800, JUMP_VELOCITY: -300 },
  WALLS: { SPEED: 120, GAP_SIZE: 140, SPACING: 350 },
  CANVAS: { WIDTH: 800, HEIGHT: 600 }
};
```

### Private Members

Prefix with underscore for internal state not meant for external access:

```javascript
this._velocity = 0;
this._lastFrameTime = 0;
```

---

## Performance Optimization Guidelines

### Canvas Rendering

1. **Minimize state changes** — batch draws that share the same `fillStyle`, `strokeStyle`, or transform
2. **Use offscreen canvases** — pre-render static or repeating elements (pipe segments, clouds)
3. **Avoid `save()`/`restore()` in hot paths** — manually reset transforms instead
4. **Use integer coordinates** — `Math.round()` positions to avoid sub-pixel anti-aliasing cost
5. **Clear only dirty regions** when possible (or full clear if most of the screen changes)

### Memory Management

1. **Object pooling** — never allocate in the game loop; reuse pipe objects, particles, etc.
2. **Pre-warm pools** — allocate expected max objects at init time (10 pipes minimum)
3. **Avoid closures in loops** — define callbacks outside hot paths
4. **Reuse arrays** — clear with `length = 0` instead of creating new arrays

### Physics & Logic

1. **Delta-time everything** — all movement uses `value * deltaTime` for frame-rate independence
2. **Early exit collisions** — check bounding box before expensive circle-rect math
3. **Spatial shortcuts** — only check collisions against pipes near the player's X position
4. **Clamp values** — prevent physics explosions with velocity and position bounds

### Audio

1. **Decode once, play many** — store decoded `AudioBuffer`, create new `AudioBufferSourceNode` per play
2. **Pool gain nodes** — reuse `GainNode` instances for volume control
3. **Lazy AudioContext** — don't create until first user interaction (autoplay policy)

### General Rules

1. **No DOM manipulation in game loop** — canvas only
2. **No string concatenation in render** — pre-compute display strings on score change
3. **Profile before optimizing** — use `PerformanceMonitor` to detect actual bottlenecks
4. **Target 60 FPS** — if rolling average drops below 45 FPS for 10+ frames, reduce visual fidelity (fewer clouds, simpler backgrounds)
5. **Zero external dependencies** — the game runs by opening `index.html` directly in a browser
