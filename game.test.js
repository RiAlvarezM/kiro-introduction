import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GAME_CONFIG, DifficultySystem, PipePool, PipeSystem, ScoreSystem, checkCollisions, Player } from './game.js';

// Mock DOM environment for InputHandler tests
function createMockCanvas() {
  const listeners = {};
  return {
    addEventListener: vi.fn((event, handler) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(handler);
    }),
    removeEventListener: vi.fn((event, handler) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(h => h !== handler);
      }
    }),
    _emit(event, data) {
      if (listeners[event]) {
        listeners[event].forEach(h => h(data));
      }
    }
  };
}

// We need to set up a minimal DOM before requiring game.js
const documentListeners = {};
const originalAddEventListener = global.document?.addEventListener;
const originalRemoveEventListener = global.document?.removeEventListener;

describe('InputHandler', () => {
  let InputHandler;
  let canvas;
  let docListeners;

  beforeEach(() => {
    // Set up document event listener mocks
    docListeners = {};
    global.document = global.document || {};
    global.document.addEventListener = vi.fn((event, handler) => {
      docListeners[event] = docListeners[event] || [];
      docListeners[event].push(handler);
    });
    global.document.removeEventListener = vi.fn((event, handler) => {
      if (docListeners[event]) {
        docListeners[event] = docListeners[event].filter(h => h !== handler);
      }
    });

    // Import the module
    const gameModule = require('./game.js');
    InputHandler = gameModule.InputHandler;

    canvas = createMockCanvas();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should initialize with null callbacks', () => {
    const handler = new InputHandler(canvas);
    expect(handler.onJump).toBeNull();
    expect(handler.onPause).toBeNull();
    expect(handler.onResume).toBeNull();
    expect(handler.onRestart).toBeNull();
    handler.unbind();
  });

  it('should bind keydown listener to document and click listener to canvas', () => {
    const handler = new InputHandler(canvas);
    expect(global.document.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(canvas.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    handler.unbind();
  });

  it('should fire onJump and onRestart on Space keydown', () => {
    const handler = new InputHandler(canvas);
    const jumpCb = vi.fn();
    const restartCb = vi.fn();
    handler.onJump = jumpCb;
    handler.onRestart = restartCb;

    const event = { code: 'Space', preventDefault: vi.fn() };
    // Simulate keydown
    docListeners['keydown'].forEach(h => h(event));

    expect(event.preventDefault).toHaveBeenCalled();
    expect(jumpCb).toHaveBeenCalledTimes(1);
    expect(restartCb).toHaveBeenCalledTimes(1);
    handler.unbind();
  });

  it('should fire onPause and onResume on P keydown', () => {
    const handler = new InputHandler(canvas);
    const pauseCb = vi.fn();
    const resumeCb = vi.fn();
    handler.onPause = pauseCb;
    handler.onResume = resumeCb;

    const event = { code: 'KeyP', preventDefault: vi.fn() };
    docListeners['keydown'].forEach(h => h(event));

    expect(event.preventDefault).toHaveBeenCalled();
    expect(pauseCb).toHaveBeenCalledTimes(1);
    expect(resumeCb).toHaveBeenCalledTimes(1);
    handler.unbind();
  });

  it('should fire onPause and onResume on Escape keydown', () => {
    const handler = new InputHandler(canvas);
    const pauseCb = vi.fn();
    const resumeCb = vi.fn();
    handler.onPause = pauseCb;
    handler.onResume = resumeCb;

    const event = { code: 'Escape', preventDefault: vi.fn() };
    docListeners['keydown'].forEach(h => h(event));

    expect(pauseCb).toHaveBeenCalledTimes(1);
    expect(resumeCb).toHaveBeenCalledTimes(1);
    handler.unbind();
  });

  it('should fire onJump, onRestart, and onResume on canvas click', () => {
    const handler = new InputHandler(canvas);
    const jumpCb = vi.fn();
    const restartCb = vi.fn();
    const resumeCb = vi.fn();
    handler.onJump = jumpCb;
    handler.onRestart = restartCb;
    handler.onResume = resumeCb;

    const event = { preventDefault: vi.fn() };
    canvas._emit('click', event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(jumpCb).toHaveBeenCalledTimes(1);
    expect(restartCb).toHaveBeenCalledTimes(1);
    expect(resumeCb).toHaveBeenCalledTimes(1);
    handler.unbind();
  });

  it('should not throw when callbacks are null and events fire', () => {
    const handler = new InputHandler(canvas);
    // All callbacks are null by default

    const keyEvent = { code: 'Space', preventDefault: vi.fn() };
    expect(() => {
      docListeners['keydown'].forEach(h => h(keyEvent));
    }).not.toThrow();

    const clickEvent = { preventDefault: vi.fn() };
    expect(() => {
      canvas._emit('click', clickEvent);
    }).not.toThrow();

    handler.unbind();
  });

  it('should remove event listeners on unbind', () => {
    const handler = new InputHandler(canvas);
    handler.unbind();

    expect(global.document.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(canvas.removeEventListener).toHaveBeenCalledWith('click', expect.any(Function));
  });

  it('should not fire callbacks for unrelated keys', () => {
    const handler = new InputHandler(canvas);
    const jumpCb = vi.fn();
    const pauseCb = vi.fn();
    handler.onJump = jumpCb;
    handler.onPause = pauseCb;

    const event = { code: 'KeyA', preventDefault: vi.fn() };
    docListeners['keydown'].forEach(h => h(event));

    expect(jumpCb).not.toHaveBeenCalled();
    expect(pauseCb).not.toHaveBeenCalled();
    handler.unbind();
  });
});


describe('DifficultySystem', () => {
  let difficulty;

  beforeEach(() => {
    difficulty = new DifficultySystem();
  });

  it('should initialize with base values', () => {
    expect(difficulty.speed).toBe(GAME_CONFIG.BASE_SPEED);
    expect(difficulty.gap).toBe(GAME_CONFIG.BASE_GAP);
    expect(difficulty.spacing).toBe(GAME_CONFIG.BASE_SPACING);
  });

  it('should not change values at score 0', () => {
    difficulty.update(0);
    expect(difficulty.speed).toBe(150);
    expect(difficulty.gap).toBe(160);
    expect(difficulty.spacing).toBe(250);
  });

  it('should increase speed by 5% at score 5', () => {
    difficulty.update(5);
    expect(difficulty.speed).toBeCloseTo(150 * 1.05);
  });

  it('should increase speed by 10% at score 10', () => {
    difficulty.update(10);
    expect(difficulty.speed).toBeCloseTo(150 * 1.10);
  });

  it('should cap speed at 300 (200% of base)', () => {
    difficulty.update(200); // floor(200/5) * 0.05 = 40 * 0.05 = 2.0 → 150 * 3.0 = 450, capped at 300
    expect(difficulty.speed).toBe(300);
  });

  it('should reduce gap by 5px at score 10', () => {
    difficulty.update(10);
    expect(difficulty.gap).toBe(155);
  });

  it('should reduce gap by 10px at score 20', () => {
    difficulty.update(20);
    expect(difficulty.gap).toBe(150);
  });

  it('should cap gap at minimum 100px', () => {
    difficulty.update(500); // floor(500/10) * 5 = 250 → 160 - 250 = -90, capped at 100
    expect(difficulty.gap).toBe(100);
  });

  it('should reduce spacing by 10px at score 10', () => {
    difficulty.update(10);
    expect(difficulty.spacing).toBe(240);
  });

  it('should cap spacing at minimum 180px', () => {
    difficulty.update(500); // floor(500/10) * 10 = 500 → 250 - 500 = -250, capped at 180
    expect(difficulty.spacing).toBe(180);
  });

  it('should not change gap or spacing for scores below 10', () => {
    difficulty.update(7);
    expect(difficulty.gap).toBe(160);
    expect(difficulty.spacing).toBe(250);
  });

  it('should reset all values to base', () => {
    difficulty.update(50);
    expect(difficulty.speed).not.toBe(GAME_CONFIG.BASE_SPEED);
    difficulty.reset();
    expect(difficulty.speed).toBe(GAME_CONFIG.BASE_SPEED);
    expect(difficulty.gap).toBe(GAME_CONFIG.BASE_GAP);
    expect(difficulty.spacing).toBe(GAME_CONFIG.BASE_SPACING);
  });

  it('should handle score at exact boundary for speed (score=4 vs score=5)', () => {
    difficulty.update(4);
    expect(difficulty.speed).toBe(150); // floor(4/5) = 0 increments
    difficulty.update(5);
    expect(difficulty.speed).toBeCloseTo(150 * 1.05); // floor(5/5) = 1 increment
  });
});


describe('PipeSystem', () => {
  let pool;
  let pipeSystem;

  beforeEach(() => {
    pool = new PipePool();
    pipeSystem = new PipeSystem(pool);
  });

  describe('initialization', () => {
    it('should start with no active pipes', () => {
      expect(pipeSystem.activePipes).toHaveLength(0);
      expect(pipeSystem.getActivePipes()).toHaveLength(0);
    });

    it('should start with lastPipeX at 0', () => {
      expect(pipeSystem.lastPipeX).toBe(0);
    });
  });

  describe('pipe generation', () => {
    it('should spawn a pipe on first update when no pipes exist', () => {
      pipeSystem.update(0.016, 150, 160, 250);
      expect(pipeSystem.activePipes.length).toBe(1);
    });

    it('should spawn pipe at x = BASE_WIDTH (800)', () => {
      pipeSystem.update(0.016, 150, 160, 250);
      // After movement, the pipe should be at BASE_WIDTH - speed*dt
      const pipe = pipeSystem.activePipes[0];
      // The pipe is spawned at 800 then moved by speed*dt in the same frame
      // Actually, movement happens first, then spawn check. Let's verify the pipe x.
      // On first update: no pipes exist → shouldSpawn is true → pipe spawned at 800
      // But movement already happened (on empty array), so pipe stays at 800 minus movement from this frame
      // Wait - the pipe is spawned AFTER movement. So it's at 800 and doesn't move this frame.
      expect(pipe.x).toBe(GAME_CONFIG.BASE_WIDTH);
    });

    it('should set gap center between 20% and 80% of canvas height', () => {
      // Run multiple times to check range
      for (let i = 0; i < 50; i++) {
        const localPool = new PipePool();
        const localSystem = new PipeSystem(localPool);
        localSystem.update(0.016, 150, 160, 250);
        const pipe = localSystem.activePipes[0];
        const minY = GAME_CONFIG.BASE_HEIGHT * 0.2;
        const maxY = GAME_CONFIG.BASE_HEIGHT * 0.8;
        expect(pipe.gapCenterY).toBeGreaterThanOrEqual(minY);
        expect(pipe.gapCenterY).toBeLessThanOrEqual(maxY);
      }
    });

    it('should configure pipe with correct gap size', () => {
      pipeSystem.update(0.016, 150, 160, 250);
      const pipe = pipeSystem.activePipes[0];
      expect(pipe.gapSize).toBe(160);
    });

    it('should not spawn a second pipe until spacing is met', () => {
      pipeSystem.update(0.016, 150, 160, 250);
      expect(pipeSystem.activePipes.length).toBe(1);

      // Small update - pipe barely moves, spacing not met
      pipeSystem.update(0.016, 150, 160, 250);
      expect(pipeSystem.activePipes.length).toBe(1);
    });

    it('should spawn a second pipe when spacing from right edge is met', () => {
      pipeSystem.update(0.016, 150, 160, 250);
      // Move the pipe far enough left so that BASE_WIDTH - rightmostX >= spacing
      // We need the pipe to be at BASE_WIDTH - spacing = 800 - 250 = 550 or less
      // At speed 150, time needed: (800 - 550) / 150 = 250/150 ≈ 1.67s
      pipeSystem.update(1.67, 150, 160, 250);
      expect(pipeSystem.activePipes.length).toBe(2);
    });
  });

  describe('pipe movement', () => {
    it('should move pipes left by speed * deltaTime', () => {
      pipeSystem.update(0.016, 150, 160, 250);
      const pipe = pipeSystem.activePipes[0];
      const initialX = pipe.x;

      pipeSystem.update(1.0, 150, 160, 250);
      // Pipe should have moved left by 150 * 1.0 = 150px
      expect(pipe.x).toBeCloseTo(initialX - 150, 1);
    });

    it('should update topRect and bottomRect x positions when pipe moves', () => {
      pipeSystem.update(0.016, 150, 160, 250);
      const pipe = pipeSystem.activePipes[0];

      pipeSystem.update(0.5, 150, 160, 250);
      expect(pipe.topRect.x).toBe(pipe.x);
      expect(pipe.bottomRect.x).toBe(pipe.x);
    });
  });

  describe('pipe cleanup', () => {
    it('should remove pipes that exit the left edge (x + PIPE_WIDTH < 0)', () => {
      pipeSystem.update(0.016, 150, 160, 250);
      expect(pipeSystem.activePipes.length).toBe(1);

      // Move pipe completely off screen: need x + 60 < 0, so x < -60
      // Pipe starts at 800, needs to move 860px. At 150px/s: 860/150 ≈ 5.74s
      pipeSystem.update(5.8, 150, 160, 250);
      // The original pipe should be removed (x ≈ 800 - 150*5.8 = 800 - 870 = -70, -70 + 60 = -10 < 0)
      // But new pipes may have been spawned
      const removedPipe = pipeSystem.activePipes.find(p => p.x < -GAME_CONFIG.PIPE_WIDTH);
      expect(removedPipe).toBeUndefined();
    });

    it('should release removed pipes back to the pool', () => {
      pipeSystem.update(0.016, 150, 160, 250);
      const initialPoolSize = pool.getPoolSize();

      // Move pipe off screen
      pipeSystem.update(6.0, 150, 160, 250);
      // Pool should have gained back at least one pipe
      expect(pool.getPoolSize()).toBeGreaterThanOrEqual(initialPoolSize);
    });
  });

  describe('scoring', () => {
    it('should return scored: false when player has not passed any pipe', () => {
      pipeSystem.update(0.016, 150, 160, 250);
      // Player at x=160 (20% of 800), pipe at x=800
      const result = pipeSystem.checkScore(160);
      expect(result.scored).toBe(false);
    });

    it('should return scored: true when player passes pipe right edge', () => {
      pipeSystem.update(0.016, 150, 160, 250);
      // Move pipe so its right edge is behind the player
      // Player at x=160, pipe right edge = pipe.x + 60
      // Need pipe.x + 60 < 160, so pipe.x < 100
      // Pipe starts at 800, needs to move 700px. At 150px/s: 700/150 ≈ 4.67s
      pipeSystem.update(4.7, 150, 160, 250);
      const pipe = pipeSystem.activePipes[0];
      // pipe.x ≈ 800 - 150*4.7 = 800 - 705 = 95
      const result = pipeSystem.checkScore(160);
      expect(result.scored).toBe(true);
    });

    it('should not score the same pipe twice', () => {
      pipeSystem.update(0.016, 150, 160, 250);
      pipeSystem.update(4.7, 150, 160, 250);

      const result1 = pipeSystem.checkScore(160);
      expect(result1.scored).toBe(true);

      const result2 = pipeSystem.checkScore(160);
      expect(result2.scored).toBe(false);
    });

    it('should score pipe when playerX > pipe.x + PIPE_WIDTH', () => {
      pipeSystem.update(0.016, 150, 160, 250);
      const pipe = pipeSystem.activePipes[0];
      // Manually set pipe position for precise test
      pipe.x = 50;
      pipe.topRect.x = 50;
      pipe.bottomRect.x = 50;

      // playerX = 111 > 50 + 60 = 110
      const result = pipeSystem.checkScore(111);
      expect(result.scored).toBe(true);
    });
  });

  describe('reset', () => {
    it('should clear all active pipes', () => {
      pipeSystem.update(0.016, 150, 160, 250);
      expect(pipeSystem.activePipes.length).toBeGreaterThan(0);

      pipeSystem.reset();
      expect(pipeSystem.activePipes).toHaveLength(0);
    });

    it('should reset lastPipeX to 0', () => {
      pipeSystem.update(0.016, 150, 160, 250);
      expect(pipeSystem.lastPipeX).toBeGreaterThan(0);

      pipeSystem.reset();
      expect(pipeSystem.lastPipeX).toBe(0);
    });

    it('should release all pipes back to the pool', () => {
      pipeSystem.update(0.016, 150, 160, 250);
      const activeCount = pool.getActiveCount();
      expect(activeCount).toBeGreaterThan(0);

      pipeSystem.reset();
      expect(pool.getActiveCount()).toBe(0);
    });
  });

  describe('pipe hitbox configuration', () => {
    it('should configure topRect from y=0 to top of gap', () => {
      pipeSystem.update(0.016, 150, 160, 250);
      const pipe = pipeSystem.activePipes[0];
      expect(pipe.topRect.y).toBe(0);
      expect(pipe.topRect.height).toBe(pipe.gapCenterY - pipe.gapSize / 2);
      expect(pipe.topRect.width).toBe(GAME_CONFIG.PIPE_WIDTH);
    });

    it('should configure bottomRect from bottom of gap to canvas bottom', () => {
      pipeSystem.update(0.016, 150, 160, 250);
      const pipe = pipeSystem.activePipes[0];
      const expectedY = pipe.gapCenterY + pipe.gapSize / 2;
      expect(pipe.bottomRect.y).toBe(expectedY);
      expect(pipe.bottomRect.height).toBe(GAME_CONFIG.BASE_HEIGHT - expectedY);
      expect(pipe.bottomRect.width).toBe(GAME_CONFIG.PIPE_WIDTH);
    });

    it('should set pipe width to GAME_CONFIG.PIPE_WIDTH (60px)', () => {
      pipeSystem.update(0.016, 150, 160, 250);
      const pipe = pipeSystem.activePipes[0];
      expect(pipe.topRect.width).toBe(60);
      expect(pipe.bottomRect.width).toBe(60);
    });
  });
});


describe('ScoreSystem', () => {
  let mockLocalStorage;

  beforeEach(() => {
    // Create a mock localStorage
    mockLocalStorage = (() => {
      let store = {};
      return {
        getItem: vi.fn((key) => store[key] !== undefined ? store[key] : null),
        setItem: vi.fn((key, value) => { store[key] = String(value); }),
        removeItem: vi.fn((key) => { delete store[key]; }),
        clear: vi.fn(() => { store = {}; }),
        _store: store
      };
    })();
    global.localStorage = mockLocalStorage;
  });

  afterEach(() => {
    delete global.localStorage;
  });

  describe('constructor', () => {
    it('should initialize score to 0', () => {
      const scoreSystem = new ScoreSystem();
      expect(scoreSystem.score).toBe(0);
    });

    it('should load high score from localStorage on init', () => {
      mockLocalStorage.setItem(GAME_CONFIG.STORAGE_KEY, '42');
      const scoreSystem = new ScoreSystem();
      expect(scoreSystem.highScore).toBe(42);
    });

    it('should default high score to 0 if localStorage is empty', () => {
      const scoreSystem = new ScoreSystem();
      expect(scoreSystem.highScore).toBe(0);
    });
  });

  describe('increment', () => {
    it('should increment score by 1', () => {
      const scoreSystem = new ScoreSystem();
      scoreSystem.increment();
      expect(scoreSystem.score).toBe(1);
    });

    it('should increment score multiple times', () => {
      const scoreSystem = new ScoreSystem();
      scoreSystem.increment();
      scoreSystem.increment();
      scoreSystem.increment();
      expect(scoreSystem.score).toBe(3);
    });

    it('should cap score at MAX_SCORE (9999)', () => {
      const scoreSystem = new ScoreSystem();
      scoreSystem.score = 9999;
      scoreSystem.increment();
      expect(scoreSystem.score).toBe(9999);
    });

    it('should cap score at 9999 when incrementing from 9998', () => {
      const scoreSystem = new ScoreSystem();
      scoreSystem.score = 9998;
      scoreSystem.increment();
      expect(scoreSystem.score).toBe(9999);
    });

    it('should update high score when current score exceeds it', () => {
      const scoreSystem = new ScoreSystem();
      scoreSystem.increment();
      expect(scoreSystem.highScore).toBe(1);
    });

    it('should save high score to localStorage when it is exceeded', () => {
      const scoreSystem = new ScoreSystem();
      scoreSystem.increment();
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(GAME_CONFIG.STORAGE_KEY, '1');
    });

    it('should not update high score when current score does not exceed it', () => {
      mockLocalStorage.setItem(GAME_CONFIG.STORAGE_KEY, '100');
      const scoreSystem = new ScoreSystem();
      scoreSystem.increment();
      expect(scoreSystem.highScore).toBe(100);
    });
  });

  describe('reset', () => {
    it('should set score to 0', () => {
      const scoreSystem = new ScoreSystem();
      scoreSystem.score = 50;
      scoreSystem.reset();
      expect(scoreSystem.score).toBe(0);
    });

    it('should reload high score from localStorage', () => {
      const scoreSystem = new ScoreSystem();
      scoreSystem.increment();
      scoreSystem.increment();
      // Simulate external change to localStorage
      mockLocalStorage.setItem(GAME_CONFIG.STORAGE_KEY, '500');
      scoreSystem.reset();
      expect(scoreSystem.highScore).toBe(500);
    });
  });

  describe('loadHighScore', () => {
    it('should return 0 when localStorage has no value', () => {
      const scoreSystem = new ScoreSystem();
      expect(scoreSystem.loadHighScore()).toBe(0);
    });

    it('should return valid integer value from localStorage', () => {
      mockLocalStorage.setItem(GAME_CONFIG.STORAGE_KEY, '250');
      const scoreSystem = new ScoreSystem();
      expect(scoreSystem.loadHighScore()).toBe(250);
    });

    it('should return 0 for non-numeric stored value', () => {
      mockLocalStorage.setItem(GAME_CONFIG.STORAGE_KEY, 'abc');
      const scoreSystem = new ScoreSystem();
      expect(scoreSystem.loadHighScore()).toBe(0);
    });

    it('should return 0 for negative stored value', () => {
      mockLocalStorage.setItem(GAME_CONFIG.STORAGE_KEY, '-5');
      const scoreSystem = new ScoreSystem();
      expect(scoreSystem.loadHighScore()).toBe(0);
    });

    it('should return 0 for value exceeding MAX_SCORE', () => {
      mockLocalStorage.setItem(GAME_CONFIG.STORAGE_KEY, '10000');
      const scoreSystem = new ScoreSystem();
      expect(scoreSystem.loadHighScore()).toBe(0);
    });

    it('should return 0 for floating point stored value', () => {
      mockLocalStorage.setItem(GAME_CONFIG.STORAGE_KEY, '3.14');
      const scoreSystem = new ScoreSystem();
      expect(scoreSystem.loadHighScore()).toBe(0);
    });

    it('should return 0 when localStorage throws an error', () => {
      global.localStorage = {
        getItem: () => { throw new Error('SecurityError'); },
        setItem: () => { throw new Error('SecurityError'); }
      };
      const scoreSystem = new ScoreSystem();
      expect(scoreSystem.highScore).toBe(0);
    });

    it('should accept 0 as a valid stored value', () => {
      mockLocalStorage.setItem(GAME_CONFIG.STORAGE_KEY, '0');
      const scoreSystem = new ScoreSystem();
      expect(scoreSystem.loadHighScore()).toBe(0);
    });

    it('should accept MAX_SCORE (9999) as a valid stored value', () => {
      mockLocalStorage.setItem(GAME_CONFIG.STORAGE_KEY, '9999');
      const scoreSystem = new ScoreSystem();
      expect(scoreSystem.loadHighScore()).toBe(9999);
    });
  });

  describe('saveHighScore', () => {
    it('should save high score to localStorage', () => {
      const scoreSystem = new ScoreSystem();
      scoreSystem.highScore = 42;
      scoreSystem.saveHighScore();
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(GAME_CONFIG.STORAGE_KEY, '42');
    });

    it('should not throw when localStorage is unavailable', () => {
      global.localStorage = {
        getItem: () => null,
        setItem: () => { throw new Error('QuotaExceededError'); }
      };
      const scoreSystem = new ScoreSystem();
      scoreSystem.highScore = 100;
      expect(() => scoreSystem.saveHighScore()).not.toThrow();
    });
  });

  describe('localStorage unavailability', () => {
    it('should handle localStorage being completely undefined', () => {
      delete global.localStorage;
      // ScoreSystem should not throw, should default to 0
      const scoreSystem = new ScoreSystem();
      expect(scoreSystem.score).toBe(0);
      expect(scoreSystem.highScore).toBe(0);
    });

    it('should still increment score when localStorage is unavailable', () => {
      global.localStorage = {
        getItem: () => { throw new Error('SecurityError'); },
        setItem: () => { throw new Error('SecurityError'); }
      };
      const scoreSystem = new ScoreSystem();
      scoreSystem.increment();
      scoreSystem.increment();
      expect(scoreSystem.score).toBe(2);
      expect(scoreSystem.highScore).toBe(2);
    });
  });
});


describe('checkCollisions', () => {
  let pool;
  let pipeSystem;

  // Helper to create a mock player with a specific position
  function createMockPlayer(cx, cy, radius) {
    return {
      getCollisionCircle() {
        return { cx, cy, radius };
      }
    };
  }

  beforeEach(() => {
    pool = new PipePool();
    pipeSystem = new PipeSystem(pool);
  });

  describe('boundary collisions', () => {
    it('should return true when player touches the ceiling (cy - radius <= 0)', () => {
      const player = createMockPlayer(160, 10, 15); // cy - radius = -5 <= 0
      expect(checkCollisions(player, pipeSystem, GAME_CONFIG.BASE_HEIGHT)).toBe(true);
    });

    it('should return true when player touches the floor (cy + radius >= canvasHeight)', () => {
      const player = createMockPlayer(160, 590, 15); // cy + radius = 605 >= 600
      expect(checkCollisions(player, pipeSystem, GAME_CONFIG.BASE_HEIGHT)).toBe(true);
    });

    it('should return false when player is safely in the middle', () => {
      const player = createMockPlayer(160, 300, 15);
      expect(checkCollisions(player, pipeSystem, GAME_CONFIG.BASE_HEIGHT)).toBe(false);
    });
  });

  describe('pipe collisions', () => {
    it('should return true when player collides with a top pipe rect', () => {
      // Spawn a pipe with gap center at 300, gap size 160
      // topRect: x=800, y=0, width=60, height=220 (300 - 80 = 220)
      pool.spawn(100, 300, 160);
      pipeSystem.activePipes = [pool.active.values().next().value];

      // Player at position that overlaps with topRect (y=0 to y=220)
      const player = createMockPlayer(130, 210, 15); // inside topRect area
      expect(checkCollisions(player, pipeSystem, GAME_CONFIG.BASE_HEIGHT)).toBe(true);
    });

    it('should return true when player collides with a bottom pipe rect', () => {
      // Spawn a pipe with gap center at 300, gap size 160
      // bottomRect: x=100, y=380, width=60, height=220
      pool.spawn(100, 300, 160);
      pipeSystem.activePipes = [pool.active.values().next().value];

      // Player at position that overlaps with bottomRect (y=380 to y=600)
      const player = createMockPlayer(130, 390, 15);
      expect(checkCollisions(player, pipeSystem, GAME_CONFIG.BASE_HEIGHT)).toBe(true);
    });

    it('should return false when player passes through the gap safely', () => {
      // Spawn a pipe with gap center at 300, gap size 160
      // Gap is from y=220 to y=380
      pool.spawn(100, 300, 160);
      pipeSystem.activePipes = [pool.active.values().next().value];

      // Player in the middle of the gap
      const player = createMockPlayer(130, 300, 15);
      expect(checkCollisions(player, pipeSystem, GAME_CONFIG.BASE_HEIGHT)).toBe(false);
    });

    it('should return false when player is not horizontally near any pipe', () => {
      // Pipe at x=500
      pool.spawn(500, 300, 160);
      pipeSystem.activePipes = [pool.active.values().next().value];

      // Player at x=160, far from pipe at x=500
      const player = createMockPlayer(160, 100, 15);
      expect(checkCollisions(player, pipeSystem, GAME_CONFIG.BASE_HEIGHT)).toBe(false);
    });

    it('should check all active pipes and return true on any collision', () => {
      // Spawn two pipes
      const pipe1 = pool.spawn(500, 300, 160); // far away
      const pipe2 = pool.spawn(100, 300, 160); // close to player

      pipeSystem.activePipes = [pipe1, pipe2];

      // Player collides with pipe2's topRect
      const player = createMockPlayer(130, 210, 15);
      expect(checkCollisions(player, pipeSystem, GAME_CONFIG.BASE_HEIGHT)).toBe(true);
    });
  });

  describe('no collision cases', () => {
    it('should return false with no pipes and player in safe position', () => {
      const player = createMockPlayer(160, 300, 15);
      expect(checkCollisions(player, pipeSystem, GAME_CONFIG.BASE_HEIGHT)).toBe(false);
    });

    it('should return false when player is just inside safe bounds', () => {
      // Player just barely inside bounds: cy - radius > 0 and cy + radius < canvasHeight
      const player = createMockPlayer(160, 16, 15); // cy - radius = 1 > 0
      expect(checkCollisions(player, pipeSystem, GAME_CONFIG.BASE_HEIGHT)).toBe(false);
    });
  });
});
