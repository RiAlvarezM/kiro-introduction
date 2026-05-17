import { describe, it, expect } from 'vitest';
const { calculateScaledDimensions, CanvasScaler, GAME_CONFIG } = require('../game.js');

describe('Canvas Scaling', () => {
  describe('calculateScaledDimensions', () => {
    it('should return dimensions that maintain 4:3 aspect ratio', () => {
      const { width, height } = calculateScaledDimensions(1024, 768);
      expect(width / height).toBeCloseTo(4 / 3, 5);
    });

    it('should be width-constrained when window is taller than 4:3', () => {
      // Window is 800x900 (narrower than 4:3 would allow)
      const { width, height } = calculateScaledDimensions(800, 900);
      expect(width).toBe(800);
      expect(height).toBe(600);
      expect(width / height).toBeCloseTo(4 / 3, 5);
    });

    it('should be height-constrained when window is wider than 4:3', () => {
      // Window is 1600x600 (wider than 4:3 would allow)
      const { width, height } = calculateScaledDimensions(1600, 600);
      expect(height).toBe(600);
      expect(width).toBe(800);
      expect(width / height).toBeCloseTo(4 / 3, 5);
    });

    it('should fit within the window dimensions (width-constrained)', () => {
      const { width, height } = calculateScaledDimensions(640, 800);
      expect(width).toBeLessThanOrEqual(640);
      expect(height).toBeLessThanOrEqual(800);
    });

    it('should fit within the window dimensions (height-constrained)', () => {
      const { width, height } = calculateScaledDimensions(2000, 500);
      expect(width).toBeLessThanOrEqual(2000);
      expect(height).toBeLessThanOrEqual(500);
    });

    it('should handle exact 4:3 window dimensions', () => {
      const { width, height } = calculateScaledDimensions(1200, 900);
      expect(width).toBe(1200);
      expect(height).toBe(900);
      expect(width / height).toBeCloseTo(4 / 3, 5);
    });

    it('should handle small window sizes', () => {
      const { width, height } = calculateScaledDimensions(320, 240);
      expect(width).toBe(320);
      expect(height).toBe(240);
      expect(width / height).toBeCloseTo(4 / 3, 5);
    });

    it('should handle very wide window (ultrawide monitor)', () => {
      const { width, height } = calculateScaledDimensions(3440, 1440);
      expect(height).toBe(1440);
      expect(width).toBeCloseTo(1920, 0);
      expect(width / height).toBeCloseTo(4 / 3, 5);
      expect(width).toBeLessThanOrEqual(3440);
    });

    it('should handle very tall window (portrait orientation)', () => {
      const { width, height } = calculateScaledDimensions(400, 1200);
      expect(width).toBe(400);
      expect(height).toBe(300);
      expect(width / height).toBeCloseTo(4 / 3, 5);
      expect(height).toBeLessThanOrEqual(1200);
    });
  });

  describe('CanvasScaler', () => {
    it('should be exported and be a class', () => {
      expect(CanvasScaler).toBeDefined();
      expect(typeof CanvasScaler).toBe('function');
    });
  });

  describe('GAME_CONFIG canvas constants', () => {
    it('should have BASE_WIDTH of 800', () => {
      expect(GAME_CONFIG.BASE_WIDTH).toBe(800);
    });

    it('should have BASE_HEIGHT of 600', () => {
      expect(GAME_CONFIG.BASE_HEIGHT).toBe(600);
    });

    it('should have ASPECT_RATIO of 4/3', () => {
      expect(GAME_CONFIG.ASPECT_RATIO).toBeCloseTo(4 / 3, 10);
    });
  });
});
