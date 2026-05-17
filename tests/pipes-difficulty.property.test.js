import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

const { GAME_CONFIG, PipePool, PipeSystem, DifficultySystem } = require('../game.js');

/**
 * Arbitrary for score values in the valid game range [0, 9999].
 */
const scoreArb = fc.integer({ min: 0, max: 9999 });

/**
 * Arbitrary for positive delta time values (reasonable game frame durations).
 */
const dtArb = fc.double({ min: 0.001, max: 0.1, noNaN: true, noDefaultInfinity: true });

/**
 * Arbitrary for pipe speed values (within difficulty range).
 */
const speedArb = fc.double({ min: 50, max: 300, noNaN: true, noDefaultInfinity: true });

describe('Pipes & Difficulty Property Tests', () => {

  /**
   * Property 6: Difficulty Scaling Correctness
   * For any score value between 0 and 9999, the difficulty parameters should be:
   * - Speed = min(150 * (1 + floor(score/5) * 0.05), 300) px/s
   * - Gap = max(160 - floor(score/10) * 5, 100) px
   * - Spacing = max(250 - floor(score/10) * 10, 180) px
   *
   * And speed should never exceed 300, gap should never be less than 100,
   * and spacing should never be less than 180.
   *
   * **Validates: Requirements 3.7, 3.8, 3.9**
   */
  describe('Property 6: Difficulty Scaling Correctness', () => {
    it('speed, gap, and spacing follow the correct formulas for any score 0-9999', () => {
      fc.assert(
        fc.property(
          scoreArb,
          (score) => {
            const difficulty = new DifficultySystem();
            difficulty.update(score);

            // Expected speed: min(BASE_SPEED * (1 + floor(score/5) * 0.05), BASE_SPEED * MAX_SPEED_MULTIPLIER)
            const speedIncrements = Math.floor(score / GAME_CONFIG.SPEED_INCREMENT_INTERVAL);
            const expectedSpeed = Math.min(
              GAME_CONFIG.BASE_SPEED * (1 + speedIncrements * GAME_CONFIG.SPEED_INCREMENT_PERCENT),
              GAME_CONFIG.BASE_SPEED * GAME_CONFIG.MAX_SPEED_MULTIPLIER
            );

            // Expected gap: max(BASE_GAP - floor(score/10) * GAP_REDUCTION_PX, MIN_GAP)
            const gapReductions = Math.floor(score / GAME_CONFIG.GAP_REDUCTION_INTERVAL);
            const expectedGap = Math.max(
              GAME_CONFIG.BASE_GAP - gapReductions * GAME_CONFIG.GAP_REDUCTION_PX,
              GAME_CONFIG.MIN_GAP
            );

            // Expected spacing: max(BASE_SPACING - floor(score/10) * SPACING_REDUCTION_PX, MIN_SPACING)
            const spacingReductions = Math.floor(score / GAME_CONFIG.SPACING_REDUCTION_INTERVAL);
            const expectedSpacing = Math.max(
              GAME_CONFIG.BASE_SPACING - spacingReductions * GAME_CONFIG.SPACING_REDUCTION_PX,
              GAME_CONFIG.MIN_SPACING
            );

            // Verify formulas
            expect(difficulty.speed).toBeCloseTo(expectedSpeed, 5);
            expect(difficulty.gap).toBeCloseTo(expectedGap, 5);
            expect(difficulty.spacing).toBeCloseTo(expectedSpacing, 5);

            // Verify bounds invariants
            expect(difficulty.speed).toBeLessThanOrEqual(300);
            expect(difficulty.speed).toBeGreaterThanOrEqual(GAME_CONFIG.BASE_SPEED);
            expect(difficulty.gap).toBeGreaterThanOrEqual(GAME_CONFIG.MIN_GAP);
            expect(difficulty.gap).toBeLessThanOrEqual(GAME_CONFIG.BASE_GAP);
            expect(difficulty.spacing).toBeGreaterThanOrEqual(GAME_CONFIG.MIN_SPACING);
            expect(difficulty.spacing).toBeLessThanOrEqual(GAME_CONFIG.BASE_SPACING);
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  /**
   * Property 7: Pipe Gap Center Range
   * For any generated pipe pair and any canvas height, the vertical center of the gap
   * should be positioned between 20% and 80% of the canvas height inclusive.
   *
   * **Validates: Requirements 3.3**
   */
  describe('Property 7: Pipe Gap Center Range', () => {
    it('gap center is always between 20% and 80% of canvas height', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.2, max: 0.8, noNaN: true, noDefaultInfinity: true }), // gapCenterPercent
          fc.integer({ min: 100, max: 160 }), // gapSize
          (gapCenterPercent, gapSize) => {
            const pool = new PipePool();
            const canvasHeight = GAME_CONFIG.BASE_HEIGHT;

            // Spawn a pipe with gap center within the valid range
            const gapCenterY = canvasHeight * gapCenterPercent;
            const pipe = pool.spawn(800, gapCenterY, gapSize);

            // Verify the gap center is within 20%-80% of canvas height
            const minGapCenter = canvasHeight * 0.2;
            const maxGapCenter = canvasHeight * 0.8;

            expect(pipe.gapCenterY).toBeGreaterThanOrEqual(minGapCenter);
            expect(pipe.gapCenterY).toBeLessThanOrEqual(maxGapCenter);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('PipeSystem._randomGapCenter() always produces values in [20%, 80%] of canvas height', () => {
      // Test the internal random generation by calling it many times
      const pool = new PipePool();
      const pipeSystem = new PipeSystem(pool);
      const canvasHeight = GAME_CONFIG.BASE_HEIGHT;
      const minGapCenter = canvasHeight * 0.2;
      const maxGapCenter = canvasHeight * 0.8;

      // Call _randomGapCenter many times and verify bounds
      for (let i = 0; i < 1000; i++) {
        const gapCenter = pipeSystem._randomGapCenter();
        expect(gapCenter).toBeGreaterThanOrEqual(minGapCenter);
        expect(gapCenter).toBeLessThanOrEqual(maxGapCenter);
      }
    });
  });

  /**
   * Property 8: Pipe Movement and Cleanup
   * For any set of active pipes after an update with positive delta time and positive speed,
   * each pipe's X position should decrease by exactly speed * dt, and no pipe with
   * x + PIPE_WIDTH < 0 should remain in the active pipes array.
   *
   * **Validates: Requirements 3.4, 3.5**
   */
  describe('Property 8: Pipe Movement and Cleanup', () => {
    it('pipes move left by speed*dt and are removed when off-screen', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.double({ min: -100, max: 900, noNaN: true, noDefaultInfinity: true }),
            { minLength: 1, maxLength: 10 }
          ), // initial x positions for pipes
          speedArb,
          dtArb,
          (initialXPositions, speed, dt) => {
            const pool = new PipePool();
            const pipeSystem = new PipeSystem(pool);
            const gap = GAME_CONFIG.BASE_GAP;
            const spacing = GAME_CONFIG.BASE_SPACING;

            // Manually spawn pipes at specific positions
            for (const x of initialXPositions) {
              const gapCenterY = GAME_CONFIG.BASE_HEIGHT * 0.5; // center
              const pipe = pool.spawn(x, gapCenterY, gap);
              pipeSystem.activePipes.push(pipe);
            }

            // Record initial positions
            const initialPositions = pipeSystem.activePipes.map(p => p.x);

            // Perform update (use very large spacing to prevent new pipe spawning)
            pipeSystem.update(dt, speed, gap, 99999);

            // Get active pipes after update
            const activePipes = pipeSystem.getActivePipes();

            // Verify: no pipe with x + PIPE_WIDTH < 0 remains
            for (const pipe of activePipes) {
              expect(pipe.x + GAME_CONFIG.PIPE_WIDTH).toBeGreaterThanOrEqual(0);
            }

            // Verify: pipes that remain moved by exactly speed * dt
            // Filter out any newly spawned pipes (spawned during update when all pipes were removed)
            const expectedMovement = speed * dt;
            const survivingPipes = activePipes.filter(pipe => {
              // A pipe is "surviving" if its position matches an original pipe moved by expectedMovement
              return initialPositions.some(
                origX => Math.abs((origX - expectedMovement) - pipe.x) < 1e-6
              );
            });

            for (let i = 0; i < survivingPipes.length; i++) {
              const pipe = survivingPipes[i];
              // Find the original position of this pipe
              const originalX = initialPositions.find(
                origX => Math.abs((origX - expectedMovement) - pipe.x) < 1e-6
              );
              expect(originalX).toBeDefined();
              expect(pipe.x).toBeCloseTo(originalX - expectedMovement, 5);
            }

            // Verify: pipes that should have been removed are gone
            for (let i = 0; i < initialPositions.length; i++) {
              const movedX = initialPositions[i] - expectedMovement;
              if (movedX + GAME_CONFIG.PIPE_WIDTH < 0) {
                // This pipe should NOT be in surviving pipes
                const found = survivingPipes.some(p => Math.abs(p.x - movedX) < 1e-6);
                expect(found).toBe(false);
              }
            }

            // Verify: the number of surviving pipes equals original pipes minus removed ones
            const expectedRemovedCount = initialPositions.filter(
              origX => (origX - expectedMovement) + GAME_CONFIG.PIPE_WIDTH < 0
            ).length;
            expect(survivingPipes.length).toBe(initialPositions.length - expectedRemovedCount);
          }
        ),
        { numRuns: 500 }
      );
    });
  });

});
