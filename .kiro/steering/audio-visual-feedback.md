---
inclusion: auto
---

# Audio-Visual Feedback Standards

## Sound Effect Integration

### Web Audio API Architecture

```javascript
class AudioSystem {
  constructor() {
    this._ctx = null;        // AudioContext (created lazily)
    this._buffers = {};      // decoded AudioBuffers keyed by name
    this._gainNodes = {};    // per-channel GainNode for volume control
    this._unlocked = false;
  }

  async init() {
    this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    this._masterGain = this._ctx.createGain();
    this._masterGain.connect(this._ctx.destination);

    // Create per-channel gain nodes
    this._gainNodes.jump = this._createGain(0.4);
    this._gainNodes.score = this._createGain(0.5);
    this._gainNodes.collision = this._createGain(0.6);
  }

  _createGain(volume) {
    const gain = this._ctx.createGain();
    gain.gain.value = volume;
    gain.connect(this._masterGain);
    return gain;
  }
}
```

### Sound Playback Pattern

```javascript
play(bufferName, channelName) {
  if (!this._unlocked || !this._buffers[bufferName]) return;

  try {
    const source = this._ctx.createBufferSource();
    source.buffer = this._buffers[bufferName];
    source.connect(this._gainNodes[channelName]);
    source.start(0);
  } catch (e) {
    // Graceful failure — game continues without sound
    console.warn('Audio playback failed:', e.message);
  }
}
```

### Autoplay Policy Unlock

```javascript
unlock() {
  if (this._unlocked) return;
  const resume = () => {
    if (this._ctx.state === 'suspended') {
      this._ctx.resume();
    }
    this._unlocked = true;
    document.removeEventListener('click', resume);
    document.removeEventListener('keydown', resume);
  };
  document.addEventListener('click', resume, { once: true });
  document.addEventListener('keydown', resume, { once: true });
}
```

### Sound Trigger Points

| Event | Sound | Channel | Behavior |
|-------|-------|---------|----------|
| Player jumps | jump.wav | jump (0.4) | Allow overlapping (rapid taps) |
| Score increments | score chime | score (0.5) | Cancel previous, play fresh |
| Collision detected | game_over.wav | collision (0.6) | Play once, ignore repeats |
| Pause entered | — | — | Mute master gain |
| Resume | — | — | Restore master gain |

### State-Based Audio Control

```javascript
setMuted(muted) {
  this._masterGain.gain.value = muted ? 0 : 1;
}

// In GameEngine state transitions:
onPause() { this.audio.setMuted(true); }
onResume() { this.audio.setMuted(false); }
onGameOver() { this.audio.play('gameOver', 'collision'); }
```

---

## Screen Shake Mechanics

### Shake System

Triggered on collision for visceral impact feedback:

```javascript
class ScreenShake {
  constructor() {
    this._intensity = 0;
    this._duration = 0;
    this._elapsed = 0;
    this._offsetX = 0;
    this._offsetY = 0;
  }

  trigger(intensity = 5, duration = 0.3) {
    this._intensity = intensity;
    this._duration = duration;
    this._elapsed = 0;
  }

  update(deltaTime) {
    if (this._elapsed >= this._duration) {
      this._offsetX = 0;
      this._offsetY = 0;
      return;
    }

    this._elapsed += deltaTime;
    const decay = 1 - (this._elapsed / this._duration); // linear decay
    const magnitude = this._intensity * decay;

    this._offsetX = (Math.random() * 2 - 1) * magnitude;
    this._offsetY = (Math.random() * 2 - 1) * magnitude;
  }

  get offsetX() { return Math.round(this._offsetX); }
  get offsetY() { return Math.round(this._offsetY); }
  get isShaking() { return this._elapsed < this._duration; }
}
```

### Applying Shake to Render

```javascript
render() {
  const shakeX = this.screenShake.offsetX;
  const shakeY = this.screenShake.offsetY;

  // Apply offset to entire canvas
  ctx.translate(shakeX, shakeY);

  // Render all layers normally
  this.background.render(ctx);
  this.pipeSystem.render(ctx);
  this.cloudSystem.render(ctx);
  this.player.render(ctx);

  // Reset transform before HUD (HUD should not shake)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  this.hud.render(ctx);
}
```

### Shake Parameters

| Event | Intensity (px) | Duration (s) | Notes |
|-------|---------------|--------------|-------|
| Collision | 5 | 0.3 | Linear decay, random direction |
| Near miss (optional) | 2 | 0.1 | Subtle feedback for close calls |

### Rules

1. **Integer offsets only** — `Math.round()` to avoid sub-pixel blur
2. **Linear decay** — shake diminishes smoothly to zero
3. **HUD excluded** — never shake the score/overlay (disorienting)
4. **Cap intensity** — max 8px to prevent disorientation
5. **Skip if FPS < 45** — disable shake during performance degradation

---

## UI Animation Patterns

### Easing Functions

```javascript
const Easing = {
  // Smooth deceleration (most UI animations)
  easeOut(t) { return 1 - Math.pow(1 - t, 3); },

  // Smooth acceleration (elements leaving)
  easeIn(t) { return t * t * t; },

  // Smooth both ends (general purpose)
  easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },

  // Bounce at end (score pop)
  bounce(t) {
    if (t < 0.5) return 4 * t * t;
    return 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
};
```

### Tween Class

```javascript
class Tween {
  constructor(from, to, duration, easingFn = Easing.easeOut) {
    this._from = from;
    this._to = to;
    this._duration = duration;
    this._easing = easingFn;
    this._elapsed = 0;
    this._done = false;
  }

  update(deltaTime) {
    if (this._done) return;
    this._elapsed += deltaTime;
    if (this._elapsed >= this._duration) {
      this._elapsed = this._duration;
      this._done = true;
    }
  }

  get value() {
    const t = this._easing(this._elapsed / this._duration);
    return this._from + (this._to - this._from) * t;
  }

  get done() { return this._done; }

  reset() {
    this._elapsed = 0;
    this._done = false;
  }
}
```

### UI Animation Catalog

| Animation | Trigger | Properties | Duration | Easing |
|-----------|---------|-----------|----------|--------|
| Score pop | Score increments | scale 1.0 → 1.3 → 1.0 | 150ms | bounce |
| Title fade-in | Game loads | opacity 0 → 1 | 500ms | easeOut |
| Game Over slide | Collision | y: -50 → center | 300ms | easeOut |
| Overlay fade | Pause/Game Over | opacity 0 → 0.5/0.6 | 200ms | easeIn |
| Restart text appear | After 1s delay | opacity 0 → 1 | 300ms | easeOut |
| New record pulse | High score beaten | scale 1.0 → 1.1 → 1.0 (loop) | 800ms | easeInOut |

### Score Pop Implementation

```javascript
class ScorePop {
  constructor() {
    this._tween = new Tween(1.3, 1.0, 0.15, Easing.bounce);
    this._scale = 1.0;
  }

  trigger() {
    this._tween.reset();
    this._scale = 1.3;
  }

  update(deltaTime) {
    this._tween.update(deltaTime);
    this._scale = this._tween.value;
  }

  renderScore(ctx, text, x, y, baseSize) {
    const size = Math.round(baseSize * this._scale);
    ctx.font = `${size}px monospace`;
    ctx.fillText(text, x, y);
  }
}
```

### Game Over Screen Entrance

```javascript
class GameOverScreen {
  constructor() {
    this._slideY = new Tween(-50, 0, 0.3, Easing.easeOut);
    this._fadeOverlay = new Tween(0, 0.6, 0.2, Easing.easeIn);
    this._restartFade = new Tween(0, 1, 0.3, Easing.easeOut);
    this._restartDelay = 1.0; // seconds before showing restart text
    this._elapsed = 0;
  }

  activate() {
    this._slideY.reset();
    this._fadeOverlay.reset();
    this._restartFade.reset();
    this._elapsed = 0;
  }

  update(deltaTime) {
    this._elapsed += deltaTime;
    this._slideY.update(deltaTime);
    this._fadeOverlay.update(deltaTime);
    if (this._elapsed >= this._restartDelay) {
      this._restartFade.update(deltaTime);
    }
  }
}
```

### Performance Rules for UI Animations

1. **Pre-compute text** — never concatenate strings in render loop
2. **Integer font sizes** — `Math.round()` scaled sizes to avoid blurry text
3. **Limit concurrent tweens** — max 3-4 active at once
4. **Skip animations if FPS < 45** — snap to final values immediately
5. **No allocations** — reuse Tween instances with `reset()`, don't create new ones
