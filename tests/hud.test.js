import { describe, it, expect, beforeEach } from 'vitest';
import { HUD, GameState, GAME_CONFIG } from '../game.js';

/**
 * Creates a mock Canvas 2D context that records all draw calls.
 */
function createMockCtx() {
  const calls = [];
  return {
    calls,
    fillStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    fillRect(x, y, w, h) {
      calls.push({ method: 'fillRect', args: [x, y, w, h], fillStyle: this.fillStyle });
    },
    fillText(text, x, y) {
      calls.push({ method: 'fillText', args: [text, x, y], font: this.font, fillStyle: this.fillStyle, textAlign: this.textAlign, textBaseline: this.textBaseline });
    }
  };
}

describe('HUD', () => {
  let hud;
  let ctx;
  const canvasWidth = 800;
  const canvasHeight = 600;

  beforeEach(() => {
    hud = new HUD();
    ctx = createMockCtx();
  });

  describe('constructor', () => {
    it('should set BAR_HEIGHT to 40', () => {
      expect(hud.BAR_HEIGHT).toBe(40);
    });

    it('should set BAR_COLOR to rgba(0, 0, 0, 0.8)', () => {
      expect(hud.BAR_COLOR).toBe('rgba(0, 0, 0, 0.8)');
    });

    it('should set OVERLAY_COLOR to rgba(0, 0, 0, 0.5)', () => {
      expect(hud.OVERLAY_COLOR).toBe('rgba(0, 0, 0, 0.5)');
    });
  });

  describe('INICIO state', () => {
    it('should render title "Flappy Kiro" centered', () => {
      hud.render(ctx, GameState.INICIO, 0, 0, canvasWidth, canvasHeight);

      const titleCall = ctx.calls.find(c => c.method === 'fillText' && c.args[0] === 'Flappy Kiro');
      expect(titleCall).toBeDefined();
      expect(titleCall.args[1]).toBe(canvasWidth / 2);
      expect(titleCall.font).toBe('bold 48px monospace');
      expect(titleCall.textAlign).toBe('center');
      expect(titleCall.textBaseline).toBe('middle');
    });

    it('should render start instruction below title', () => {
      hud.render(ctx, GameState.INICIO, 0, 0, canvasWidth, canvasHeight);

      const instrCall = ctx.calls.find(c => c.method === 'fillText' && c.args[0] === 'Press Space or Click to start');
      expect(instrCall).toBeDefined();
      expect(instrCall.args[1]).toBe(canvasWidth / 2);
      expect(instrCall.font).toBe('20px monospace');
    });

    it('should NOT render score bar during INICIO', () => {
      hud.render(ctx, GameState.INICIO, 0, 0, canvasWidth, canvasHeight);

      const barCall = ctx.calls.find(c => c.method === 'fillRect' && c.fillStyle === 'rgba(0, 0, 0, 0.8)');
      expect(barCall).toBeUndefined();
    });
  });

  describe('PLAYING state', () => {
    it('should render score bar at bottom of canvas', () => {
      hud.render(ctx, GameState.PLAYING, 5, 10, canvasWidth, canvasHeight);

      const barCall = ctx.calls.find(c => c.method === 'fillRect' && c.fillStyle === 'rgba(0, 0, 0, 0.8)');
      expect(barCall).toBeDefined();
      expect(barCall.args[0]).toBe(0);
      expect(barCall.args[1]).toBe(canvasHeight - 40);
      expect(barCall.args[2]).toBe(canvasWidth);
      expect(barCall.args[3]).toBe(40);
    });

    it('should render "Score: X" left-aligned', () => {
      hud.render(ctx, GameState.PLAYING, 42, 100, canvasWidth, canvasHeight);

      const scoreCall = ctx.calls.find(c => c.method === 'fillText' && c.args[0] === 'Score: 42');
      expect(scoreCall).toBeDefined();
      expect(scoreCall.textAlign).toBe('left');
      expect(scoreCall.font).toBe('bold 16px monospace');
    });

    it('should render "High: X" right-aligned', () => {
      hud.render(ctx, GameState.PLAYING, 42, 100, canvasWidth, canvasHeight);

      const highCall = ctx.calls.find(c => c.method === 'fillText' && c.args[0] === 'High: 100');
      expect(highCall).toBeDefined();
      expect(highCall.textAlign).toBe('right');
    });

    it('should NOT render overlay during PLAYING', () => {
      hud.render(ctx, GameState.PLAYING, 0, 0, canvasWidth, canvasHeight);

      const overlayCall = ctx.calls.find(c => c.method === 'fillRect' && c.fillStyle === 'rgba(0, 0, 0, 0.5)');
      expect(overlayCall).toBeUndefined();
    });
  });

  describe('PAUSED state', () => {
    it('should render score bar', () => {
      hud.render(ctx, GameState.PAUSED, 10, 50, canvasWidth, canvasHeight);

      const barCall = ctx.calls.find(c => c.method === 'fillRect' && c.fillStyle === 'rgba(0, 0, 0, 0.8)');
      expect(barCall).toBeDefined();
    });

    it('should render semi-transparent overlay over entire canvas', () => {
      hud.render(ctx, GameState.PAUSED, 10, 50, canvasWidth, canvasHeight);

      const overlayCall = ctx.calls.find(c => c.method === 'fillRect' && c.fillStyle === 'rgba(0, 0, 0, 0.5)');
      expect(overlayCall).toBeDefined();
      expect(overlayCall.args).toEqual([0, 0, canvasWidth, canvasHeight]);
    });

    it('should render "PAUSED" text centered', () => {
      hud.render(ctx, GameState.PAUSED, 10, 50, canvasWidth, canvasHeight);

      const pauseCall = ctx.calls.find(c => c.method === 'fillText' && c.args[0] === 'PAUSED');
      expect(pauseCall).toBeDefined();
      expect(pauseCall.args[1]).toBe(canvasWidth / 2);
      expect(pauseCall.font).toBe('bold 48px monospace');
      expect(pauseCall.textAlign).toBe('center');
    });

    it('should render resume instruction', () => {
      hud.render(ctx, GameState.PAUSED, 10, 50, canvasWidth, canvasHeight);

      const instrCall = ctx.calls.find(c => c.method === 'fillText' && c.args[0] === 'Press P, Escape, or Click to resume');
      expect(instrCall).toBeDefined();
      expect(instrCall.font).toBe('20px monospace');
    });
  });

  describe('GAME_OVER state', () => {
    it('should render score bar', () => {
      hud.render(ctx, GameState.GAME_OVER, 25, 100, canvasWidth, canvasHeight, 2000);

      const barCall = ctx.calls.find(c => c.method === 'fillRect' && c.fillStyle === 'rgba(0, 0, 0, 0.8)');
      expect(barCall).toBeDefined();
    });

    it('should render semi-transparent overlay', () => {
      hud.render(ctx, GameState.GAME_OVER, 25, 100, canvasWidth, canvasHeight, 2000);

      const overlayCall = ctx.calls.find(c => c.method === 'fillRect' && c.fillStyle === 'rgba(0, 0, 0, 0.5)');
      expect(overlayCall).toBeDefined();
      expect(overlayCall.args).toEqual([0, 0, canvasWidth, canvasHeight]);
    });

    it('should render "Game Over" title centered', () => {
      hud.render(ctx, GameState.GAME_OVER, 25, 100, canvasWidth, canvasHeight, 2000);

      const titleCall = ctx.calls.find(c => c.method === 'fillText' && c.args[0] === 'Game Over');
      expect(titleCall).toBeDefined();
      expect(titleCall.args[1]).toBe(canvasWidth / 2);
      expect(titleCall.font).toBe('bold 48px monospace');
    });

    it('should render final score', () => {
      hud.render(ctx, GameState.GAME_OVER, 25, 100, canvasWidth, canvasHeight, 2000);

      const scoreCall = ctx.calls.find(c => c.method === 'fillText' && c.args[0] === 'Score: 25' && c.textAlign === 'center');
      expect(scoreCall).toBeDefined();
    });

    it('should render high score', () => {
      hud.render(ctx, GameState.GAME_OVER, 25, 100, canvasWidth, canvasHeight, 2000);

      const highCall = ctx.calls.find(c => c.method === 'fillText' && c.args[0] === 'High Score: 100');
      expect(highCall).toBeDefined();
    });

    it('should NOT show restart instruction before 1 second', () => {
      hud.render(ctx, GameState.GAME_OVER, 25, 100, canvasWidth, canvasHeight, 500);

      const restartCall = ctx.calls.find(c => c.method === 'fillText' && c.args[0] === 'Press Space or Click to restart');
      expect(restartCall).toBeUndefined();
    });

    it('should show restart instruction after 1 second', () => {
      hud.render(ctx, GameState.GAME_OVER, 25, 100, canvasWidth, canvasHeight, 1000);

      const restartCall = ctx.calls.find(c => c.method === 'fillText' && c.args[0] === 'Press Space or Click to restart');
      expect(restartCall).toBeDefined();
    });

    it('should show restart instruction after more than 1 second', () => {
      hud.render(ctx, GameState.GAME_OVER, 25, 100, canvasWidth, canvasHeight, 3000);

      const restartCall = ctx.calls.find(c => c.method === 'fillText' && c.args[0] === 'Press Space or Click to restart');
      expect(restartCall).toBeDefined();
    });
  });
});
