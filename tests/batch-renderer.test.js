import { describe, it, expect, beforeEach } from 'vitest';
const { BatchRenderer, GAME_CONFIG } = require('../game.js');

/**
 * Mock CanvasRenderingContext2D for testing BatchRenderer.
 */
function createMockCtx() {
  const calls = [];
  return {
    calls,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    save() { calls.push({ method: 'save' }); },
    restore() { calls.push({ method: 'restore' }); },
    translate(x, y) { calls.push({ method: 'translate', args: [x, y] }); },
    scale(x, y) { calls.push({ method: 'scale', args: [x, y] }); },
    drawImage(...args) { calls.push({ method: 'drawImage', args }); },
    fillRect(x, y, w, h) { calls.push({ method: 'fillRect', args: [x, y, w, h] }); },
    strokeRect(x, y, w, h) { calls.push({ method: 'strokeRect', args: [x, y, w, h] }); },
    beginPath() { calls.push({ method: 'beginPath' }); },
    closePath() { calls.push({ method: 'closePath' }); },
    fill() { calls.push({ method: 'fill' }); },
    stroke() { calls.push({ method: 'stroke' }); },
    getContext() { return createMockCtx(); }
  };
}

describe('BatchRenderer', () => {
  let ctx;
  let renderer;

  beforeEach(() => {
    // Mock OffscreenCanvas globally for Node.js environment
    global.OffscreenCanvas = class {
      constructor(width, height) {
        this.width = width;
        this.height = height;
      }
      getContext() {
        return createMockCtx();
      }
    };

    ctx = createMockCtx();
    renderer = new BatchRenderer(ctx);
  });

  describe('constructor', () => {
    it('should store the canvas context', () => {
      expect(renderer.ctx).toBe(ctx);
    });

    it('should initialize segment cache as null', () => {
      expect(renderer._segmentCache).toBeNull();
    });
  });

  describe('prerenderPipeSegment', () => {
    it('should return a canvas with the specified dimensions', () => {
      const segment = renderer.prerenderPipeSegment(60, 200);
      expect(segment.width).toBe(60);
      expect(segment.height).toBe(200);
    });

    it('should use OffscreenCanvas when available and USE_OFFSCREEN_CANVAS is true', () => {
      const segment = renderer.prerenderPipeSegment(60, 100);
      expect(segment).toBeInstanceOf(global.OffscreenCanvas);
    });

    it('should create segment with PIPE_WIDTH (60px) width', () => {
      const segment = renderer.prerenderPipeSegment(GAME_CONFIG.PIPE_WIDTH, 150);
      expect(segment.width).toBe(60);
    });

    it('should handle small heights (just hull)', () => {
      // Height of 10 means only hull, no containers
      const segment = renderer.prerenderPipeSegment(60, 10);
      expect(segment.width).toBe(60);
      expect(segment.height).toBe(10);
    });

    it('should handle height larger than canvas', () => {
      const segment = renderer.prerenderPipeSegment(60, 800);
      expect(segment.width).toBe(60);
      expect(segment.height).toBe(800);
    });
  });

  describe('renderPipe', () => {
    it('should render top pipe inverted (save/scale/restore pattern)', () => {
      const pipe = {
        x: 100,
        topRect: { x: 100, y: 0, width: 60, height: 200 },
        bottomRect: { x: 100, y: 360, width: 60, height: 240 }
      };

      renderer.renderPipe(pipe, 600);

      // Top pipe should use save/translate/scale(-1)/drawImage/restore for inversion
      const saveCalls = ctx.calls.filter(c => c.method === 'save');
      const restoreCalls = ctx.calls.filter(c => c.method === 'restore');
      const scaleCalls = ctx.calls.filter(c => c.method === 'scale');
      const drawCalls = ctx.calls.filter(c => c.method === 'drawImage');

      expect(saveCalls.length).toBeGreaterThanOrEqual(1);
      expect(restoreCalls.length).toBeGreaterThanOrEqual(1);
      expect(scaleCalls.length).toBeGreaterThanOrEqual(1);
      // Scale should flip vertically (1, -1)
      expect(scaleCalls[0].args).toEqual([1, -1]);
      // Should have 2 drawImage calls (top + bottom)
      expect(drawCalls.length).toBe(2);
    });

    it('should render bottom pipe at correct y position', () => {
      const pipe = {
        x: 200,
        topRect: { x: 200, y: 0, width: 60, height: 150 },
        bottomRect: { x: 200, y: 400, width: 60, height: 200 }
      };

      renderer.renderPipe(pipe, 600);

      // Find the drawImage call for the bottom pipe (second one)
      const drawCalls = ctx.calls.filter(c => c.method === 'drawImage');
      expect(drawCalls.length).toBe(2);

      // Bottom pipe drawImage should position at pipe.bottomRect.y (400)
      const bottomDraw = drawCalls[1];
      // drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh)
      // dx should be pipe.x (200), dy should be pipe.bottomRect.y (400)
      expect(bottomDraw.args[5]).toBe(200); // dx = pipe.x
      expect(bottomDraw.args[6]).toBe(400); // dy = pipe.bottomRect.y
    });

    it('should not render top pipe if height is 0', () => {
      const pipe = {
        x: 100,
        topRect: { x: 100, y: 0, width: 60, height: 0 },
        bottomRect: { x: 100, y: 300, width: 60, height: 300 }
      };

      renderer.renderPipe(pipe, 600);

      // Should only have 1 drawImage call (bottom only)
      const drawCalls = ctx.calls.filter(c => c.method === 'drawImage');
      expect(drawCalls.length).toBe(1);
    });

    it('should not render bottom pipe if height is 0', () => {
      const pipe = {
        x: 100,
        topRect: { x: 100, y: 0, width: 60, height: 300 },
        bottomRect: { x: 100, y: 600, width: 60, height: 0 }
      };

      renderer.renderPipe(pipe, 600);

      // Should only have 1 drawImage call (top only)
      const drawCalls = ctx.calls.filter(c => c.method === 'drawImage');
      expect(drawCalls.length).toBe(1);
    });

    it('should use PIPE_WIDTH for rendering width', () => {
      const pipe = {
        x: 50,
        topRect: { x: 50, y: 0, width: 60, height: 100 },
        bottomRect: { x: 50, y: 500, width: 60, height: 100 }
      };

      renderer.renderPipe(pipe, 600);

      const drawCalls = ctx.calls.filter(c => c.method === 'drawImage');
      // Both draw calls should use PIPE_WIDTH (60) as width
      for (const call of drawCalls) {
        // dw is the 8th argument (index 7)
        expect(call.args[7]).toBe(GAME_CONFIG.PIPE_WIDTH);
      }
    });
  });

  describe('_getOrCreateSegment (caching)', () => {
    it('should cache the segment after first call', () => {
      expect(renderer._segmentCache).toBeNull();
      renderer.renderPipe({
        x: 0,
        topRect: { x: 0, y: 0, width: 60, height: 100 },
        bottomRect: { x: 0, y: 500, width: 60, height: 100 }
      }, 600);
      expect(renderer._segmentCache).not.toBeNull();
    });

    it('should reuse cached segment for subsequent renders', () => {
      const pipe = {
        x: 0,
        topRect: { x: 0, y: 0, width: 60, height: 100 },
        bottomRect: { x: 0, y: 500, width: 60, height: 100 }
      };

      renderer.renderPipe(pipe, 600);
      const firstCache = renderer._segmentCache;

      renderer.renderPipe(pipe, 600);
      const secondCache = renderer._segmentCache;

      expect(firstCache).toBe(secondCache);
    });
  });
});
