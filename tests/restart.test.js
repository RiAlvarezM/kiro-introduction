import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  GameState,
  StateManager,
  RestartController,
  Player,
  PipePool,
  PipeSystem,
  DifficultySystem,
  ScoreSystem,
  PauseController,
  GAME_CONFIG
} from '../game.js';

describe('RestartController', () => {
  let stateManager;
  let restartController;
  let mockLocalStorage;

  beforeEach(() => {
    // Set up mock localStorage
    mockLocalStorage = (() => {
      let store = {};
      return {
        getItem: vi.fn((key) => store[key] !== undefined ? store[key] : null),
        setItem: vi.fn((key, value) => { store[key] = String(value); }),
        removeItem: vi.fn((key) => { delete store[key]; }),
        clear: vi.fn(() => { store = {}; })
      };
    })();
    global.localStorage = mockLocalStorage;

    stateManager = new StateManager();
    restartController = new RestartController(stateManager);
  });

  describe('canRestart', () => {
    it('should return false when state is not GAME_OVER', () => {
      // State is INICIO
      expect(restartController.canRestart()).toBe(false);
    });

    it('should return false when state is PLAYING', () => {
      stateManager.transition(GameState.PLAYING);
      expect(restartController.canRestart()).toBe(false);
    });

    it('should return false when state is PAUSED', () => {
      stateManager.transition(GameState.PLAYING);
      stateManager.transition(GameState.PAUSED);
      expect(restartController.canRestart()).toBe(false);
    });

    it('should return false when in GAME_OVER but less than 1 second has elapsed', () => {
      stateManager.transition(GameState.PLAYING);
      stateManager.transition(GameState.GAME_OVER);

      // Immediately after entering GAME_OVER, time in state is ~0ms
      expect(restartController.canRestart()).toBe(false);
    });

    it('should return true when in GAME_OVER and at least 1 second has elapsed', () => {
      stateManager.transition(GameState.PLAYING);
      stateManager.transition(GameState.GAME_OVER);

      // Mock stateEnteredAt to simulate 1 second having passed
      stateManager.stateEnteredAt = Date.now() - GAME_CONFIG.RESTART_DELAY_MS;

      expect(restartController.canRestart()).toBe(true);
    });

    it('should return true when in GAME_OVER and more than 1 second has elapsed', () => {
      stateManager.transition(GameState.PLAYING);
      stateManager.transition(GameState.GAME_OVER);

      // Simulate 2 seconds having passed
      stateManager.stateEnteredAt = Date.now() - 2000;

      expect(restartController.canRestart()).toBe(true);
    });

    it('should return false when exactly at the boundary (just under 1 second)', () => {
      stateManager.transition(GameState.PLAYING);
      stateManager.transition(GameState.GAME_OVER);

      // Simulate 999ms having passed (just under the threshold)
      stateManager.stateEnteredAt = Date.now() - 999;

      expect(restartController.canRestart()).toBe(false);
    });
  });

  describe('performRestart', () => {
    let player;
    let pipeSystem;
    let difficultySystem;
    let scoreSystem;

    beforeEach(() => {
      const mockSprite = { width: 40, height: 40 };
      player = new Player(mockSprite, GAME_CONFIG.BASE_WIDTH, GAME_CONFIG.BASE_HEIGHT);
      pipeSystem = new PipeSystem(new PipePool());
      difficultySystem = new DifficultySystem();
      scoreSystem = new ScoreSystem();
    });

    it('should return false and not restart when canRestart is false', () => {
      // State is INICIO, cannot restart
      const result = restartController.performRestart(player, pipeSystem, difficultySystem, scoreSystem);
      expect(result).toBe(false);
      expect(stateManager.getState()).toBe(GameState.INICIO);
    });

    it('should return false when in GAME_OVER but delay not met', () => {
      stateManager.transition(GameState.PLAYING);
      stateManager.transition(GameState.GAME_OVER);

      // No time has passed
      const result = restartController.performRestart(player, pipeSystem, difficultySystem, scoreSystem);
      expect(result).toBe(false);
      expect(stateManager.getState()).toBe(GameState.GAME_OVER);
    });

    it('should return true and transition to PLAYING when restart is valid', () => {
      stateManager.transition(GameState.PLAYING);
      stateManager.transition(GameState.GAME_OVER);
      stateManager.stateEnteredAt = Date.now() - GAME_CONFIG.RESTART_DELAY_MS;

      const result = restartController.performRestart(player, pipeSystem, difficultySystem, scoreSystem);
      expect(result).toBe(true);
      expect(stateManager.getState()).toBe(GameState.PLAYING);
    });

    it('should reset score to 0 on restart', () => {
      scoreSystem.increment();
      scoreSystem.increment();
      scoreSystem.increment();
      expect(scoreSystem.score).toBe(3);

      stateManager.transition(GameState.PLAYING);
      stateManager.transition(GameState.GAME_OVER);
      stateManager.stateEnteredAt = Date.now() - GAME_CONFIG.RESTART_DELAY_MS;

      restartController.performRestart(player, pipeSystem, difficultySystem, scoreSystem);
      expect(scoreSystem.score).toBe(0);
    });

    it('should reset player velocity to 0 on restart', () => {
      player.velocity = 350;

      stateManager.transition(GameState.PLAYING);
      stateManager.transition(GameState.GAME_OVER);
      stateManager.stateEnteredAt = Date.now() - GAME_CONFIG.RESTART_DELAY_MS;

      restartController.performRestart(player, pipeSystem, difficultySystem, scoreSystem);
      expect(player.velocity).toBe(0);
    });

    it('should reposition player to initial Y position on restart', () => {
      player.y = 100; // moved from initial position

      stateManager.transition(GameState.PLAYING);
      stateManager.transition(GameState.GAME_OVER);
      stateManager.stateEnteredAt = Date.now() - GAME_CONFIG.RESTART_DELAY_MS;

      restartController.performRestart(player, pipeSystem, difficultySystem, scoreSystem);
      expect(player.y).toBe(GAME_CONFIG.BASE_HEIGHT / 2);
    });

    it('should clear all pipes on restart', () => {
      // Generate some pipes
      pipeSystem.update(0.016, 150, 160, 250);
      pipeSystem.update(2.0, 150, 160, 250);
      expect(pipeSystem.activePipes.length).toBeGreaterThan(0);

      stateManager.transition(GameState.PLAYING);
      stateManager.transition(GameState.GAME_OVER);
      stateManager.stateEnteredAt = Date.now() - GAME_CONFIG.RESTART_DELAY_MS;

      restartController.performRestart(player, pipeSystem, difficultySystem, scoreSystem);
      expect(pipeSystem.activePipes).toHaveLength(0);
    });

    it('should reset difficulty to base values on restart', () => {
      difficultySystem.update(50); // increase difficulty
      expect(difficultySystem.speed).toBeGreaterThan(GAME_CONFIG.BASE_SPEED);

      stateManager.transition(GameState.PLAYING);
      stateManager.transition(GameState.GAME_OVER);
      stateManager.stateEnteredAt = Date.now() - GAME_CONFIG.RESTART_DELAY_MS;

      restartController.performRestart(player, pipeSystem, difficultySystem, scoreSystem);
      expect(difficultySystem.speed).toBe(GAME_CONFIG.BASE_SPEED);
      expect(difficultySystem.gap).toBe(GAME_CONFIG.BASE_GAP);
      expect(difficultySystem.spacing).toBe(GAME_CONFIG.BASE_SPACING);
    });

    it('should preserve high score after restart', () => {
      // Set a high score
      scoreSystem.score = 0;
      for (let i = 0; i < 25; i++) {
        scoreSystem.increment();
      }
      expect(scoreSystem.highScore).toBe(25);

      stateManager.transition(GameState.PLAYING);
      stateManager.transition(GameState.GAME_OVER);
      stateManager.stateEnteredAt = Date.now() - GAME_CONFIG.RESTART_DELAY_MS;

      restartController.performRestart(player, pipeSystem, difficultySystem, scoreSystem);

      // Score should be 0 but high score preserved (loaded from localStorage)
      expect(scoreSystem.score).toBe(0);
      expect(scoreSystem.highScore).toBe(25);
    });
  });

  describe('Game Over stops scrolling and pipe generation', () => {
    it('PauseController.shouldUpdate returns false during GAME_OVER, preventing pipe updates', () => {
      const pauseController = new PauseController(stateManager);

      stateManager.transition(GameState.PLAYING);
      expect(pauseController.shouldUpdate()).toBe(true);

      stateManager.transition(GameState.GAME_OVER);
      expect(pauseController.shouldUpdate()).toBe(false);
    });

    it('pipes do not move when shouldUpdate is false (GAME_OVER state)', () => {
      const pauseController = new PauseController(stateManager);
      const pool = new PipePool();
      const pipeSystem = new PipeSystem(pool);

      stateManager.transition(GameState.PLAYING);

      // Generate pipes
      pipeSystem.update(0.016, 150, 160, 250);
      const pipeXBefore = pipeSystem.activePipes[0].x;

      // Transition to GAME_OVER
      stateManager.transition(GameState.GAME_OVER);

      // Simulate game loop: only update if shouldUpdate
      if (pauseController.shouldUpdate()) {
        pipeSystem.update(1.0, 150, 160, 250);
      }

      expect(pipeSystem.activePipes[0].x).toBe(pipeXBefore);
    });
  });
});
