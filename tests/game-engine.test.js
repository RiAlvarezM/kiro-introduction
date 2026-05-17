import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  GameEngine,
  GameState,
  GAME_CONFIG,
  StateManager,
  VALID_TRANSITIONS,
  HUD
} from '../game.js';

/**
 * Creates a mock Canvas 2D context that records all draw calls in order.
 */
function createMockCtx() {
  const calls = [];
  return {
    calls,
    fillStyle: '',
    strokeStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    lineWidth: 1,
    globalAlpha: 1,
    fillRect(x, y, w, h) {
      calls.push({ method: 'fillRect', args: [x, y, w, h], fillStyle: this.fillStyle });
    },
    fillText(text, x, y) {
      calls.push({ method: 'fillText', args: [text, x, y], font: this.font, fillStyle: this.fillStyle, textAlign: this.textAlign });
    },
    strokeRect(x, y, w, h) {
      calls.push({ method: 'strokeRect', args: [x, y, w, h], strokeStyle: this.strokeStyle });
    },
    beginPath() {
      calls.push({ method: 'beginPath' });
    },
    moveTo(x, y) {
      calls.push({ method: 'moveTo', args: [x, y] });
    },
    lineTo(x, y) {
      calls.push({ method: 'lineTo', args: [x, y] });
    },
    closePath() {
      calls.push({ method: 'closePath' });
    },
    fill() {
      calls.push({ method: 'fill', fillStyle: this.fillStyle });
    },
    stroke() {
      calls.push({ method: 'stroke', strokeStyle: this.strokeStyle });
    },
    arc(x, y, r, start, end) {
      calls.push({ method: 'arc', args: [x, y, r, start, end] });
    },
    ellipse(x, y, rx, ry, rot, start, end) {
      calls.push({ method: 'ellipse', args: [x, y, rx, ry, rot, start, end] });
    },
    bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {
      calls.push({ method: 'bezierCurveTo', args: [cp1x, cp1y, cp2x, cp2y, x, y] });
    },
    quadraticCurveTo(cpx, cpy, x, y) {
      calls.push({ method: 'quadraticCurveTo', args: [cpx, cpy, x, y] });
    },
    save() {
      calls.push({ method: 'save' });
    },
    restore() {
      calls.push({ method: 'restore' });
    },
    translate(x, y) {
      calls.push({ method: 'translate', args: [x, y] });
    },
    scale(x, y) {
      calls.push({ method: 'scale', args: [x, y] });
    },
    drawImage(...args) {
      calls.push({ method: 'drawImage', args });
    }
  };
}

/**
 * Creates a mock canvas element with a mock 2D context.
 */
function createMockCanvas() {
  const ctx = createMockCtx();
  const canvas = {
    width: GAME_CONFIG.BASE_WIDTH,
    height: GAME_CONFIG.BASE_HEIGHT,
    style: {},
    getContext(type) {
      if (type === '2d') return ctx;
      return null;
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  };
  return { canvas, ctx };
}

describe('GameEngine', () => {
  let mockLocalStorage;

  beforeEach(() => {
    // Mock localStorage
    mockLocalStorage = (() => {
      let store = {};
      return {
        getItem: vi.fn((key) => store[key] !== undefined ? store[key] : null),
        setItem: vi.fn((key, value) => { store[key] = String(value); }),
        removeItem: vi.fn((key) => { delete store[key]; }),
        clear: vi.fn(() => { store = {}; })
      };
    })();
    global.localStorage = mockLocalStorage;

    // Mock window for CanvasScaler
    global.window = global.window || {};
    global.window.innerWidth = 1024;
    global.window.innerHeight = 768;
    global.window.addEventListener = vi.fn();
    global.window.removeEventListener = vi.fn();

    // Mock document for InputHandler
    global.document = global.document || {};
    global.document.addEventListener = vi.fn();
    global.document.removeEventListener = vi.fn();
  });

  describe('Constructor and initialization', () => {
    it('should create a GameEngine with null subsystems before init()', () => {
      const { canvas } = createMockCanvas();
      const engine = new GameEngine(canvas);

      expect(engine.canvas).toBe(canvas);
      expect(engine.stateManager).toBeNull();
      expect(engine.player).toBeNull();
      expect(engine.pipeSystem).toBeNull();
      expect(engine.background).toBeNull();
      expect(engine.cloudSystem).toBeNull();
      expect(engine.hud).toBeNull();
      expect(engine.audioSystem).toBeNull();
      expect(engine.inputHandler).toBeNull();
      expect(engine.difficultySystem).toBeNull();
      expect(engine.scoreSystem).toBeNull();
      expect(engine.pauseController).toBeNull();
      expect(engine.restartController).toBeNull();
      expect(engine.batchRenderer).toBeNull();
      expect(engine.canvasScaler).toBeNull();
    });

    it('should set running to false and lastTimestamp to 0', () => {
      const { canvas } = createMockCanvas();
      const engine = new GameEngine(canvas);

      expect(engine.running).toBe(false);
      expect(engine.lastTimestamp).toBe(0);
    });

    it('should initialize all subsystems after successful init()', async () => {
      const { canvas } = createMockCanvas();
      const engine = new GameEngine(canvas);

      // Mock Image loading
      global.Image = class {
        constructor() {
          this.width = 40;
          this.height = 40;
          setTimeout(() => { if (this.onload) this.onload(); }, 0);
        }
        set src(val) { this._src = val; }
        get src() { return this._src; }
      };

      // Mock AudioContext and fetch for AudioSystem
      global.AudioContext = class {
        constructor() { this.state = 'running'; }
        decodeAudioData() { return Promise.resolve({}); }
        createBufferSource() { return { connect() {}, start() {}, buffer: null }; }
        resume() { return Promise.resolve(); }
        get destination() { return {}; }
      };
      global.window.AudioContext = global.AudioContext;

      global.fetch = vi.fn(() => Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
      }));

      await engine.init();

      expect(engine.stateManager).not.toBeNull();
      expect(engine.player).not.toBeNull();
      expect(engine.pipeSystem).not.toBeNull();
      expect(engine.background).not.toBeNull();
      expect(engine.cloudSystem).not.toBeNull();
      expect(engine.hud).not.toBeNull();
      expect(engine.audioSystem).not.toBeNull();
      expect(engine.inputHandler).not.toBeNull();
      expect(engine.difficultySystem).not.toBeNull();
      expect(engine.scoreSystem).not.toBeNull();
      expect(engine.pauseController).not.toBeNull();
      expect(engine.restartController).not.toBeNull();
      expect(engine.batchRenderer).not.toBeNull();
      expect(engine.canvasScaler).not.toBeNull();
    });

    it('should start in INICIO state after init()', async () => {
      const { canvas } = createMockCanvas();
      const engine = new GameEngine(canvas);

      global.Image = class {
        constructor() {
          this.width = 40;
          this.height = 40;
          setTimeout(() => { if (this.onload) this.onload(); }, 0);
        }
        set src(val) { this._src = val; }
        get src() { return this._src; }
      };

      global.AudioContext = class {
        constructor() { this.state = 'running'; }
        decodeAudioData() { return Promise.resolve({}); }
        createBufferSource() { return { connect() {}, start() {}, buffer: null }; }
        resume() { return Promise.resolve(); }
        get destination() { return {}; }
      };
      global.window.AudioContext = global.AudioContext;

      global.fetch = vi.fn(() => Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
      }));

      await engine.init();

      expect(engine.stateManager.getState()).toBe(GameState.INICIO);
    });
  });

  describe('Start screen (Requirement 1.2)', () => {
    it('should render "Flappy Kiro" title when state is INICIO', () => {
      const hud = new HUD();
      const ctx = createMockCtx();

      hud.render(ctx, GameState.INICIO, 0, 0, GAME_CONFIG.BASE_WIDTH, GAME_CONFIG.BASE_HEIGHT);

      const titleCall = ctx.calls.find(c => c.method === 'fillText' && c.args[0] === 'Flappy Kiro');
      expect(titleCall).toBeDefined();
      expect(titleCall.args[1]).toBe(GAME_CONFIG.BASE_WIDTH / 2);
      expect(titleCall.textAlign).toBe('center');
    });

    it('should render "Press Space or Click to start" instruction', () => {
      const hud = new HUD();
      const ctx = createMockCtx();

      hud.render(ctx, GameState.INICIO, 0, 0, GAME_CONFIG.BASE_WIDTH, GAME_CONFIG.BASE_HEIGHT);

      const instrCall = ctx.calls.find(c => c.method === 'fillText' && c.args[0] === 'Press Space or Click to start');
      expect(instrCall).toBeDefined();
      expect(instrCall.args[1]).toBe(GAME_CONFIG.BASE_WIDTH / 2);
    });

    it('should render title with bold 48px monospace font', () => {
      const hud = new HUD();
      const ctx = createMockCtx();

      hud.render(ctx, GameState.INICIO, 0, 0, GAME_CONFIG.BASE_WIDTH, GAME_CONFIG.BASE_HEIGHT);

      const titleCall = ctx.calls.find(c => c.method === 'fillText' && c.args[0] === 'Flappy Kiro');
      expect(titleCall.font).toBe('bold 48px monospace');
    });

    it('should render instruction with 20px monospace font', () => {
      const hud = new HUD();
      const ctx = createMockCtx();

      hud.render(ctx, GameState.INICIO, 0, 0, GAME_CONFIG.BASE_WIDTH, GAME_CONFIG.BASE_HEIGHT);

      const instrCall = ctx.calls.find(c => c.method === 'fillText' && c.args[0] === 'Press Space or Click to start');
      expect(instrCall.font).toBe('20px monospace');
    });
  });

  describe('State transitions (Requirement 7.1)', () => {
    it('should define valid transitions for all states', () => {
      expect(VALID_TRANSITIONS[GameState.INICIO]).toContain(GameState.PLAYING);
      expect(VALID_TRANSITIONS[GameState.PLAYING]).toContain(GameState.PAUSED);
      expect(VALID_TRANSITIONS[GameState.PLAYING]).toContain(GameState.GAME_OVER);
      expect(VALID_TRANSITIONS[GameState.PAUSED]).toContain(GameState.PLAYING);
      expect(VALID_TRANSITIONS[GameState.GAME_OVER]).toContain(GameState.PLAYING);
    });

    it('should allow INICIO → PLAYING transition', () => {
      const sm = new StateManager();
      expect(sm.getState()).toBe(GameState.INICIO);

      const result = sm.transition(GameState.PLAYING);
      expect(result).toBe(true);
      expect(sm.getState()).toBe(GameState.PLAYING);
    });

    it('should allow PLAYING → PAUSED transition', () => {
      const sm = new StateManager();
      sm.transition(GameState.PLAYING);

      const result = sm.transition(GameState.PAUSED);
      expect(result).toBe(true);
      expect(sm.getState()).toBe(GameState.PAUSED);
    });

    it('should allow PAUSED → PLAYING transition', () => {
      const sm = new StateManager();
      sm.transition(GameState.PLAYING);
      sm.transition(GameState.PAUSED);

      const result = sm.transition(GameState.PLAYING);
      expect(result).toBe(true);
      expect(sm.getState()).toBe(GameState.PLAYING);
    });

    it('should allow PLAYING → GAME_OVER transition', () => {
      const sm = new StateManager();
      sm.transition(GameState.PLAYING);

      const result = sm.transition(GameState.GAME_OVER);
      expect(result).toBe(true);
      expect(sm.getState()).toBe(GameState.GAME_OVER);
    });

    it('should allow GAME_OVER → PLAYING transition', () => {
      const sm = new StateManager();
      sm.transition(GameState.PLAYING);
      sm.transition(GameState.GAME_OVER);

      const result = sm.transition(GameState.PLAYING);
      expect(result).toBe(true);
      expect(sm.getState()).toBe(GameState.PLAYING);
    });

    it('should reject invalid transition INICIO → PAUSED', () => {
      const sm = new StateManager();

      const result = sm.transition(GameState.PAUSED);
      expect(result).toBe(false);
      expect(sm.getState()).toBe(GameState.INICIO);
    });

    it('should reject invalid transition INICIO → GAME_OVER', () => {
      const sm = new StateManager();

      const result = sm.transition(GameState.GAME_OVER);
      expect(result).toBe(false);
      expect(sm.getState()).toBe(GameState.INICIO);
    });

    it('should reject invalid transition PAUSED → GAME_OVER', () => {
      const sm = new StateManager();
      sm.transition(GameState.PLAYING);
      sm.transition(GameState.PAUSED);

      const result = sm.transition(GameState.GAME_OVER);
      expect(result).toBe(false);
      expect(sm.getState()).toBe(GameState.PAUSED);
    });

    it('should reject invalid transition GAME_OVER → PAUSED', () => {
      const sm = new StateManager();
      sm.transition(GameState.PLAYING);
      sm.transition(GameState.GAME_OVER);

      const result = sm.transition(GameState.PAUSED);
      expect(result).toBe(false);
      expect(sm.getState()).toBe(GameState.GAME_OVER);
    });

    it('should update stateEnteredAt on valid transition', () => {
      const sm = new StateManager();
      const beforeTransition = Date.now();

      sm.transition(GameState.PLAYING);

      expect(sm.stateEnteredAt).toBeGreaterThanOrEqual(beforeTransition);
      expect(sm.stateEnteredAt).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('Asset loading timeout (Requirement 1.6)', () => {
    it('should render error message when sprite loading times out', async () => {
      const { canvas, ctx } = createMockCanvas();
      const engine = new GameEngine(canvas);

      // Mock Image that never fires onload (simulates timeout)
      global.Image = class {
        constructor() {
          this.width = 0;
          this.height = 0;
        }
        set src(val) { this._src = val; }
        get src() { return this._src; }
        // onload and onerror are never called — timeout will trigger
      };

      // Use fake timers to trigger the timeout
      vi.useFakeTimers();

      const initPromise = engine.init();

      // Advance time past the 10-second timeout
      vi.advanceTimersByTime(GAME_CONFIG.ASSET_TIMEOUT_MS + 100);

      await expect(initPromise).rejects.toThrow();

      // Verify error was rendered on canvas
      const errorTitleCall = ctx.calls.find(c =>
        c.method === 'fillText' && c.args[0] === 'Error Loading Game'
      );
      expect(errorTitleCall).toBeDefined();
      expect(errorTitleCall.fillStyle).toBe('#FF4444');

      vi.useRealTimers();
    });

    it('should display the timeout error message text on canvas', async () => {
      const { canvas, ctx } = createMockCanvas();
      const engine = new GameEngine(canvas);

      global.Image = class {
        constructor() {
          this.width = 0;
          this.height = 0;
        }
        set src(val) { this._src = val; }
        get src() { return this._src; }
      };

      vi.useFakeTimers();

      const initPromise = engine.init();
      vi.advanceTimersByTime(GAME_CONFIG.ASSET_TIMEOUT_MS + 100);

      await expect(initPromise).rejects.toThrow('Sprite loading timed out after 10 seconds');

      // Verify the specific error message is rendered
      const errorMsgCall = ctx.calls.find(c =>
        c.method === 'fillText' && c.args[0].includes('timed out')
      );
      expect(errorMsgCall).toBeDefined();

      vi.useRealTimers();
    });

    it('should render dark background when showing error', async () => {
      const { canvas, ctx } = createMockCanvas();
      const engine = new GameEngine(canvas);

      global.Image = class {
        constructor() {
          this.width = 0;
          this.height = 0;
        }
        set src(val) { this._src = val; }
        get src() { return this._src; }
      };

      vi.useFakeTimers();

      const initPromise = engine.init();
      vi.advanceTimersByTime(GAME_CONFIG.ASSET_TIMEOUT_MS + 100);

      await expect(initPromise).rejects.toThrow();

      // Verify dark background is rendered
      const bgCall = ctx.calls.find(c =>
        c.method === 'fillRect' && c.fillStyle === '#1a1a2e'
      );
      expect(bgCall).toBeDefined();
      expect(bgCall.args).toEqual([0, 0, GAME_CONFIG.BASE_WIDTH, GAME_CONFIG.BASE_HEIGHT]);

      vi.useRealTimers();
    });
  });

  describe('Render layer order (Requirement 8.6)', () => {
    it('should render layers in correct order: background → pipes → clouds → player → HUD', async () => {
      const { canvas, ctx } = createMockCanvas();
      const engine = new GameEngine(canvas);

      // Mock Image loading
      global.Image = class {
        constructor() {
          this.width = 40;
          this.height = 40;
          setTimeout(() => { if (this.onload) this.onload(); }, 0);
        }
        set src(val) { this._src = val; }
        get src() { return this._src; }
      };

      global.AudioContext = class {
        constructor() { this.state = 'running'; }
        decodeAudioData() { return Promise.resolve({}); }
        createBufferSource() { return { connect() {}, start() {}, buffer: null }; }
        resume() { return Promise.resolve(); }
        get destination() { return {}; }
      };
      global.window.AudioContext = global.AudioContext;

      global.fetch = vi.fn(() => Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
      }));

      await engine.init();

      // Transition to PLAYING so all layers render
      engine.stateManager.transition(GameState.PLAYING);

      // Spy on render methods to track call order
      const renderOrder = [];

      const origBgRender = engine.background.render.bind(engine.background);
      engine.background.render = (c) => {
        renderOrder.push('background');
        origBgRender(c);
      };

      const origBatchRender = engine.batchRenderer.renderPipe.bind(engine.batchRenderer);
      engine.batchRenderer.renderPipe = (pipe, h) => {
        renderOrder.push('pipes');
        origBatchRender(pipe, h);
      };

      const origCloudRender = engine.cloudSystem.render.bind(engine.cloudSystem);
      engine.cloudSystem.render = (c) => {
        renderOrder.push('clouds');
        origCloudRender(c);
      };

      const origPlayerRender = engine.player.render.bind(engine.player);
      engine.player.render = (c) => {
        renderOrder.push('player');
        origPlayerRender(c);
      };

      const origHudRender = engine.hud.render.bind(engine.hud);
      engine.hud.render = (...args) => {
        renderOrder.push('hud');
        origHudRender(...args);
      };

      // Call render
      engine.render();

      // Verify order: background first, then clouds, player, HUD last
      // Pipes may or may not be present (no active pipes initially)
      expect(renderOrder[0]).toBe('background');

      const cloudsIdx = renderOrder.indexOf('clouds');
      const playerIdx = renderOrder.indexOf('player');
      const hudIdx = renderOrder.indexOf('hud');

      expect(cloudsIdx).toBeGreaterThan(0);
      expect(playerIdx).toBeGreaterThan(cloudsIdx);
      expect(hudIdx).toBeGreaterThan(playerIdx);
    });

    it('should render pipes before clouds when pipes are active', async () => {
      const { canvas, ctx } = createMockCanvas();
      const engine = new GameEngine(canvas);

      global.Image = class {
        constructor() {
          this.width = 40;
          this.height = 40;
          setTimeout(() => { if (this.onload) this.onload(); }, 0);
        }
        set src(val) { this._src = val; }
        get src() { return this._src; }
      };

      global.AudioContext = class {
        constructor() { this.state = 'running'; }
        decodeAudioData() { return Promise.resolve({}); }
        createBufferSource() { return { connect() {}, start() {}, buffer: null }; }
        resume() { return Promise.resolve(); }
        get destination() { return {}; }
      };
      global.window.AudioContext = global.AudioContext;

      global.fetch = vi.fn(() => Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
      }));

      // Mock OffscreenCanvas for BatchRenderer
      global.OffscreenCanvas = class {
        constructor(w, h) {
          this.width = w;
          this.height = h;
        }
        getContext() {
          return createMockCtx();
        }
      };

      await engine.init();

      // Transition to PLAYING and add a pipe
      engine.stateManager.transition(GameState.PLAYING);
      engine.pipeSystem.update(0.016, 150, 160, 250);

      // Spy on render methods
      const renderOrder = [];

      engine.background.render = () => { renderOrder.push('background'); };
      engine.batchRenderer.renderPipe = () => { renderOrder.push('pipes'); };
      engine.cloudSystem.render = () => { renderOrder.push('clouds'); };
      engine.player.render = () => { renderOrder.push('player'); };
      engine.hud.render = () => { renderOrder.push('hud'); };

      engine.render();

      const pipesIdx = renderOrder.indexOf('pipes');
      const cloudsIdx = renderOrder.indexOf('clouds');
      const playerIdx = renderOrder.indexOf('player');
      const hudIdx = renderOrder.indexOf('hud');

      // Verify: background → pipes → clouds → player → HUD
      expect(renderOrder[0]).toBe('background');
      expect(pipesIdx).toBeGreaterThan(0);
      expect(cloudsIdx).toBeGreaterThan(pipesIdx);
      expect(playerIdx).toBeGreaterThan(cloudsIdx);
      expect(hudIdx).toBeGreaterThan(playerIdx);
    });

    it('should always render HUD last', async () => {
      const { canvas, ctx } = createMockCanvas();
      const engine = new GameEngine(canvas);

      global.Image = class {
        constructor() {
          this.width = 40;
          this.height = 40;
          setTimeout(() => { if (this.onload) this.onload(); }, 0);
        }
        set src(val) { this._src = val; }
        get src() { return this._src; }
      };

      global.AudioContext = class {
        constructor() { this.state = 'running'; }
        decodeAudioData() { return Promise.resolve({}); }
        createBufferSource() { return { connect() {}, start() {}, buffer: null }; }
        resume() { return Promise.resolve(); }
        get destination() { return {}; }
      };
      global.window.AudioContext = global.AudioContext;

      global.fetch = vi.fn(() => Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
      }));

      await engine.init();

      const renderOrder = [];
      engine.background.render = () => { renderOrder.push('background'); };
      engine.batchRenderer.renderPipe = () => { renderOrder.push('pipes'); };
      engine.cloudSystem.render = () => { renderOrder.push('clouds'); };
      engine.player.render = () => { renderOrder.push('player'); };
      engine.hud.render = () => { renderOrder.push('hud'); };

      engine.render();

      // HUD should always be the last element rendered
      expect(renderOrder[renderOrder.length - 1]).toBe('hud');
    });
  });
});
