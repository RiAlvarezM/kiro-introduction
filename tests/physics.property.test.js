import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

const { GAME_CONFIG, Player, lerp } = require('../game.js');

/**
 * Creates a mock sprite image object for Player constructor.
 */
function createMockSprite(width = 32, height = 32) {
  return { width, height };
}

/**
 * Arbitrary for positive delta time values (reasonable game frame durations).
 * Uses double arbitrary to avoid 32-bit float constraint issues.
 */
const dtArb = fc.double({ min: 0.001, max: 0.1, noNaN: true, noDefaultInfinity: true });

/**
 * Arbitrary for velocity values within the valid game range.
 */
const velocityArb = fc.double({ min: -300, max: 500, noNaN: true, noDefaultInfinity: true });

/**
 * Arbitrary for y position values.
 */
const positionArb = fc.double({ min: 0, max: 600, noNaN: true, noDefaultInfinity: true });

describe('Physics Property Tests', () => {

  /**
   * Property 1: Physics Update Correctness
   * For any initial velocity v, position y, and positive delta time dt,
   * after a physics update without jump input, the new velocity should equal
   * v + 980 * dt (clamped to velocity bounds) and the new position should equal
   * y + newVelocity * dt.
   *
   * **Validates: Requirements 2.1, 2.6, 2.8**
   */
  describe('Property 1: Physics Update Correctness', () => {
    it('velocity = v + 980*dt (clamped) and position = y + newVelocity*dt', () => {
      fc.assert(
        fc.property(
          velocityArb,   // initial velocity
          positionArb,   // initial y position
          dtArb,         // deltaTime (positive, reasonable)
          (initialVelocity, initialY, dt) => {
            const canvasWidth = 800;
            const canvasHeight = 600;
            const sprite = createMockSprite();
            const player = new Player(sprite, canvasWidth, canvasHeight);

            // Set initial state
            player.velocity = initialVelocity;
            player.y = initialY;

            // Perform update
            player.update(dt);

            // Expected velocity: v + gravity * dt, clamped to [-300, 500]
            const rawVelocity = initialVelocity + GAME_CONFIG.GRAVITY * dt;
            const expectedVelocity = Math.max(
              GAME_CONFIG.MAX_UP_VELOCITY,
              Math.min(rawVelocity, GAME_CONFIG.TERMINAL_VELOCITY)
            );

            // Expected position: y + newVelocity * dt
            const expectedY = initialY + expectedVelocity * dt;

            expect(player.velocity).toBeCloseTo(expectedVelocity, 5);
            expect(player.y).toBeCloseTo(expectedY, 5);
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  /**
   * Property 2: Jump Impulse Override
   * For any current vertical velocity (positive or negative), when a jump is executed,
   * the resulting velocity should be exactly -300 px/s regardless of the previous velocity value.
   *
   * **Validates: Requirements 2.2**
   */
  describe('Property 2: Jump Impulse Override', () => {
    it('jump always sets velocity to -300 regardless of current velocity', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true }),
          (currentVelocity) => {
            const canvasWidth = 800;
            const canvasHeight = 600;
            const sprite = createMockSprite();
            const player = new Player(sprite, canvasWidth, canvasHeight);

            // Set arbitrary velocity
            player.velocity = currentVelocity;

            // Execute jump
            player.jump();

            // Velocity should always be exactly JUMP_IMPULSE (-300)
            expect(player.velocity).toBe(GAME_CONFIG.JUMP_IMPULSE);
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  /**
   * Property 3: Velocity Bounds Invariant
   * For any sequence of physics updates and jump inputs applied to the player,
   * the vertical velocity should always remain within the range [-300, 500] px/s inclusive.
   *
   * **Validates: Requirements 2.3, 2.4**
   */
  describe('Property 3: Velocity Bounds Invariant', () => {
    it('velocity stays in [-300, 500] for any sequence of updates/jumps', () => {
      const actionArb = fc.oneof(
        fc.record({
          type: fc.constant('update'),
          dt: dtArb
        }),
        fc.record({
          type: fc.constant('jump'),
          dt: fc.constant(0)
        })
      );

      fc.assert(
        fc.property(
          fc.array(actionArb, { minLength: 1, maxLength: 50 }),
          (actions) => {
            const canvasWidth = 800;
            const canvasHeight = 600;
            const sprite = createMockSprite();
            const player = new Player(sprite, canvasWidth, canvasHeight);

            for (const action of actions) {
              if (action.type === 'update') {
                player.update(action.dt);
              } else {
                player.jump();
              }

              // After every action, velocity must be within bounds
              expect(player.velocity).toBeGreaterThanOrEqual(GAME_CONFIG.MAX_UP_VELOCITY);
              expect(player.velocity).toBeLessThanOrEqual(GAME_CONFIG.TERMINAL_VELOCITY);
            }
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  /**
   * Property 4: Linear Interpolation Correctness
   * For any previous position a, current position b, and interpolation factor alpha in [0, 1],
   * the lerp result should always be between min(a, b) and max(a, b) inclusive.
   *
   * **Validates: Requirements 2.5**
   */
  describe('Property 4: Linear Interpolation Correctness', () => {
    it('lerp(a, b, alpha) is always between min(a,b) and max(a,b)', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -10000, max: 10000, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: -10000, max: 10000, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
          (a, b, alpha) => {
            const result = lerp(a, b, alpha);
            const minVal = Math.min(a, b);
            const maxVal = Math.max(a, b);

            // Result should be between min and max (with floating point tolerance)
            expect(result).toBeGreaterThanOrEqual(minVal - 1e-6);
            expect(result).toBeLessThanOrEqual(maxVal + 1e-6);
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  /**
   * Property 5: Player Horizontal Position Invariant
   * For any canvas width, the player's horizontal position should always equal
   * exactly 20% of the canvas width, regardless of game state or elapsed time.
   *
   * **Validates: Requirements 2.7**
   */
  describe('Property 5: Player Horizontal Position Invariant', () => {
    it('x always equals 20% of canvas width after any sequence of updates/jumps', () => {
      const actionArb = fc.oneof(
        fc.record({
          type: fc.constant('update'),
          dt: dtArb
        }),
        fc.record({
          type: fc.constant('jump'),
          dt: fc.constant(0)
        })
      );

      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 2000 }),  // canvas width
          fc.integer({ min: 100, max: 2000 }),  // canvas height
          fc.array(actionArb, { minLength: 1, maxLength: 30 }),
          (canvasWidth, canvasHeight, actions) => {
            const sprite = createMockSprite();
            const player = new Player(sprite, canvasWidth, canvasHeight);

            const expectedX = canvasWidth * GAME_CONFIG.PLAYER_X_PERCENT;

            // Initially x should be 20% of canvas width
            expect(player.x).toBeCloseTo(expectedX, 5);

            for (const action of actions) {
              if (action.type === 'update') {
                player.update(action.dt);
              } else {
                player.jump();
              }

              // After every action, x must remain at 20% of canvas width
              expect(player.x).toBeCloseTo(expectedX, 5);
            }
          }
        ),
        { numRuns: 500 }
      );
    });
  });

});
