import { describe, it, expect } from 'vitest';
const { Background, GAME_CONFIG } = require('../game.js');

describe('Background', () => {
  describe('constructor', () => {
    it('should store canvas dimensions and initialize scrollX to 0', () => {
      const bg = new Background(800, 600);
      expect(bg.canvasWidth).toBe(800);
      expect(bg.canvasHeight).toBe(600);
      expect(bg.scrollX).toBe(0);
    });
  });

  describe('update', () => {
    it('should scroll at 30% of pipe speed (BG_PARALLAX_FACTOR)', () => {
      const bg = new Background(800, 600);
      const pipeSpeed = 150;
      const deltaTime = 1; // 1 second
      bg.update(deltaTime, pipeSpeed);
      expect(bg.scrollX).toBeCloseTo(pipeSpeed * GAME_CONFIG.BG_PARALLAX_FACTOR * deltaTime);
    });

    it('should accumulate scroll over multiple updates', () => {
      const bg = new Background(800, 600);
      const pipeSpeed = 200;
      const dt = 0.016; // ~60fps
      bg.update(dt, pipeSpeed);
      bg.update(dt, pipeSpeed);
      const expected = (pipeSpeed * GAME_CONFIG.BG_PARALLAX_FACTOR * dt * 2) % 800;
      expect(bg.scrollX).toBeCloseTo(expected);
    });

    it('should wrap scrollX using modulo when it exceeds canvasWidth', () => {
      const bg = new Background(800, 600);
      // Force scrollX to exceed canvasWidth
      bg.scrollX = 790;
      const pipeSpeed = 150;
      const deltaTime = 1; // This adds 45px, total = 835
      bg.update(deltaTime, pipeSpeed);
      // 835 % 800 = 35
      expect(bg.scrollX).toBeCloseTo(835 % 800);
    });

    it('should keep scrollX in [0, canvasWidth) range after wrapping', () => {
      const bg = new Background(800, 600);
      // Simulate many updates
      for (let i = 0; i < 1000; i++) {
        bg.update(0.016, 300);
      }
      expect(bg.scrollX).toBeGreaterThanOrEqual(0);
      expect(bg.scrollX).toBeLessThan(800);
    });

    it('should not scroll when pipeSpeed is 0', () => {
      const bg = new Background(800, 600);
      bg.update(1, 0);
      expect(bg.scrollX).toBe(0);
    });

    it('should not scroll when deltaTime is 0', () => {
      const bg = new Background(800, 600);
      bg.update(0, 150);
      expect(bg.scrollX).toBe(0);
    });
  });

  describe('reset', () => {
    it('should reset scrollX to 0', () => {
      const bg = new Background(800, 600);
      bg.update(1, 150);
      expect(bg.scrollX).not.toBe(0);
      bg.reset();
      expect(bg.scrollX).toBe(0);
    });
  });

  describe('render', () => {
    it('should call canvas drawing methods without errors', () => {
      const bg = new Background(800, 600);
      // Create a minimal mock canvas context
      const ctx = {
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 0,
        fillRect: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        closePath: () => {},
        fill: () => {},
        stroke: () => {},
        arc: () => {},
        bezierCurveTo: () => {},
        quadraticCurveTo: () => {},
      };
      // Should not throw
      expect(() => bg.render(ctx)).not.toThrow();
    });

    it('should set sky color as the first fill', () => {
      const bg = new Background(800, 600);
      const fills = [];
      const ctx = {
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 0,
        set fillStyle(val) { fills.push(val); },
        get fillStyle() { return fills[fills.length - 1] || ''; },
        fillRect: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        closePath: () => {},
        fill: () => {},
        stroke: () => {},
        arc: () => {},
        bezierCurveTo: () => {},
        quadraticCurveTo: () => {},
      };
      bg.render(ctx);
      // First fill should be sky color
      expect(fills[0]).toBe(GAME_CONFIG.SKY_COLOR);
    });

    it('should use all four layer colors during render', () => {
      const bg = new Background(800, 600);
      const fills = [];
      const strokes = [];
      const ctx = {
        _fillStyle: '',
        set fillStyle(val) { fills.push(val); this._fillStyle = val; },
        get fillStyle() { return this._fillStyle; },
        _strokeStyle: '',
        set strokeStyle(val) { strokes.push(val); this._strokeStyle = val; },
        get strokeStyle() { return this._strokeStyle; },
        lineWidth: 0,
        fillRect: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        closePath: () => {},
        fill: () => {},
        stroke: () => {},
        arc: () => {},
        bezierCurveTo: () => {},
        quadraticCurveTo: () => {},
      };
      bg.render(ctx);
      expect(fills).toContain(GAME_CONFIG.SKY_COLOR);
      expect(fills).toContain(GAME_CONFIG.HILLS_COLOR);
      expect(fills).toContain(GAME_CONFIG.VEGETATION_COLOR);
      expect(fills).toContain(GAME_CONFIG.WATER_COLOR);
    });
  });
});
