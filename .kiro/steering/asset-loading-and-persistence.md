---
inclusion: auto
---

# Asset Loading & Data Persistence

## Asset Loading Pattern

### Overview

All game assets (sprite image + audio files) must be loaded before showing the start screen. Use `Promise.race` with a 10-second timeout per asset. If any asset fails, show an error message on the canvas — never start the game with missing assets.

### Loading with Timeout

```javascript
function loadWithTimeout(promise, timeoutMs = 10000, assetName = 'asset') {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Timeout loading ${assetName} (${timeoutMs}ms)`)), timeoutMs);
  });
  return Promise.race([promise, timeout]);
}
```

### Image Loading

```javascript
function loadImage(path) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${path}`));
    img.src = path;
  });
}
```

### Audio Buffer Loading

```javascript
async function loadAudioBuffer(audioContext, path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`HTTP ${response.status} loading ${path}`);
  const arrayBuffer = await response.arrayBuffer();
  return audioContext.decodeAudioData(arrayBuffer);
}
```

### Parallel Loading with Error Aggregation

```javascript
async function loadAllAssets(audioContext) {
  const results = await Promise.allSettled([
    loadWithTimeout(loadImage(GAME_CONFIG.SPRITE_FILE), GAME_CONFIG.ASSET_TIMEOUT_MS, 'ghosty.png'),
    loadWithTimeout(loadAudioBuffer(audioContext, 'assets/jump.wav'), GAME_CONFIG.ASSET_TIMEOUT_MS, 'jump.wav'),
    loadWithTimeout(loadAudioBuffer(audioContext, 'assets/game_over.wav'), GAME_CONFIG.ASSET_TIMEOUT_MS, 'game_over.wav'),
  ]);

  const errors = [];
  const assets = {};

  if (results[0].status === 'fulfilled') assets.sprite = results[0].value;
  else errors.push(results[0].reason.message);

  if (results[1].status === 'fulfilled') assets.jumpSound = results[1].value;
  else errors.push(results[1].reason.message);

  if (results[2].status === 'fulfilled') assets.gameOverSound = results[2].value;
  else errors.push(results[2].reason.message);

  if (errors.length > 0) {
    throw new Error(`Asset loading failed:\n${errors.join('\n')}`);
  }

  return assets;
}
```

### Error Display on Canvas

```javascript
function renderLoadError(ctx, canvas, errorMessage) {
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = '20px monospace';
  ctx.fillStyle = '#FF4444';
  ctx.textAlign = 'center';
  ctx.fillText('Error Loading Resources', canvas.width / 2, canvas.height / 2 - 30);

  ctx.font = '14px monospace';
  ctx.fillStyle = '#CCCCCC';
  const lines = errorMessage.split('\n');
  lines.forEach((line, i) => {
    ctx.fillText(line, canvas.width / 2, canvas.height / 2 + i * 20);
  });
}
```

### Loading Sequence

```
1. Create AudioContext (suspended state)
2. Start parallel loading of all assets (image + audio buffers)
3. Wait for all with 10s timeout each
4. IF any fails → render error on canvas, stop
5. IF all succeed → store assets, show start screen
```

### Rules

| Rule | Rationale |
|------|-----------|
| Load all assets before showing start screen | Prevents missing sprite/sound during gameplay |
| Use `Promise.allSettled` not `Promise.all` | Collects all errors instead of failing on first |
| 10-second timeout per asset | Prevents infinite hang on slow/broken connections |
| Show error on canvas, not alert/console | User-visible feedback without dev tools |
| Never start game with missing assets | All assets are required per requirements |
| Load audio buffers even if AudioContext is suspended | Buffers are ready when context is unlocked |

---

## localStorage Persistence (High Score)

### Safe Read Pattern

```javascript
function loadHighScore() {
  try {
    const raw = localStorage.getItem(GAME_CONFIG.STORAGE_KEY);
    if (raw === null) return 0;

    const parsed = parseInt(raw, 10);

    // Validate: must be integer in [0, 9999]
    if (Number.isNaN(parsed) || !Number.isFinite(parsed)) return 0;
    if (parsed < 0 || parsed > GAME_CONFIG.MAX_SCORE) return 0;
    if (parsed !== Math.floor(parsed)) return 0;

    return parsed;
  } catch (e) {
    // localStorage unavailable (private browsing, security policy)
    console.warn('localStorage read failed:', e.message);
    return 0;
  }
}
```

### Safe Write Pattern

```javascript
function saveHighScore(score) {
  try {
    localStorage.setItem(GAME_CONFIG.STORAGE_KEY, String(score));
  } catch (e) {
    // Quota exceeded or localStorage unavailable — silently ignore
    console.warn('localStorage write failed:', e.message);
  }
}
```

### ScoreSystem Integration

```javascript
class ScoreSystem {
  constructor() {
    this._score = 0;
    this._highScore = loadHighScore();
    this._scoreText = 'Score: 0';
    this._highText = `High: ${this._highScore}`;
  }

  increment() {
    if (this._score >= GAME_CONFIG.MAX_SCORE) return;
    this._score++;
    this._scoreText = `Score: ${this._score}`;

    if (this._score > this._highScore) {
      this._highScore = this._score;
      this._highText = `High: ${this._highScore}`;
      saveHighScore(this._highScore);
    }
  }

  reset() {
    this._score = 0;
    this._scoreText = 'Score: 0';
    // High score is preserved across resets
  }

  get score() { return this._score; }
  get highScore() { return this._highScore; }
  get isNewRecord() { return this._score > 0 && this._score >= this._highScore; }
  get scoreText() { return this._scoreText; }
  get highText() { return this._highText; }
}
```

### Persistence Rules

| Rule | Rationale |
|------|-----------|
| Wrap all localStorage calls in try/catch | Private browsing and security policies can throw |
| Validate on read: integer, 0–9999 | Protects against corrupted or tampered data |
| Default to 0 on any invalid state | Game always has a valid high score |
| Save immediately when high score is beaten | Don't lose progress if tab is closed |
| Never save score of 0 | Avoid overwriting valid high score on reset |
| Pre-compute display strings on change | Avoid string concatenation in render loop |
| High score survives reset() | Only score resets to 0, high score persists |

---

## Error Handling Philosophy

### General Principles

1. **Never throw to the user** — all errors are caught and handled gracefully
2. **Console.warn for debugging** — log issues for developers without blocking gameplay
3. **Graceful degradation** — if audio fails mid-game, continue without sound
4. **Fail hard only on init** — missing assets at startup = show error and stop
5. **Fail soft during gameplay** — audio glitch, localStorage full = continue playing

### Error Categories

| Category | Behavior | Example |
|----------|----------|---------|
| Asset loading failure | Show error on canvas, don't start | Image 404, timeout |
| Audio playback failure | Catch silently, continue | Buffer decode error |
| localStorage failure | Use defaults, continue | Private browsing mode |
| Physics anomaly | Clamp values, continue | NaN velocity after tab switch |

### Try/Catch Placement

```javascript
// Audio: wrap every play() call
play(bufferName, channelName) {
  try {
    const source = this._ctx.createBufferSource();
    source.buffer = this._buffers[bufferName];
    source.connect(this._gainNodes[channelName]);
    source.start(0);
  } catch (e) {
    console.warn('Audio play failed:', e.message);
  }
}

// localStorage: wrap every access
function loadHighScore() {
  try { /* ... */ } catch (e) { return 0; }
}

// Never wrap the game loop itself — let it run uninterrupted
```
