---
inclusion: auto
---

# Canvas API Patterns & Collision Detection

## Canvas API Patterns

### Canvas Setup

```javascript
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false }); // opaque background = faster compositing

// Set logical resolution independent of display size
canvas.width = 800;
canvas.height = 600;
```

- Use `{ alpha: false }` when the canvas always has a fully painted background
- Set `imageSmoothingEnabled = false` for pixel-art style rendering

### Drawing Primitives

```javascript
// Filled rectangle (pipes, HUD bar)
ctx.fillStyle = '#228B22';
ctx.fillRect(x, y, width, height);

// Stroked rectangle (pipe borders)
ctx.strokeStyle = '#145214';
ctx.lineWidth = 2;
ctx.strokeRect(x, y, width, height);

// Circle (debug hitbox visualization)
ctx.beginPath();
ctx.arc(cx, cy, radius, 0, Math.PI * 2);
ctx.closePath();
ctx.fill();
```

### Transform Management

Avoid `save()`/`restore()` in hot paths. Use manual transform reset:

```javascript
// Rotate sprite around its center
ctx.translate(x + width / 2, y + height / 2);
ctx.rotate(angle);
ctx.drawImage(sprite, -width / 2, -height / 2, width, height);
ctx.setTransform(1, 0, 0, 1, 0, 0); // reset to identity — faster than restore()
```

### Offscreen Canvas Pre-Rendering

Pre-render static or repeating elements once, then stamp them:

```javascript
// Create offscreen canvas for pipe segment
const pipeCanvas = document.createElement('canvas');
pipeCanvas.width = 60;
pipeCanvas.height = 600;
const pipeCtx = pipeCanvas.getContext('2d');

// Draw pipe once
pipeCtx.fillStyle = '#228B22';
pipeCtx.fillRect(0, 0, 60, 600);
pipeCtx.strokeStyle = '#145214';
pipeCtx.lineWidth = 2;
pipeCtx.strokeRect(0, 0, 60, 600);

// In game loop — stamp pre-rendered image (fast)
ctx.drawImage(pipeCanvas, pipeX, pipeY);
```

### Batch Rendering

Group draws by shared state to minimize context switches:

```javascript
class BatchRenderer {
  renderPipes(ctx, pipes) {
    // Set style once for all pipes
    ctx.fillStyle = '#228B22';
    for (const pipe of pipes) {
      ctx.fillRect(pipe.x, pipe.y, pipe.width, pipe.height);
    }
    // Border pass
    ctx.strokeStyle = '#145214';
    ctx.lineWidth = 2;
    for (const pipe of pipes) {
      ctx.strokeRect(pipe.x, pipe.y, pipe.width, pipe.height);
    }
  }
}
```

### Text Rendering

Pre-compute text strings; avoid concatenation in render:

```javascript
// On score change (not every frame)
this._scoreText = `Score: ${this.score}`;
this._highText = `High: ${this.highScore}`;

// In render (every frame)
ctx.font = '14px monospace';
ctx.fillStyle = '#FFFFFF';
ctx.textAlign = 'left';
ctx.fillText(this._scoreText, 10, canvas.height - 14);
ctx.textAlign = 'right';
ctx.fillText(this._highText, canvas.width - 10, canvas.height - 14);
```

### Layer Ordering

Render back-to-front in a fixed order:

```javascript
render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  this.background.render(ctx);   // Layer 0-3: sky, hills, vegetation, canal water
  this.pipeSystem.render(ctx);   // Layer 4: container ships
  this.cloudSystem.render(ctx);  // Layer 5: semi-transparent clouds
  this.player.render(ctx);       // Layer 6: ghosty with rotation
  this.hud.render(ctx);          // Layer 7-8: score bar + state overlays
}
```

---

## Animation Frame Handling

### requestAnimationFrame Loop

```javascript
class GameEngine {
  constructor() {
    this._lastTime = 0;
    this._running = false;
    this._boundLoop = this._loop.bind(this); // bind once, reuse
  }

  start() {
    this._running = true;
    this._lastTime = performance.now();
    requestAnimationFrame(this._boundLoop);
  }

  stop() {
    this._running = false;
  }

  _loop(timestamp) {
    if (!this._running) return;

    const deltaTime = (timestamp - this._lastTime) / 1000;
    this._lastTime = timestamp;

    // Guard: skip degenerate frames
    if (deltaTime <= 0) {
      requestAnimationFrame(this._boundLoop);
      return;
    }

    // Guard: clamp large gaps (tab was inactive)
    const clampedDt = Math.min(deltaTime, 1 / 30);

    this.update(clampedDt);
    this.render();
    requestAnimationFrame(this._boundLoop);
  }
}
```

### Key Principles

1. **Bind once** — create `this._boundLoop` in constructor, not per frame
2. **Clamp deltaTime** — max 1/30s prevents physics explosions after tab switch
3. **Skip zero/negative dt** — guards against timestamp anomalies
4. **Use `performance.now()`** — higher precision than `Date.now()`
5. **Boolean gate** — `this._running` allows clean pause without canceling rAF

### Sprite Animation Timing

Drive animations from elapsed time, not frame count:

```javascript
class SpriteAnimator {
  constructor(frames, frameDuration) {
    this._frames = frames;
    this._frameDuration = frameDuration; // seconds per frame
    this._elapsed = 0;
    this._currentFrame = 0;
    this._loop = true;
  }

  update(deltaTime) {
    this._elapsed += deltaTime;
    if (this._elapsed >= this._frameDuration) {
      this._elapsed -= this._frameDuration;
      this._currentFrame++;
      if (this._currentFrame >= this._frames.length) {
        this._currentFrame = this._loop ? 0 : this._frames.length - 1;
      }
    }
  }

  get frame() {
    return this._frames[this._currentFrame];
  }

  reset() {
    this._elapsed = 0;
    this._currentFrame = 0;
  }
}
```

### Pause/Resume Handling

On pause, stop calling `update()` but keep rAF running for instant resume:

```javascript
_loop(timestamp) {
  if (!this._running) return;

  const deltaTime = (timestamp - this._lastTime) / 1000;
  this._lastTime = timestamp;

  if (this.state !== 'Paused') {
    this.update(Math.min(deltaTime, 1 / 30));
  }

  this.render(); // always render (shows pause overlay)
  requestAnimationFrame(this._boundLoop);
}
```

---

## Collision Detection Algorithms

### Circle-Rectangle Collision (Primary Algorithm)

Used for player (circle hitbox) vs. pipes (rectangles):

```javascript
function circleRectCollision(cx, cy, radius, rx, ry, rw, rh) {
  // Find the nearest point on the rectangle to the circle center
  const nearestX = Math.max(rx, Math.min(cx, rx + rw));
  const nearestY = Math.max(ry, Math.min(cy, ry + rh));

  // Calculate distance from circle center to nearest point
  const dx = cx - nearestX;
  const dy = cy - nearestY;

  // Collision if distance is less than or equal to radius
  return (dx * dx + dy * dy) <= (radius * radius);
}
```

**Complexity:** O(1) per check — no square root needed (compare squared distances).

### Boundary Collision

Used for ceiling and ground detection. Returns a simple boolean (matching the implementation in `game.js`):

```javascript
function checkBoundaryCollision(circle, canvasHeight) {
  return circle.cy - circle.radius <= 0 || circle.cy + circle.radius >= canvasHeight;
}
```

The function takes a circle object `{ cx, cy, radius }` and returns `true` if the player touches the ceiling (y=0) or the floor (y=canvasHeight).

### Broad Phase: Spatial Filtering

Before running expensive collision checks, filter candidates:

```javascript
function getPipesNearPlayer(pipes, playerX, playerRadius, pipeWidth) {
  const candidates = [];
  for (const pipe of pipes) {
    // Only check pipes that overlap player's X range
    if (pipe.x + pipeWidth >= playerX - playerRadius &&
        pipe.x <= playerX + playerRadius) {
      candidates.push(pipe);
    }
  }
  return candidates;
}
```

This reduces checks from all pipes to typically 0–2 pipes per frame.

### Full Collision Check Pipeline

```javascript
checkCollisions() {
  const circle = this.player.getCollisionCircle();

  // 1. Boundary check (O(1), always run)
  if (checkBoundaryCollision(circle, this.canvas.height)) {
    return true;
  }

  // 2. Broad phase: filter pipes near player X
  const candidates = getPipesNearPlayer(
    this.pipeSystem.activePipes, circle.cx, circle.radius, GAME_CONFIG.PIPE_WIDTH
  );

  // 3. Narrow phase: circle-rect on each candidate's top and bottom rects
  for (const pipe of candidates) {
    if (circleRectCollision(circle, pipe.topRect)) return true;
    if (circleRectCollision(circle, pipe.bottomRect)) return true;
  }

  return false;
}
```

### Hitbox Sizing Strategy

- **Visual sprite:** 32x32 px
- **Collision radius:** `min(width, height) * 0.4` = 12.8 px (use 12 px)
- **Why smaller?** Gives the player a "forgiveness zone" — near-misses feel fair

### Performance Notes

| Technique | Benefit |
|-----------|---------|
| Squared distance comparison | Avoids `Math.sqrt()` — ~4x faster |
| Broad phase X-filter | Reduces narrow-phase checks from N to 0–2 |
| Fixed hitbox radius | No per-frame recalculation |
| Early return on first collision | Skip remaining checks once hit detected |

### Debug Visualization

Toggle collision hitbox rendering during development:

```javascript
renderDebugHitbox(ctx, cx, cy, radius) {
  if (!GAME_CONFIG.DEBUG) return;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
```
