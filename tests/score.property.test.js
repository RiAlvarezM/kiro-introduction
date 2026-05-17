import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';

const { GAME_CONFIG, ScoreSystem } = require('../game.js');

/**
 * Mock localStorage for testing high score persistence.
 */
function createMockLocalStorage() {
  const store = {};
  return {
    getItem: vi.fn((key) => store[key] !== undefined ? store[key] : null),
    setItem: vi.fn((key, value) => { store[key] = String(value); }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i) => Object.keys(store)[i] || null),
    _store: store
  };
}

describe('Score System Property Tests', () => {

  beforeEach(() => {
    const mockStorage = createMockLocalStorage();
    vi.stubGlobal('localStorage', mockStorage);
  });

  /**
   * Property 11: Score Increment and Cap
   * For any current score between 0 and 9999, incrementing the score should produce
   * min(score + 1, 9999). The score should never exceed 9999.
   *
   * **Validates: Requirements 6.1**
   */
  describe('Property 11: Score Increment and Cap', () => {
    it('increment produces min(score + 1, 9999) for any score in [0, 9999]', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 9999 }),
          (initialScore) => {
            const scoreSystem = new ScoreSystem();
            scoreSystem.score = initialScore;

            scoreSystem.increment();

            const expectedScore = Math.min(initialScore + 1, GAME_CONFIG.MAX_SCORE);
            expect(scoreSystem.score).toBe(expectedScore);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('score never exceeds 9999 after any number of increments', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 9990, max: 9999 }),
          fc.integer({ min: 1, max: 20 }),
          (initialScore, numIncrements) => {
            const scoreSystem = new ScoreSystem();
            scoreSystem.score = initialScore;

            for (let i = 0; i < numIncrements; i++) {
              scoreSystem.increment();
            }

            expect(scoreSystem.score).toBeLessThanOrEqual(GAME_CONFIG.MAX_SCORE);
            expect(scoreSystem.score).toBe(Math.min(initialScore + numIncrements, GAME_CONFIG.MAX_SCORE));
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  /**
   * Property 12: High Score Persistence Round-Trip
   * For any valid high score value (integer 0-9999), saving to localStorage and then
   * loading should return the same value. For any invalid localStorage content
   * (non-numeric, negative, > 9999, null, undefined), loading should return 0.
   *
   * **Validates: Requirements 6.4, 6.5, 6.6**
   */
  describe('Property 12: High Score Persistence Round-Trip', () => {
    it('save/load round-trip preserves valid high score values', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 9999 }),
          (validHighScore) => {
            const scoreSystem = new ScoreSystem();
            scoreSystem.highScore = validHighScore;

            // Save to localStorage
            scoreSystem.saveHighScore();

            // Create a new ScoreSystem that loads from localStorage
            const loadedSystem = new ScoreSystem();

            expect(loadedSystem.highScore).toBe(validHighScore);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('loading returns 0 for invalid localStorage content', () => {
      const invalidValues = fc.oneof(
        // Non-numeric strings
        fc.string().filter(s => s.length > 0 && isNaN(Number(s))),
        // Negative numbers
        fc.integer({ min: -10000, max: -1 }).map(String),
        // Numbers exceeding MAX_SCORE
        fc.integer({ min: 10000, max: 99999 }).map(String),
        // Floating point numbers (not integers)
        fc.double({ min: 0.1, max: 9998.9, noNaN: true, noDefaultInfinity: true })
          .filter(n => !Number.isInteger(n))
          .map(String)
      );

      fc.assert(
        fc.property(
          invalidValues,
          (invalidValue) => {
            // Directly set invalid value in localStorage
            localStorage.setItem(GAME_CONFIG.STORAGE_KEY, invalidValue);

            const scoreSystem = new ScoreSystem();

            expect(scoreSystem.highScore).toBe(0);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('loading returns 0 when localStorage key is null (not set)', () => {
      // Ensure the key doesn't exist
      localStorage.removeItem(GAME_CONFIG.STORAGE_KEY);

      const scoreSystem = new ScoreSystem();

      expect(scoreSystem.highScore).toBe(0);
    });
  });

});
