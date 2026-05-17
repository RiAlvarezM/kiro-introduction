import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

const { circleRectCollision, checkBoundaryCollision } = require('../game.js');

/**
 * Arbitrary for circle objects with reasonable game-world values.
 */
const circleArb = fc.record({
  cx: fc.double({ min: -500, max: 1500, noNaN: true, noDefaultInfinity: true }),
  cy: fc.double({ min: -500, max: 1500, noNaN: true, noDefaultInfinity: true }),
  radius: fc.double({ min: 1, max: 200, noNaN: true, noDefaultInfinity: true })
});

/**
 * Arbitrary for rectangle objects with positive width/height.
 */
const rectArb = fc.record({
  x: fc.double({ min: -500, max: 1500, noNaN: true, noDefaultInfinity: true }),
  y: fc.double({ min: -500, max: 1500, noNaN: true, noDefaultInfinity: true }),
  width: fc.double({ min: 1, max: 500, noNaN: true, noDefaultInfinity: true }),
  height: fc.double({ min: 1, max: 500, noNaN: true, noDefaultInfinity: true })
});

/**
 * Arbitrary for canvas height values.
 */
const canvasHeightArb = fc.double({ min: 100, max: 2000, noNaN: true, noDefaultInfinity: true });

describe('Collision Detection Property Tests', () => {

  /**
   * Property 9: Circle-Rectangle Collision Detection
   * For any circle (center cx, cy, radius r) and axis-aligned rectangle (x, y, width, height),
   * the collision function should return true if and only if the distance from the circle's center
   * to the nearest point on the rectangle is less than or equal to the circle's radius.
   * The nearest point is calculated as (clamp(cx, x, x+width), clamp(cy, y, y+height)).
   *
   * **Validates: Requirements 4.1**
   */
  describe('Property 9: Circle-Rectangle Collision Detection', () => {
    it('collision iff distance from circle center to nearest rect point <= radius', () => {
      fc.assert(
        fc.property(
          circleArb,
          rectArb,
          (circle, rect) => {
            // Manually compute the expected collision result
            const nearestX = Math.max(rect.x, Math.min(circle.cx, rect.x + rect.width));
            const nearestY = Math.max(rect.y, Math.min(circle.cy, rect.y + rect.height));
            const dx = circle.cx - nearestX;
            const dy = circle.cy - nearestY;
            const distanceSquared = dx * dx + dy * dy;
            const radiusSquared = circle.radius * circle.radius;

            const expectedCollision = distanceSquared <= radiusSquared;
            const actualCollision = circleRectCollision(circle, rect);

            expect(actualCollision).toBe(expectedCollision);
          }
        ),
        { numRuns: 1000 }
      );
    });

    it('circle fully inside rectangle always collides', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1, max: 100, noNaN: true, noDefaultInfinity: true }),  // radius
          fc.double({ min: 200, max: 500, noNaN: true, noDefaultInfinity: true }), // rect width
          fc.double({ min: 200, max: 500, noNaN: true, noDefaultInfinity: true }), // rect height
          (radius, rectWidth, rectHeight) => {
            // Place circle center at the center of the rectangle
            const rect = { x: 0, y: 0, width: rectWidth, height: rectHeight };
            const circle = { cx: rectWidth / 2, cy: rectHeight / 2, radius };

            // Circle center is inside the rect, so nearest point is the center itself,
            // distance is 0, which is always <= radius
            expect(circleRectCollision(circle, rect)).toBe(true);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('circle far away from rectangle never collides', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1, max: 50, noNaN: true, noDefaultInfinity: true }),   // radius
          fc.double({ min: 1, max: 200, noNaN: true, noDefaultInfinity: true }),  // rect width
          fc.double({ min: 1, max: 200, noNaN: true, noDefaultInfinity: true }),  // rect height
          fc.double({ min: 100, max: 500, noNaN: true, noDefaultInfinity: true }), // extra distance
          (radius, rectWidth, rectHeight, extraDist) => {
            // Place circle far to the right of the rectangle
            const rect = { x: 0, y: 0, width: rectWidth, height: rectHeight };
            const circle = { cx: rectWidth + radius + extraDist, cy: rectHeight / 2, radius };

            expect(circleRectCollision(circle, rect)).toBe(false);
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  /**
   * Property 10: Boundary Collision Detection (Ground/Ceiling)
   * For any player circle (center cy, radius r) and canvas height,
   * a ceiling collision should be detected if and only if cy - r <= 0,
   * and a ground collision should be detected if and only if cy + r >= canvasHeight.
   *
   * **Validates: Requirements 4.2, 4.3**
   */
  describe('Property 10: Boundary Collision Detection', () => {
    it('boundary collision iff cy-r<=0 OR cy+r>=canvasHeight', () => {
      fc.assert(
        fc.property(
          circleArb,
          canvasHeightArb,
          (circle, canvasHeight) => {
            const ceilingCollision = circle.cy - circle.radius <= 0;
            const floorCollision = circle.cy + circle.radius >= canvasHeight;
            const expectedCollision = ceilingCollision || floorCollision;

            const actualCollision = checkBoundaryCollision(circle, canvasHeight);

            expect(actualCollision).toBe(expectedCollision);
          }
        ),
        { numRuns: 1000 }
      );
    });

    it('ceiling collision iff cy - r <= 0', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1, max: 100, noNaN: true, noDefaultInfinity: true }),  // radius
          fc.double({ min: -100, max: 200, noNaN: true, noDefaultInfinity: true }), // cy (can be near ceiling)
          (radius, cy) => {
            // Use a large canvas height so floor collision doesn't interfere
            const canvasHeight = 10000;
            const circle = { cx: 400, cy, radius };

            const expectedCeiling = cy - radius <= 0;
            const actual = checkBoundaryCollision(circle, canvasHeight);

            // If ceiling collision expected, result should be true
            // If no ceiling collision, result depends on floor (which won't happen with canvasHeight=10000)
            if (expectedCeiling) {
              expect(actual).toBe(true);
            } else {
              // No ceiling collision and no floor collision (cy + radius < 10000)
              expect(actual).toBe(false);
            }
          }
        ),
        { numRuns: 500 }
      );
    });

    it('floor collision iff cy + r >= canvasHeight', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1, max: 100, noNaN: true, noDefaultInfinity: true }),  // radius
          fc.double({ min: 400, max: 700, noNaN: true, noDefaultInfinity: true }), // cy (near floor)
          fc.double({ min: 300, max: 600, noNaN: true, noDefaultInfinity: true }), // canvasHeight
          (radius, cy, canvasHeight) => {
            // Use a cy that's far from ceiling (cy > radius always since cy >= 400 and radius <= 100)
            const circle = { cx: 400, cy, radius };

            const expectedFloor = cy + radius >= canvasHeight;
            const expectedCeiling = cy - radius <= 0; // Should be false since cy >= 400 and radius <= 100
            const expectedCollision = expectedCeiling || expectedFloor;
            const actual = checkBoundaryCollision(circle, canvasHeight);

            expect(actual).toBe(expectedCollision);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('circle safely in the middle never collides with boundaries', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1, max: 50, noNaN: true, noDefaultInfinity: true }),   // radius
          fc.double({ min: 200, max: 800, noNaN: true, noDefaultInfinity: true }), // canvasHeight
          (radius, canvasHeight) => {
            // Place circle exactly in the middle of the canvas
            const cy = canvasHeight / 2;
            const circle = { cx: 400, cy, radius };

            // Middle of canvas: cy - r > 0 and cy + r < canvasHeight
            // (since canvasHeight >= 200 and radius <= 50, cy = 100+ and cy-r >= 50 > 0,
            //  cy + r <= canvasHeight/2 + 50 < canvasHeight when canvasHeight >= 200)
            if (cy - radius > 0 && cy + radius < canvasHeight) {
              expect(checkBoundaryCollision(circle, canvasHeight)).toBe(false);
            }
          }
        ),
        { numRuns: 500 }
      );
    });
  });

});
