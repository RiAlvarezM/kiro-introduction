---
inclusion: auto
---

# Visual Design Standards

## Background: Canal de Panamá Parallax Scene

### Layer Structure (back to front)

The background is drawn programmatically using Canvas 2D — no image assets. Each layer scrolls at a different speed relative to the obstacle speed for depth.

| Layer | Content | Color | Parallax Speed |
|-------|---------|-------|----------------|
| 0 | Sky (solid fill) | #87CEEB | Static (no scroll) |
| 1 | Distant hills (cerros) | #006400 | 15% of pipe speed |
| 2 | Tropical vegetation | #228B22 | 25% of pipe speed |
| 3 | Canal water | #2E8B8B | 30% of pipe speed |

### Drawing Hills (Cerros)

Use sine waves or quadratic curves for organic hill shapes:

```javascript
renderHills(ctx, scrollX, canvasWidth, canvasHeight) {
  ctx.fillStyle = GAME_CONFIG.HILLS_COLOR; // #006400
  ctx.beginPath();
  ctx.moveTo(0, canvasHeight);

  const hillWidth = 200;
  const hillHeight = 120;
  const baseY = canvasHeight * 0.55;
  const offset = scrollX * 0.15; // 15% parallax

  for (let x = -hillWidth; x < canvasWidth + hillWidth; x += hillWidth / 2) {
    const adjustedX = x + (offset % hillWidth);
    const peakY = baseY - hillHeight * (0.5 + 0.5 * Math.sin(adjustedX * 0.01));
    ctx.lineTo(adjustedX, peakY);
  }

  ctx.lineTo(canvasWidth, canvasHeight);
  ctx.closePath();
  ctx.fill();
}
```

### Drawing Vegetation

Smaller, more varied bumps in front of hills:

```javascript
renderVegetation(ctx, scrollX, canvasWidth, canvasHeight) {
  ctx.fillStyle = GAME_CONFIG.VEGETATION_COLOR; // #228B22
  ctx.beginPath();
  ctx.moveTo(0, canvasHeight);

  const baseY = canvasHeight * 0.65;
  const offset = scrollX * 0.25; // 25% parallax

  for (let x = 0; x <= canvasWidth; x += 20) {
    const adjustedX = x + offset;
    const y = baseY - 15 * Math.sin(adjustedX * 0.03) - 8 * Math.sin(adjustedX * 0.07);
    ctx.lineTo(x, y);
  }

  ctx.lineTo(canvasWidth, canvasHeight);
  ctx.closePath();
  ctx.fill();
}
```

### Drawing Canal Water

Flat colored band at the bottom with subtle wave effect:

```javascript
renderWater(ctx, scrollX, canvasWidth, canvasHeight) {
  const waterTop = canvasHeight * 0.75;
  const offset = scrollX * 0.3; // 30% parallax

  // Main water body
  ctx.fillStyle = GAME_CONFIG.WATER_COLOR; // #2E8B8B
  ctx.fillRect(0, waterTop, canvasWidth, canvasHeight - waterTop);

  // Subtle wave highlights
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    const waveY = waterTop + 10 + i * 15;
    for (let x = 0; x <= canvasWidth; x += 5) {
      const y = waveY + 3 * Math.sin((x + offset + i * 50) * 0.02);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}
```

### Seamless Wrapping

The background must tile seamlessly. Use modulo on the scroll offset:

```javascript
update(deltaTime, pipeSpeed) {
  this._scrollX += pipeSpeed * GAME_CONFIG.BG_PARALLAX_FACTOR * deltaTime;
  // Wrap to prevent floating point overflow on long sessions
  if (this._scrollX > this._tileWidth) {
    this._scrollX -= this._tileWidth;
  }
}
```

**Key:** The sine-based procedural shapes are inherently tileable because `sin()` is periodic. Choose frequencies that produce full cycles within the tile width.

### Background Rules

| Rule | Rationale |
|------|-----------|
| All layers drawn programmatically | No image assets needed, runs without server |
| Each layer has its own parallax speed | Creates depth perception |
| Use periodic functions (sin) for shapes | Ensures seamless wrapping |
| Wrap scrollX with modulo | Prevents float overflow on long sessions |
| Sky is static (no scroll) | Anchors the scene, reduces draw calls |
| Draw hills before vegetation before water | Correct occlusion order |
| Keep shapes simple (no bezier complexity) | Performance: redrawn every frame |

---

## Sprite Rendering Patterns

### Image Loading and Caching

Load sprites once during init, cache as `HTMLImageElement`:

```javascript
async loadSprite(path) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${path}`));
    img.src = path;
  });
}
```

### Basic Sprite Drawing

```javascript
// Draw sprite at position (no transform)
ctx.drawImage(this.sprite, this.x, this.y, this.width, this.height);
```

### Rotated Sprite Drawing

For Ghosty's velocity-based tilt:

```javascript
renderRotated(ctx, sprite, x, y, width, height, angle) {
  const cx = x + width / 2;
  const cy = y + height / 2;
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.drawImage(sprite, -width / 2, -height / 2, width, height);
  ctx.setTransform(1, 0, 0, 1, 0, 0); // reset — faster than save/restore
}
```

### Rotation Formula (Ghosty)

```javascript
// Tilt based on velocity: nose up when rising, nose down when falling
getRotation(velocity) {
  if (velocity < 0) return -15 * (Math.PI / 180);  // rising: -15°
  return Math.min(velocity / 500, 1) * 45 * (Math.PI / 180);  // falling: up to +45°
}
```

### Opacity-Based Drawing

For clouds, death animation, overlays:

```javascript
renderWithOpacity(ctx, drawFn, opacity) {
  ctx.globalAlpha = opacity;
  drawFn(ctx);
  ctx.globalAlpha = 1.0; // always reset
}
```

### Container Ship Obstacle Rendering

```javascript
renderContainerShip(ctx, x, y, width, height) {
  const containerH = 15;
  const hullH = 10;
  const colors = GAME_CONFIG.THEME.CONTAINER_COLORS;

  // Stacked containers
  let cy = y;
  let colorIdx = 0;
  while (cy + containerH <= y + height - hullH) {
    ctx.fillStyle = colors[colorIdx % colors.length];
    ctx.fillRect(x, cy, width, containerH);
    ctx.strokeStyle = GAME_CONFIG.THEME.CONTAINER_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, cy, width, containerH);
    cy += containerH;
    colorIdx++;
  }

  // Hull at base
  ctx.fillStyle = GAME_CONFIG.THEME.HULL_COLOR;
  ctx.fillRect(x, y + height - hullH, width, hullH);
}
```

---

## Animation Systems

### Time-Based Frame Animation

Drive animations from elapsed time, not frame count:

```javascript
class SpriteAnimator {
  constructor(frameCount, frameDurationMs, loop = true) {
    this._frameCount = frameCount;
    this._frameDuration = frameDurationMs / 1000; // store in seconds
    this._elapsed = 0;
    this._currentFrame = 0;
    this._playing = false;
    this._loop = loop;
  }

  play() {
    this._playing = true;
    this._elapsed = 0;
    this._currentFrame = 0;
  }

  stop() {
    this._playing = false;
  }

  update(deltaTime) {
    if (!this._playing) return;
    this._elapsed += deltaTime;
    if (this._elapsed >= this._frameDuration) {
      this._elapsed -= this._frameDuration;
      this._currentFrame++;
      if (this._currentFrame >= this._frameCount) {
        if (this._loop) {
          this._currentFrame = 0;
        } else {
          this._currentFrame = this._frameCount - 1;
          this._playing = false;
        }
      }
    }
  }

  get frame() { return this._currentFrame; }
  get isPlaying() { return this._playing; }
}
```

### Ghosty Animation States

| State | Frames | Duration | Loop | Trigger |
|-------|--------|----------|------|---------|
| Idle | 3 | 400ms each | Yes | Inicio, Paused |
| Flap | 4 | 100ms each | No | jump() |
| Death | 4 | 125ms each | No | Game_Over |

```javascript
// Animation controller per state
this.animations = {
  idle: new SpriteAnimator(3, 400, true),
  flap: new SpriteAnimator(4, 100, false),
  death: new SpriteAnimator(4, 125, false)
};
```

### Programmatic Animation Effects

Since Ghosty uses a single sprite (no sprite sheet), animations are achieved through canvas transforms:

```javascript
// Idle: gentle float (sine wave on Y)
getIdleOffset(elapsed) {
  return Math.sin(elapsed * 2 * Math.PI / 1.2) * 2; // ±2px over 1.2s
}

// Flap: scale pulse
getFlapScale(frame) {
  const scales = [0.9, 1.1, 1.05, 1.0];
  return scales[frame] || 1.0;
}

// Death: rotation + fade
getDeathTransform(frame) {
  const rotations = [0, 15, 30, 45]; // degrees
  const opacities = [1.0, 0.9, 0.7, 0.5];
  return {
    rotation: rotations[frame] * (Math.PI / 180),
    opacity: opacities[frame]
  };
}
```

### Blinking Text Animation

For "Press Space to start" and restart instructions:

```javascript
class BlinkAnimation {
  constructor(intervalMs = 800) {
    this._interval = intervalMs / 1000;
    this._elapsed = 0;
    this._visible = true;
  }

  update(deltaTime) {
    this._elapsed += deltaTime;
    if (this._elapsed >= this._interval) {
      this._elapsed -= this._interval;
      this._visible = !this._visible;
    }
  }

  get visible() { return this._visible; }
}
```

### Score Flash Animation

```javascript
class ScoreFlash {
  constructor() {
    this._scale = 1.0;
    this._flashing = false;
    this._elapsed = 0;
  }

  trigger() {
    this._scale = 1.3;
    this._flashing = true;
    this._elapsed = 0;
  }

  update(deltaTime) {
    if (!this._flashing) return;
    this._elapsed += deltaTime;
    // Ease back to 1.0 over 150ms
    const t = Math.min(this._elapsed / 0.15, 1.0);
    this._scale = 1.3 - 0.3 * t;
    if (t >= 1.0) {
      this._scale = 1.0;
      this._flashing = false;
    }
  }

  get scale() { return this._scale; }
}
```

---

## Particle Effect Guidelines

### Design Principles

- Particles are **optional visual polish** — never block gameplay
- Use object pooling for particles (same pattern as obstacles)
- Cap particle count to prevent performance degradation
- All particles are purely decorative (no gameplay impact)

### Particle Pool

```javascript
class ParticlePool {
  constructor(maxParticles = 20) {
    this._pool = [];
    this._active = [];
    this._max = maxParticles;

    // Pre-warm
    for (let i = 0; i < maxParticles; i++) {
      this._pool.push(this._createParticle());
    }
  }

  _createParticle() {
    return { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, size: 0, opacity: 1, color: '' };
  }

  emit(x, y, config) {
    if (this._active.length >= this._max) return; // cap reached
    const p = this._pool.pop() || this._createParticle();
    Object.assign(p, { x, y, ...config, life: 0 });
    this._active.push(p);
  }

  update(deltaTime) {
    for (let i = this._active.length - 1; i >= 0; i--) {
      const p = this._active[i];
      p.life += deltaTime;
      if (p.life >= p.maxLife) {
        this._active.splice(i, 1);
        this._pool.push(p);
        continue;
      }
      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;
      p.opacity = 1 - (p.life / p.maxLife);
    }
  }

  render(ctx) {
    for (const p of this._active) {
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
  }
}
```

### Suggested Particle Effects

| Effect | Trigger | Particles | Lifetime | Color |
|--------|---------|-----------|----------|-------|
| Jump puff | Player jumps | 3–5 | 300ms | White, 50% opacity |
| Score sparkle | Score increments | 4–6 | 400ms | Gold (#FFD700) |
| Collision burst | Game Over | 8–10 | 500ms | Red (#FF4444) |
| Water splash | Background decoration | 2–3 | 600ms | Teal (#2E8B8B) |

### Particle Configuration Examples

```javascript
// Jump puff
particlePool.emit(player.x, player.y + player.height, {
  vx: (Math.random() - 0.5) * 40,
  vy: Math.random() * -30 - 10,
  maxLife: 0.3,
  size: 3,
  color: 'rgba(255, 255, 255, 0.5)'
});

// Score sparkle
for (let i = 0; i < 5; i++) {
  particlePool.emit(scoreX, scoreY, {
    vx: (Math.random() - 0.5) * 80,
    vy: (Math.random() - 0.5) * 80,
    maxLife: 0.4,
    size: 2,
    color: '#FFD700'
  });
}
```

### Performance Rules for Particles

1. **Max 20 active particles** — hard cap to prevent frame drops
2. **Pool all particles** — zero allocations during gameplay
3. **Skip particles if FPS < 45** — graceful degradation
4. **No physics interaction** — particles are visual only, no collision checks
5. **Render after main elements, before HUD** — layer order: obstacles → clouds → Ghosty → particles → HUD
