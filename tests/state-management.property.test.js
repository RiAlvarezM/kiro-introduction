import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';

const {
  GAME_CONFIG,
  GameState,
  StateManager,
  PauseController,
  Player,
  PipePool,
  PipeSystem,
  DifficultySystem,
  ScoreSystem
} = require('../game.js');

/**
 * Mock localStorage for testing.
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

describe('State Management Property Tests', () => {

  beforeEach(() => {
    const mockStorage = createMockLocalStorage();
    vi.stubGlobal('localStorage', mockStorage);
  });

  /**
   * Property 13: State Freeze in Non-Playing States
   * For any complete game state (player position, velocity, pipe positions) while in
   * Paused or Game_Over state, calling update with any positive delta time should produce
   * no change to any position or velocity value.
   *
   * **Validates: Requirements 7.3, 7.7**
   */
  describe('Property 13: State Freeze in Non-Playing States', () => {
    it('player position and velocity unchanged during PAUSED state for any deltaTime', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.001, max: 2.0, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: -300, max: 500, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: 0, max: 600, noNaN: true, noDefaultInfinity: true }),
          (deltaTime, initialVelocity, initialY) => {
            const mockSprite = { width: 40, height: 40 };
            const player = new Player(mockSprite, GAME_CONFIG.BASE_WIDTH, GAME_CONFIG.BASE_HEIGHT);
            player.velocity = initialVelocity;
            player.y = initialY;

            const stateManager = new StateManager();
            const pauseController = new PauseController(stateManager);

            // Transition to Playing then Paused
            stateManager.transition(GameState.PLAYING);
            stateManager.transition(GameState.PAUSED);

            const yBefore = player.y;
            const velocityBefore = player.velocity;

            // Simulate game loop: only update if shouldUpdate() returns true
            if (pauseController.shouldUpdate()) {
              player.update(deltaTime);
            }

            expect(player.y).toBe(yBefore);
            expect(player.velocity).toBe(velocityBefore);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('player position and velocity unchanged during GAME_OVER state for any deltaTime', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.001, max: 2.0, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: -300, max: 500, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: 0, max: 600, noNaN: true, noDefaultInfinity: true }),
          (deltaTime, initialVelocity, initialY) => {
            const mockSprite = { width: 40, height: 40 };
            const player = new Player(mockSprite, GAME_CONFIG.BASE_WIDTH, GAME_CONFIG.BASE_HEIGHT);
            player.velocity = initialVelocity;
            player.y = initialY;

            const stateManager = new StateManager();
            const pauseController = new PauseController(stateManager);

            // Transition to Playing then Game_Over
            stateManager.transition(GameState.PLAYING);
            stateManager.transition(GameState.GAME_OVER);

            const yBefore = player.y;
            const velocityBefore = player.velocity;

            // Simulate game loop: only update if shouldUpdate() returns true
            if (pauseController.shouldUpdate()) {
              player.update(deltaTime);
            }

            expect(player.y).toBe(yBefore);
            expect(player.velocity).toBe(velocityBefore);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('pipe positions unchanged during PAUSED state for any deltaTime and speed', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.001, max: 2.0, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: 50, max: 300, noNaN: true, noDefaultInfinity: true }),
          (deltaTime, speed) => {
            const pool = new PipePool();
            const pipeSystem = new PipeSystem(pool);

            const stateManager = new StateManager();
            const pauseController = new PauseController(stateManager);

            // Transition to Playing and spawn pipes
            stateManager.transition(GameState.PLAYING);
            pipeSystem.update(0.016, speed, 160, 250);

            // Record pipe positions
            const pipePositionsBefore = pipeSystem.activePipes.map(p => p.x);

            // Transition to Paused
            stateManager.transition(GameState.PAUSED);

            // Simulate game loop: only update if shouldUpdate() returns true
            if (pauseController.shouldUpdate()) {
              pipeSystem.update(deltaTime, speed, 160, 250);
            }

            // Verify positions unchanged
            pipeSystem.activePipes.forEach((pipe, i) => {
              expect(pipe.x).toBe(pipePositionsBefore[i]);
            });
          }
        ),
        { numRuns: 500 }
      );
    });

    it('pipe positions unchanged during GAME_OVER state for any deltaTime and speed', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.001, max: 2.0, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: 50, max: 300, noNaN: true, noDefaultInfinity: true }),
          (deltaTime, speed) => {
            const pool = new PipePool();
            const pipeSystem = new PipeSystem(pool);

            const stateManager = new StateManager();
            const pauseController = new PauseController(stateManager);

            // Transition to Playing and spawn pipes
            stateManager.transition(GameState.PLAYING);
            pipeSystem.update(0.016, speed, 160, 250);

            // Record pipe positions
            const pipePositionsBefore = pipeSystem.activePipes.map(p => p.x);

            // Transition to Game_Over
            stateManager.transition(GameState.GAME_OVER);

            // Simulate game loop: only update if shouldUpdate() returns true
            if (pauseController.shouldUpdate()) {
              pipeSystem.update(deltaTime, speed, 160, 250);
            }

            // Verify positions unchanged
            pipeSystem.activePipes.forEach((pipe, i) => {
              expect(pipe.x).toBe(pipePositionsBefore[i]);
            });
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  /**
   * Property 14: Pause/Resume Round-Trip
   * For any game state in Playing mode, transitioning to Paused and then back to Playing
   * should preserve the exact player position, player velocity, pipe positions, score,
   * and difficulty parameters without any modification.
   *
   * **Validates: Requirements 7.5, 7.6**
   */
  describe('Property 14: Pause/Resume Round-Trip', () => {
    it('Playing→Paused→Playing preserves player position and velocity exactly', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -300, max: 500, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: 10, max: 590, noNaN: true, noDefaultInfinity: true }),
          fc.integer({ min: 1, max: 100 }),
          (velocity, yPosition, pausedFrames) => {
            const mockSprite = { width: 40, height: 40 };
            const player = new Player(mockSprite, GAME_CONFIG.BASE_WIDTH, GAME_CONFIG.BASE_HEIGHT);
            player.velocity = velocity;
            player.y = yPosition;

            const stateManager = new StateManager();
            const pauseController = new PauseController(stateManager);

            stateManager.transition(GameState.PLAYING);

            // Record state before pause
            const yBefore = player.y;
            const velocityBefore = player.velocity;
            const xBefore = player.x;

            // Pause
            stateManager.transition(GameState.PAUSED);

            // Simulate multiple paused frames
            for (let i = 0; i < pausedFrames; i++) {
              const dt = pauseController.filterDeltaTime(0.016);
              if (pauseController.shouldUpdate()) {
                player.update(dt);
              }
            }

            // Resume
            stateManager.transition(GameState.PLAYING);

            // First frame after resume discards accumulated delta
            const resumeDt = pauseController.filterDeltaTime(pausedFrames * 0.016);
            expect(resumeDt).toBe(0);

            // Verify state is exactly preserved
            expect(player.y).toBe(yBefore);
            expect(player.velocity).toBe(velocityBefore);
            expect(player.x).toBe(xBefore);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('Playing→Paused→Playing preserves pipe positions exactly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          (pausedFrames) => {
            const pool = new PipePool();
            const pipeSystem = new PipeSystem(pool);

            const stateManager = new StateManager();
            const pauseController = new PauseController(stateManager);

            stateManager.transition(GameState.PLAYING);

            // Generate some pipes
            pipeSystem.update(0.016, 150, 160, 250);
            pipeSystem.update(0.5, 150, 160, 250);

            // Record pipe state before pause
            const pipesBefore = pipeSystem.activePipes.map(p => ({
              x: p.x,
              gapCenterY: p.gapCenterY,
              gapSize: p.gapSize,
              scored: p.scored
            }));

            // Pause
            stateManager.transition(GameState.PAUSED);

            // Simulate paused frames
            for (let i = 0; i < pausedFrames; i++) {
              if (pauseController.shouldUpdate()) {
                pipeSystem.update(0.016, 150, 160, 250);
              }
            }

            // Resume
            stateManager.transition(GameState.PLAYING);

            // Verify pipe state is exactly preserved
            expect(pipeSystem.activePipes.length).toBe(pipesBefore.length);
            pipeSystem.activePipes.forEach((pipe, i) => {
              expect(pipe.x).toBe(pipesBefore[i].x);
              expect(pipe.gapCenterY).toBe(pipesBefore[i].gapCenterY);
              expect(pipe.gapSize).toBe(pipesBefore[i].gapSize);
              expect(pipe.scored).toBe(pipesBefore[i].scored);
            });
          }
        ),
        { numRuns: 500 }
      );
    });

    it('Playing→Paused→Playing preserves score and difficulty exactly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 1, max: 50 }),
          (score, pausedFrames) => {
            const scoreSystem = new ScoreSystem();
            const difficulty = new DifficultySystem();

            // Set up game state
            for (let i = 0; i < score; i++) {
              scoreSystem.increment();
            }
            difficulty.update(scoreSystem.score);

            const stateManager = new StateManager();
            const pauseController = new PauseController(stateManager);

            stateManager.transition(GameState.PLAYING);

            // Record state before pause
            const scoreBefore = scoreSystem.score;
            const highScoreBefore = scoreSystem.highScore;
            const speedBefore = difficulty.speed;
            const gapBefore = difficulty.gap;
            const spacingBefore = difficulty.spacing;

            // Pause
            stateManager.transition(GameState.PAUSED);

            // Simulate paused frames (no updates happen)
            for (let i = 0; i < pausedFrames; i++) {
              if (pauseController.shouldUpdate()) {
                // These would not execute during pause
                scoreSystem.increment();
                difficulty.update(scoreSystem.score);
              }
            }

            // Resume
            stateManager.transition(GameState.PLAYING);

            // Verify everything preserved
            expect(scoreSystem.score).toBe(scoreBefore);
            expect(scoreSystem.highScore).toBe(highScoreBefore);
            expect(difficulty.speed).toBe(speedBefore);
            expect(difficulty.gap).toBe(gapBefore);
            expect(difficulty.spacing).toBe(spacingBefore);
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  /**
   * Property 15: Game Over Time Gate
   * For any game in Game_Over state, if the time elapsed since entering Game_Over is
   * less than 1000ms, any restart input should be ignored and the state should remain
   * Game_Over. If the time elapsed is >= 1000ms, restart input should transition to Playing.
   *
   * **Validates: Requirements 7.9, 7.11**
   */
  describe('Property 15: Game Over Time Gate', () => {
    it('restart ignored when time in Game_Over state < 1000ms', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 999 }),
          (elapsedMs) => {
            const stateManager = new StateManager();

            stateManager.transition(GameState.PLAYING);
            stateManager.transition(GameState.GAME_OVER);

            // Mock stateEnteredAt to simulate elapsed time < 1000ms
            stateManager.stateEnteredAt = Date.now() - elapsedMs;

            // Simulate restart logic: only allow restart if time gate passed
            const canRestart = stateManager.getState() === GameState.GAME_OVER &&
              stateManager.getTimeInState() >= GAME_CONFIG.RESTART_DELAY_MS;

            expect(canRestart).toBe(false);
            expect(stateManager.getState()).toBe(GameState.GAME_OVER);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('restart accepted when time in Game_Over state >= 1000ms', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 10000 }),
          (elapsedMs) => {
            const stateManager = new StateManager();

            stateManager.transition(GameState.PLAYING);
            stateManager.transition(GameState.GAME_OVER);

            // Mock stateEnteredAt to simulate elapsed time >= 1000ms
            stateManager.stateEnteredAt = Date.now() - elapsedMs;

            // Simulate restart logic: only allow restart if time gate passed
            const canRestart = stateManager.getState() === GameState.GAME_OVER &&
              stateManager.getTimeInState() >= GAME_CONFIG.RESTART_DELAY_MS;

            expect(canRestart).toBe(true);

            // Perform the transition
            const transitioned = stateManager.transition(GameState.PLAYING);
            expect(transitioned).toBe(true);
            expect(stateManager.getState()).toBe(GameState.PLAYING);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('state remains Game_Over when restart attempted before time gate', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 999 }),
          fc.integer({ min: 1, max: 10 }),
          (elapsedMs, attempts) => {
            const stateManager = new StateManager();

            stateManager.transition(GameState.PLAYING);
            stateManager.transition(GameState.GAME_OVER);

            // Mock stateEnteredAt
            stateManager.stateEnteredAt = Date.now() - elapsedMs;

            // Multiple restart attempts should all be ignored
            for (let i = 0; i < attempts; i++) {
              const canRestart = stateManager.getState() === GameState.GAME_OVER &&
                stateManager.getTimeInState() >= GAME_CONFIG.RESTART_DELAY_MS;

              if (canRestart) {
                stateManager.transition(GameState.PLAYING);
              }
            }

            // State should still be Game_Over
            expect(stateManager.getState()).toBe(GameState.GAME_OVER);
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  /**
   * Property 16: Reset Completeness
   * For any game state (regardless of score, difficulty, player position, or pipe
   * configuration), after a reset operation, the game state should match the initial
   * configuration: score=0, velocity=0, player at initial Y position, no pipes,
   * difficulty at base values (speed=150, gap=160, spacing=250), and high score
   * preserved from localStorage.
   *
   * **Validates: Requirements 7.10**
   */
  describe('Property 16: Reset Completeness', () => {
    it('reset produces initial config regardless of prior game state', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 200 }),
          fc.double({ min: -300, max: 500, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: 0, max: 600, noNaN: true, noDefaultInfinity: true }),
          fc.integer({ min: 0, max: 9999 }),
          (numPipeUpdates, playerVelocity, playerY, highScore) => {
            // Set up a high score in localStorage
            localStorage.setItem(GAME_CONFIG.STORAGE_KEY, String(highScore));

            const mockSprite = { width: 40, height: 40 };
            const player = new Player(mockSprite, GAME_CONFIG.BASE_WIDTH, GAME_CONFIG.BASE_HEIGHT);
            const pool = new PipePool();
            const pipeSystem = new PipeSystem(pool);
            const difficulty = new DifficultySystem();
            const scoreSystem = new ScoreSystem();

            // Set up random game state
            player.velocity = playerVelocity;
            player.y = playerY;

            // Accumulate score and difficulty
            const incrementCount = Math.min(numPipeUpdates, 50);
            for (let i = 0; i < incrementCount; i++) {
              scoreSystem.increment();
            }
            difficulty.update(scoreSystem.score);

            // Generate some pipes
            for (let i = 0; i < Math.min(numPipeUpdates, 5); i++) {
              pipeSystem.update(0.016, difficulty.speed, difficulty.gap, difficulty.spacing);
            }

            // The high score in localStorage is now max(highScore, incrementCount)
            // because increment() saves to localStorage when score > highScore
            const expectedHighScore = Math.min(Math.max(highScore, incrementCount), GAME_CONFIG.MAX_SCORE);

            // Perform reset on all systems (simulating what a restart would do)
            player.reset();
            pipeSystem.reset();
            difficulty.reset();
            scoreSystem.reset();

            // Verify initial config
            expect(scoreSystem.score).toBe(0);
            expect(player.velocity).toBe(0);
            expect(player.y).toBe(GAME_CONFIG.BASE_HEIGHT / 2);
            expect(player.x).toBe(GAME_CONFIG.BASE_WIDTH * GAME_CONFIG.PLAYER_X_PERCENT);
            expect(pipeSystem.activePipes.length).toBe(0);
            expect(difficulty.speed).toBe(GAME_CONFIG.BASE_SPEED);
            expect(difficulty.gap).toBe(GAME_CONFIG.BASE_GAP);
            expect(difficulty.spacing).toBe(GAME_CONFIG.BASE_SPACING);

            // High score preserved (loaded from localStorage which reflects the session's max)
            expect(scoreSystem.highScore).toBe(expectedHighScore);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('reset preserves high score even when current score was higher', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 9999 }),
          fc.integer({ min: 0, max: 9998 }),
          (currentScore, storedHighScore) => {
            // Store a high score
            localStorage.setItem(GAME_CONFIG.STORAGE_KEY, String(storedHighScore));

            const scoreSystem = new ScoreSystem();

            // Increment to reach currentScore
            for (let i = 0; i < currentScore; i++) {
              scoreSystem.increment();
            }

            // The high score should be the max of stored and current
            const expectedHighScore = Math.min(Math.max(currentScore, storedHighScore), GAME_CONFIG.MAX_SCORE);

            // Reset
            scoreSystem.reset();

            // Score resets to 0
            expect(scoreSystem.score).toBe(0);

            // High score is preserved (reloaded from localStorage which was updated during increment)
            expect(scoreSystem.highScore).toBe(expectedHighScore);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('reset clears all pipes regardless of how many were active', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }),
          (numUpdates) => {
            const pool = new PipePool();
            const pipeSystem = new PipeSystem(pool);

            // Generate pipes through multiple updates
            for (let i = 0; i < numUpdates; i++) {
              pipeSystem.update(0.016, 150, 160, 250);
            }

            // There should be at least one pipe
            expect(pipeSystem.activePipes.length).toBeGreaterThan(0);

            // Reset
            pipeSystem.reset();

            // All pipes cleared
            expect(pipeSystem.activePipes.length).toBe(0);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('reset restores base difficulty regardless of prior score', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 9999 }),
          (score) => {
            const difficulty = new DifficultySystem();

            // Apply difficulty for given score
            difficulty.update(score);

            // Reset
            difficulty.reset();

            // Verify base values
            expect(difficulty.speed).toBe(GAME_CONFIG.BASE_SPEED);
            expect(difficulty.gap).toBe(GAME_CONFIG.BASE_GAP);
            expect(difficulty.spacing).toBe(GAME_CONFIG.BASE_SPACING);
          }
        ),
        { numRuns: 500 }
      );
    });
  });

});
