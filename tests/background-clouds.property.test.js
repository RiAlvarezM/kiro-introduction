import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

const { GAME_CONFIG, Background, CloudSystem } = require('../game.js');

/**
 * Arbitrary for positive delta time values (reasonable game frame durations).
 */
const dtArb = fc.double({ min: 0.001, max: 0.1, noNaN: true, noDefaultInfinity: true });

/**
 * Arbitrary for pipe speed values (from base speed to max speed).
 */
const pipeSpeedArb = fc.double({ min: 50, max: 400, noNaN: true, noDefaultInfinity: true });

describe('Background & Clouds Property Tests', () => {

  /**
   * Property 17: Background Parallax and Wrapping
   * For any pipe speed and positive delta time, the background should scroll at exactly
   * 30% of the pipe speed. For any scroll offset, the rendered background position should
   * wrap seamlessly (scrollX modulo background width produces a valid render offset in
   * [0, backgroundWidth)).
   *
   * **Validates: Requirements 8.3, 8.4**
   */
  describe('Property 17: Background Parallax and Wrapping', () => {
    it('scrollX increases by pipeSpeed * 0.3 * deltaTime per update', () => {
      fc.assert(
        fc.property(
          pipeSpeedArb,
          dtArb,
          (pipeSpeed, dt) => {
            const canvasWidth = GAME_CONFIG.BASE_WIDTH;
            const canvasHeight = GAME_CONFIG.BASE_HEIGHT;
            const bg = new Background(canvasWidth, canvasHeight);

            const scrollBefore = bg.scrollX;
            bg.update(dt, pipeSpeed);

            const expectedIncrement = pipeSpeed * GAME_CONFIG.BG_PARALLAX_FACTOR * dt;
            const expectedScrollX = (scrollBefore + expectedIncrement) % canvasWidth;

            expect(bg.scrollX).toBeCloseTo(expectedScrollX, 5);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('scrollX stays in [0, canvasWidth) after many updates (seamless wrapping)', () => {
      fc.assert(
        fc.property(
          pipeSpeedArb,
          fc.array(dtArb, { minLength: 10, maxLength: 200 }),
          (pipeSpeed, deltaTimes) => {
            const canvasWidth = GAME_CONFIG.BASE_WIDTH;
            const canvasHeight = GAME_CONFIG.BASE_HEIGHT;
            const bg = new Background(canvasWidth, canvasHeight);

            for (const dt of deltaTimes) {
              bg.update(dt, pipeSpeed);
            }

            // scrollX must always be in [0, canvasWidth)
            expect(bg.scrollX).toBeGreaterThanOrEqual(0);
            expect(bg.scrollX).toBeLessThan(canvasWidth);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('scroll speed is exactly 30% of pipe speed (parallax factor)', () => {
      fc.assert(
        fc.property(
          pipeSpeedArb,
          (pipeSpeed) => {
            const canvasWidth = GAME_CONFIG.BASE_WIDTH;
            const canvasHeight = GAME_CONFIG.BASE_HEIGHT;
            const bg = new Background(canvasWidth, canvasHeight);

            // Use a fixed dt of 1 second for easy verification
            const dt = 1;
            bg.update(dt, pipeSpeed);

            // After 1 second, scrollX should be pipeSpeed * 0.3 (mod canvasWidth)
            const expectedScroll = (pipeSpeed * 0.3) % canvasWidth;
            expect(bg.scrollX).toBeCloseTo(expectedScroll, 5);
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  /**
   * Property 18: Cloud System Invariants
   * For any cloud system state, there should be at least 3 clouds, each cloud's opacity
   * should be in [0.4, 0.7], each cloud's speed factor should be in [0.1, 0.5] relative
   * to pipe speed, and not all clouds should have the same speed factor.
   *
   * **Validates: Requirements 9.2, 9.3**
   */
  describe('Property 18: Cloud System Invariants', () => {
    it('cloud system has at least 3 clouds on initialization', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 400, max: 1920 }),  // canvasWidth
          fc.integer({ min: 300, max: 1080 }),  // canvasHeight
          (canvasWidth, canvasHeight) => {
            const cloudSystem = new CloudSystem(canvasWidth, canvasHeight);

            expect(cloudSystem.clouds.length).toBeGreaterThanOrEqual(GAME_CONFIG.MIN_CLOUDS);
          }
        ),
        { numRuns: 200 }
      );
    });

    it('all clouds have opacity in [0.4, 0.7]', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 400, max: 1920 }),
          fc.integer({ min: 300, max: 1080 }),
          (canvasWidth, canvasHeight) => {
            const cloudSystem = new CloudSystem(canvasWidth, canvasHeight);

            for (const cloud of cloudSystem.clouds) {
              expect(cloud.opacity).toBeGreaterThanOrEqual(GAME_CONFIG.CLOUD_MIN_OPACITY);
              expect(cloud.opacity).toBeLessThanOrEqual(GAME_CONFIG.CLOUD_MAX_OPACITY);
            }
          }
        ),
        { numRuns: 200 }
      );
    });

    it('all clouds have speedFactor in [0.1, 0.5]', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 400, max: 1920 }),
          fc.integer({ min: 300, max: 1080 }),
          (canvasWidth, canvasHeight) => {
            const cloudSystem = new CloudSystem(canvasWidth, canvasHeight);

            for (const cloud of cloudSystem.clouds) {
              expect(cloud.speedFactor).toBeGreaterThanOrEqual(GAME_CONFIG.CLOUD_MIN_SPEED);
              expect(cloud.speedFactor).toBeLessThanOrEqual(GAME_CONFIG.CLOUD_MAX_SPEED);
            }
          }
        ),
        { numRuns: 200 }
      );
    });

    it('not all clouds have the same speedFactor', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 400, max: 1920 }),
          fc.integer({ min: 300, max: 1080 }),
          (canvasWidth, canvasHeight) => {
            const cloudSystem = new CloudSystem(canvasWidth, canvasHeight);

            const speeds = cloudSystem.clouds.map(c => c.speedFactor);
            const allSame = speeds.every(s => s === speeds[0]);

            expect(allSame).toBe(false);
          }
        ),
        { numRuns: 200 }
      );
    });

    it('cloud invariants hold after multiple updates', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 400, max: 1920 }),
          fc.integer({ min: 300, max: 1080 }),
          pipeSpeedArb,
          fc.array(dtArb, { minLength: 5, maxLength: 50 }),
          (canvasWidth, canvasHeight, pipeSpeed, deltaTimes) => {
            const cloudSystem = new CloudSystem(canvasWidth, canvasHeight);

            // Apply multiple updates (clouds may be recycled)
            for (const dt of deltaTimes) {
              cloudSystem.update(dt, pipeSpeed);
            }

            // After updates, invariants must still hold
            expect(cloudSystem.clouds.length).toBeGreaterThanOrEqual(GAME_CONFIG.MIN_CLOUDS);

            for (const cloud of cloudSystem.clouds) {
              expect(cloud.opacity).toBeGreaterThanOrEqual(GAME_CONFIG.CLOUD_MIN_OPACITY);
              expect(cloud.opacity).toBeLessThanOrEqual(GAME_CONFIG.CLOUD_MAX_OPACITY);
              expect(cloud.speedFactor).toBeGreaterThanOrEqual(GAME_CONFIG.CLOUD_MIN_SPEED);
              expect(cloud.speedFactor).toBeLessThanOrEqual(GAME_CONFIG.CLOUD_MAX_SPEED);
            }
          }
        ),
        { numRuns: 200 }
      );
    });
  });

});
