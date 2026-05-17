import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

const { calculateScaledDimensions, GAME_CONFIG } = require('../game.js');

/**
 * Arbitrary for window dimensions (width and height between 100 and 4000).
 */
const windowDimensionArb = fc.integer({ min: 100, max: 4000 });

describe('Canvas Scaling Property Tests', () => {

  /**
   * Property 19: Canvas Aspect Ratio Scaling
   * For any window dimensions (width, height), the scaled canvas dimensions should
   * maintain a 4:3 aspect ratio (width/height = 4/3 within floating point tolerance)
   * and should fit within the available window space without exceeding it.
   *
   * **Validates: Requirements 9.7**
   */
  describe('Property 19: Canvas Aspect Ratio Scaling', () => {

    it('scaled dimensions maintain 4:3 aspect ratio for any window size', () => {
      fc.assert(
        fc.property(
          windowDimensionArb,
          windowDimensionArb,
          (windowWidth, windowHeight) => {
            const { width, height } = calculateScaledDimensions(windowWidth, windowHeight);

            // width/height should be approximately 4/3
            const ratio = width / height;
            expect(ratio).toBeCloseTo(4 / 3, 5);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('scaled dimensions fit within window (width <= windowWidth)', () => {
      fc.assert(
        fc.property(
          windowDimensionArb,
          windowDimensionArb,
          (windowWidth, windowHeight) => {
            const { width } = calculateScaledDimensions(windowWidth, windowHeight);

            expect(width).toBeLessThanOrEqual(windowWidth);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('scaled dimensions fit within window (height <= windowHeight)', () => {
      fc.assert(
        fc.property(
          windowDimensionArb,
          windowDimensionArb,
          (windowWidth, windowHeight) => {
            const { height } = calculateScaledDimensions(windowWidth, windowHeight);

            expect(height).toBeLessThanOrEqual(windowHeight);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('at least one scaled dimension equals the corresponding window dimension (fills available space)', () => {
      fc.assert(
        fc.property(
          windowDimensionArb,
          windowDimensionArb,
          (windowWidth, windowHeight) => {
            const { width, height } = calculateScaledDimensions(windowWidth, windowHeight);

            // The scaling should fill the available space in at least one direction
            const widthFills = Math.abs(width - windowWidth) < 1e-6;
            const heightFills = Math.abs(height - windowHeight) < 1e-6;

            expect(widthFills || heightFills).toBe(true);
          }
        ),
        { numRuns: 500 }
      );
    });
  });
});
