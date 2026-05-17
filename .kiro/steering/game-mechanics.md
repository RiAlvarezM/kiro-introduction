---
inclusion: auto
---

# Game Mechanics Standards

## Physics Constants

All physics values are defined in `GAME_CONFIG` and referenced by systems at runtime. Never hardcode physics values inline.

```javascript
const GAME_CONFIG = {
  PHYSICS: {
    GRAVITY: 980,            // px/s² — acceleration applied every frame
    JUMP_VELOCITY: -300,     // px/s — instantaneous upward impulse
    TERMINAL_VELOCITY: 500,  // px/s — max downward speed
    MAX_UP_VELOCITY: -300,   // px/s — max upward speed (same as jump)
  },
  OBSTACLES: {
    BASE_SPEED: 150,         // px/s — initial horizontal scroll speed
    WIDTH: 60,               // px — obstacle width
    BASE_GAP: 160,           // px — initial vertical gap between top/bottom
    BASE_SPACING: 250,       // px — initial horizontal distance between pairs
    MIN_GAP: 100,            // px — smallest gap at max difficulty
    MIN_SPACING: 180,        // px — closest obstacle pairs at max difficulty
    MAX_SPEED: 300,          // px/s — speed cap (200% of base)
  },
  PLAYER: {
    X_PERCENT: 0.20,         // fixed horizontal position (20% of canvas width)
    HITBOX_FACTOR: 0.4,      // radius = min(width, height) * factor
  },
  BACKGROUND: {
    PARALLAX_FACTOR: 0.3,    // background scrolls at 30% of obstacle speed
  },
  TIMING: {
    RESTART_DELAY: 1000,     // ms — time gate before restart input accepted
    ASSET_TIMEOUT: 10000,    // ms — max wait for asset loading
    MAX_DELTA: 1 / 30,       // s — clamp deltaTime to prevent physics explosion
  }
};
```

### Rules for Physics Constants

1. All speeds are in **pixels per second** (px/s)
2. All accelerations are in **pixels per second squared** (px/s²)
3. All durations are in **milliseconds** (ms) for timers, **seconds** (s) for deltaTime
4. Positions are in **pixels** relative to canvas top-left (0,0)
5. Positive Y is downward (canvas convention)
6. Negative velocity = moving upward

---

## Movement Algorithms

### Gravity Application

```javascript
// Apply every frame during Playing state
applyGravity(deltaTime) {
  this.velocity += GAME_CONFIG.PHYSICS.GRAVITY * deltaTime;
  this.velocity = Math.min(this.velocity, GAME_CONFIG.PHYSICS.TERMINAL_VELOCITY);
}
```

**Invariant:** After gravity, velocity never exceeds `TERMINAL_VELOCITY` (500 px/s).

### Jump Impulse

```javascript
// Triggered on Space/Click during Playing state
jump() {
  this.velocity = GAME_CONFIG.PHYSICS.JUMP_VELOCITY; // -300, overrides current
}
```

**Invariant:** Jump always sets velocity to exactly -300 px/s regardless of current velocity. No additive impulse.

### Position Update

```javascript
// Apply after gravity and jump in the same frame
updatePosition(deltaTime) {
  // Clamp velocity to bounds
  this.velocity = Math.max(this.velocity, GAME_CONFIG.PHYSICS.MAX_UP_VELOCITY);
  this.velocity = Math.min(this.velocity, GAME_CONFIG.PHYSICS.TERMINAL_VELOCITY);
  
  // Update position
  this.y += this.velocity * deltaTime;
}
```

**Invariant:** Velocity is always in `[-300, 500]` after any update.

### Frame Update Order

Within a single frame, physics must execute in this exact order:

```
1. applyGravity(dt)     — increase velocity downward
2. jump() [if input]    — override velocity to -300
3. clampVelocity()      — enforce [-300, 500] bounds
4. updatePosition(dt)   — move player by velocity * dt
5. checkCollisions()    — detect hits at new position
```

### Linear Interpolation (Visual Smoothing)

```javascript
// Smooth visual position between physics frames
function lerp(previous, current, alpha) {
  return previous + (current - previous) * alpha;
}

// Usage in render:
const renderY = lerp(this.previousY, this.y, interpolationAlpha);
```

**Invariant:** `lerp(a, b, alpha)` result is always between `min(a, b)` and `max(a, b)` for alpha in [0, 1].

### Obstacle Movement

```javascript
// All obstacles move left at the current difficulty speed
updateObstacles(deltaTime, speed) {
  for (const pipe of this.activePipes) {
    pipe.x -= speed * deltaTime;
  }
}
```

### Difficulty Scaling Formulas

```javascript
// Speed increases by 5% every 5 points, capped at 300 px/s
getSpeed(score) {
  return Math.min(
    GAME_CONFIG.OBSTACLES.BASE_SPEED * (1 + Math.floor(score / 5) * 0.05),
    GAME_CONFIG.OBSTACLES.MAX_SPEED
  );
}

// Gap shrinks by 5px every 10 points, minimum 100px
getGap(score) {
  return Math.max(
    GAME_CONFIG.OBSTACLES.BASE_GAP - Math.floor(score / 10) * 5,
    GAME_CONFIG.OBSTACLES.MIN_GAP
  );
}

// Spacing shrinks by 10px every 10 points, minimum 180px
getSpacing(score) {
  return Math.max(
    GAME_CONFIG.OBSTACLES.BASE_SPACING - Math.floor(score / 10) * 10,
    GAME_CONFIG.OBSTACLES.MIN_SPACING
  );
}
```

---

## Collision Detection Patterns

### Player Hitbox (Circle)

```javascript
getCollisionCircle() {
  return {
    cx: this.x + this.width / 2,
    cy: this.y + this.height / 2,
    radius: Math.min(this.width, this.height) * GAME_CONFIG.PLAYER.HITBOX_FACTOR
  };
}
```

- Sprite: 32×32 px
- Hitbox radius: 12 px (smaller than visual for "forgiveness")
- Center: sprite center (16, 16) offset from position

### Obstacle Hitbox (Rectangle)

Each obstacle pair produces two rectangles:

```javascript
// Top obstacle: from y=0 down to gap start
topRect = { x: pipe.x, y: 0, width: 60, height: gapCenterY - gapSize / 2 };

// Bottom obstacle: from gap end down to canvas bottom
bottomRect = { x: pipe.x, y: gapCenterY + gapSize / 2, width: 60, height: canvasHeight - (gapCenterY + gapSize / 2) };
```

### Circle-Rectangle Collision (Primary Algorithm)

```javascript
function circleRectCollision(cx, cy, radius, rx, ry, rw, rh) {
  // Find nearest point on rectangle to circle center
  const nearestX = Math.max(rx, Math.min(cx, rx + rw));
  const nearestY = Math.max(ry, Math.min(cy, ry + rh));

  // Squared distance (avoid sqrt for performance)
  const dx = cx - nearestX;
  const dy = cy - nearestY;

  return (dx * dx + dy * dy) <= (radius * radius);
}
```

**Complexity:** O(1) per check. No square root needed.

### Boundary Collision

```javascript
function checkBoundaryCollision(cy, radius, canvasHeight) {
  const hitCeiling = (cy - radius) <= 0;
  const hitGround = (cy + radius) >= canvasHeight;
  return hitCeiling || hitGround;
}
```

### Broad Phase: X-Proximity Filter

Only check obstacles near the player's horizontal position:

```javascript
function getNearbyCandidates(pipes, playerCx, radius, pipeWidth) {
  const candidates = [];
  for (const pipe of pipes) {
    if (pipe.x + pipeWidth >= playerCx - radius &&
        pipe.x <= playerCx + radius) {
      candidates.push(pipe);
    }
  }
  return candidates;
}
```

Reduces checks from N obstacles to typically 0–2 per frame.

### Full Collision Pipeline

Execute in this order (cheapest first):

```javascript
checkAllCollisions() {
  const { cx, cy, radius } = this.player.getCollisionCircle();

  // 1. Boundary (O(1), two comparisons)
  if (checkBoundaryCollision(cy, radius, this.canvasHeight)) {
    return true;
  }

  // 2. Broad phase: filter by X proximity
  const candidates = getNearbyCandidates(this.pipes, cx, radius, 60);

  // 3. Narrow phase: circle-rect on each candidate's top and bottom rects
  for (const pipe of candidates) {
    if (circleRectCollision(cx, cy, radius, pipe.topRect.x, pipe.topRect.y, pipe.topRect.width, pipe.topRect.height)) {
      return true;
    }
    if (circleRectCollision(cx, cy, radius, pipe.bottomRect.x, pipe.bottomRect.y, pipe.bottomRect.width, pipe.bottomRect.height)) {
      return true;
    }
  }

  return false;
}
```

### Collision Rules

| Rule | Rationale |
|------|-----------|
| Check boundary before obstacles | Cheapest check first, early exit |
| Use squared distance | Avoids `Math.sqrt()` (~4x faster) |
| Broad phase X-filter | Eliminates most obstacles immediately |
| Hitbox smaller than sprite | Gives player "forgiveness" on near-misses |
| Check after position update | Ensures collision at actual new position |
| Only check during Playing state | No collision checks in Paused/Game_Over/Inicio |
| Early return on first hit | Skip remaining checks once collision detected |

### Score Detection

```javascript
// Player scores when their trailing edge passes the obstacle's trailing edge
checkScore(playerX, playerWidth) {
  for (const pipe of this.activePipes) {
    if (!pipe.scored && pipe.x + GAME_CONFIG.OBSTACLES.WIDTH < playerX) {
      pipe.scored = true;
      return true;
    }
  }
  return false;
}
```

**Invariant:** Each obstacle pair can only be scored once (`pipe.scored` flag).
