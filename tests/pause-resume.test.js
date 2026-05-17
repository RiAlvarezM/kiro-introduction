import { describe, it, expect, beforeEach } from 'vitest';
import {
  GameState,
  StateManager,
  PauseController,
  Player,
  PipePool,
  PipeSystem,
  DifficultySystem,
  GAME_CONFIG
} from '../game.js';

describe('PauseController', () => {
  let stateManager;
  let pauseController;

  beforeEach(() => {
    stateManager = new StateManager();
    pauseController = new PauseController(stateManager);
  });

  describe('shouldUpdate', () => {
    it('should return false when state is INICIO', () => {
      expect(stateManager.getState()).toBe(GameState.INICIO);
      expect(pauseController.shouldUpdate()).toBe(false);
    });

    it('should return true when state is PLAYING', () => {
      stateManager.transition(GameState.PLAYING);
      expect(pauseController.shouldUpdate()).toBe(true);
    });

    it('should return false when state is PAUSED', () => {
      stateManager.transition(GameState.PLAYING);
      stateManager.transition(GameState.PAUSED);
      expect(pauseController.shouldUpdate()).toBe(false);
    });

    it('should return false when state is GAME_OVER', () => {
      stateManager.transition(GameState.PLAYING);
      stateManager.transition(GameState.GAME_OVER);
      expect(pauseController.shouldUpdate()).toBe(false);
    });
  });

  describe('shouldAcceptJump', () => {
    it('should return false when state is PAUSED', () => {
      stateManager.transition(GameState.PLAYING);
      stateManager.transition(GameState.PAUSED);
      expect(pauseController.shouldAcceptJump()).toBe(false);
    });

    it('should return true when state is PLAYING', () => {
      stateManager.transition(GameState.PLAYING);
      expect(pauseController.shouldAcceptJump()).toBe(true);
    });

    it('should return false when state is INICIO', () => {
      expect(pauseController.shouldAcceptJump()).toBe(false);
    });

    it('should return false when state is GAME_OVER', () => {
      stateManager.transition(GameState.PLAYING);
      stateManager.transition(GameState.GAME_OVER);
      expect(pauseController.shouldAcceptJump()).toBe(false);
    });
  });

  describe('filterDeltaTime', () => {
    it('should return 0 when state is PAUSED', () => {
      stateManager.transition(GameState.PLAYING);
      stateManager.transition(GameState.PAUSED);
      expect(pauseController.filterDeltaTime(0.016)).toBe(0);
    });

    it('should return raw delta time when state is PLAYING and was not paused', () => {
      stateManager.transition(GameState.PLAYING);
      expect(pauseController.filterDeltaTime(0.016)).toBe(0.016);
    });

    it('should return 0 on the first frame after resuming from pause', () => {
      stateManager.transition(GameState.PLAYING);
      stateManager.transition(GameState.PAUSED);

      // Simulate a few frames while paused
      pauseController.filterDeltaTime(0.016);
      pauseController.filterDeltaTime(0.016);

      // Resume
      stateManager.transition(GameState.PLAYING);

      // First frame after resume should discard delta time
      expect(pauseController.filterDeltaTime(2.5)).toBe(0);
    });

    it('should return normal delta time on the second frame after resuming', () => {
      stateManager.transition(GameState.PLAYING);
      stateManager.transition(GameState.PAUSED);

      pauseController.filterDeltaTime(0.016); // paused frame

      // Resume
      stateManager.transition(GameState.PLAYING);

      pauseController.filterDeltaTime(2.5); // first frame after resume → 0
      expect(pauseController.filterDeltaTime(0.016)).toBe(0.016); // second frame → normal
    });

    it('should handle multiple pause/resume cycles correctly', () => {
      stateManager.transition(GameState.PLAYING);
      expect(pauseController.filterDeltaTime(0.016)).toBe(0.016);

      // First pause
      stateManager.transition(GameState.PAUSED);
      expect(pauseController.filterDeltaTime(1.0)).toBe(0);

      // First resume
      stateManager.transition(GameState.PLAYING);
      expect(pauseController.filterDeltaTime(3.0)).toBe(0); // discard
      expect(pauseController.filterDeltaTime(0.016)).toBe(0.016); // normal

      // Second pause
      stateManager.transition(GameState.PAUSED);
      expect(pauseController.filterDeltaTime(5.0)).toBe(0);

      // Second resume
      stateManager.transition(GameState.PLAYING);
      expect(pauseController.filterDeltaTime(7.0)).toBe(0); // discard
      expect(pauseController.filterDeltaTime(0.016)).toBe(0.016); // normal
    });
  });

  describe('reset', () => {
    it('should clear wasPaused flag', () => {
      stateManager.transition(GameState.PLAYING);
      stateManager.transition(GameState.PAUSED);
      pauseController.filterDeltaTime(0.016); // sets wasPaused = true

      pauseController.reset();

      // After reset, even if state is PLAYING, it should not discard delta time
      stateManager.transition(GameState.PLAYING);
      expect(pauseController.filterDeltaTime(0.016)).toBe(0.016);
    });
  });
});

describe('Pause/Resume - State Freeze Verification', () => {
  let stateManager;
  let pauseController;

  beforeEach(() => {
    stateManager = new StateManager();
    pauseController = new PauseController(stateManager);
  });

  describe('Player physics frozen during pause', () => {
    it('should not change player position when paused (update skipped)', () => {
      const mockSprite = { width: 40, height: 40 };
      const player = new Player(mockSprite, GAME_CONFIG.BASE_WIDTH, GAME_CONFIG.BASE_HEIGHT);

      stateManager.transition(GameState.PLAYING);
      stateManager.transition(GameState.PAUSED);

      const positionBefore = player.y;
      const velocityBefore = player.velocity;

      // Simulate what GameEngine would do: check shouldUpdate before calling player.update
      if (pauseController.shouldUpdate()) {
        player.update(0.016);
      }

      expect(player.y).toBe(positionBefore);
      expect(player.velocity).toBe(velocityBefore);
    });

    it('should not change player velocity when paused (update skipped)', () => {
      const mockSprite = { width: 40, height: 40 };
      const player = new Player(mockSprite, GAME_CONFIG.BASE_WIDTH, GAME_CONFIG.BASE_HEIGHT);
      player.velocity = 100; // give it some velocity

      stateManager.transition(GameState.PLAYING);
      stateManager.transition(GameState.PAUSED);

      if (pauseController.shouldUpdate()) {
        player.update(0.5);
      }

      expect(player.velocity).toBe(100);
    });
  });

  describe('Pipe positions frozen during pause', () => {
    it('should not move pipes when paused (update skipped)', () => {
      const pool = new PipePool();
      const pipeSystem = new PipeSystem(pool);

      stateManager.transition(GameState.PLAYING);

      // Spawn some pipes
      pipeSystem.update(0.016, 150, 160, 250);
      const pipeXBefore = pipeSystem.activePipes[0].x;

      // Pause
      stateManager.transition(GameState.PAUSED);

      // Simulate game loop: only update if shouldUpdate
      if (pauseController.shouldUpdate()) {
        pipeSystem.update(1.0, 150, 160, 250);
      }

      expect(pipeSystem.activePipes[0].x).toBe(pipeXBefore);
    });
  });

  describe('Pause/Resume round-trip preserves state', () => {
    it('should preserve exact player position and velocity after pause/resume', () => {
      const mockSprite = { width: 40, height: 40 };
      const player = new Player(mockSprite, GAME_CONFIG.BASE_WIDTH, GAME_CONFIG.BASE_HEIGHT);

      stateManager.transition(GameState.PLAYING);

      // Run a few frames
      player.update(0.016);
      player.update(0.016);

      const positionBeforePause = player.y;
      const velocityBeforePause = player.velocity;

      // Pause
      stateManager.transition(GameState.PAUSED);

      // Simulate several paused frames (game loop calls filterDeltaTime each frame)
      for (let i = 0; i < 100; i++) {
        const dt = pauseController.filterDeltaTime(0.016);
        if (pauseController.shouldUpdate()) {
          player.update(dt);
        }
      }

      // Resume
      stateManager.transition(GameState.PLAYING);

      // First frame after resume: filterDeltaTime discards accumulated time
      const dt = pauseController.filterDeltaTime(5.0); // large raw delta from pause duration
      expect(dt).toBe(0);

      // Player state should be exactly preserved
      expect(player.y).toBe(positionBeforePause);
      expect(player.velocity).toBe(velocityBeforePause);
    });

    it('should preserve exact pipe positions after pause/resume', () => {
      const pool = new PipePool();
      const pipeSystem = new PipeSystem(pool);

      stateManager.transition(GameState.PLAYING);

      // Generate pipes
      pipeSystem.update(0.016, 150, 160, 250);
      pipeSystem.update(0.5, 150, 160, 250);

      const pipePositions = pipeSystem.activePipes.map(p => ({ x: p.x, gapCenterY: p.gapCenterY }));

      // Pause
      stateManager.transition(GameState.PAUSED);

      // Simulate paused frames
      for (let i = 0; i < 50; i++) {
        if (pauseController.shouldUpdate()) {
          pipeSystem.update(0.016, 150, 160, 250);
        }
      }

      // Resume
      stateManager.transition(GameState.PLAYING);

      // Verify positions are exactly preserved
      pipeSystem.activePipes.forEach((pipe, i) => {
        expect(pipe.x).toBe(pipePositions[i].x);
        expect(pipe.gapCenterY).toBe(pipePositions[i].gapCenterY);
      });
    });

    it('should preserve score and difficulty after pause/resume', () => {
      const difficulty = new DifficultySystem();

      stateManager.transition(GameState.PLAYING);

      // Set some difficulty
      difficulty.update(15);
      const speedBefore = difficulty.speed;
      const gapBefore = difficulty.gap;
      const spacingBefore = difficulty.spacing;

      // Pause
      stateManager.transition(GameState.PAUSED);

      // Resume
      stateManager.transition(GameState.PLAYING);

      // Difficulty should be unchanged
      expect(difficulty.speed).toBe(speedBefore);
      expect(difficulty.gap).toBe(gapBefore);
      expect(difficulty.spacing).toBe(spacingBefore);
    });
  });

  describe('Jump inputs ignored during pause', () => {
    it('should not execute jump when paused', () => {
      const mockSprite = { width: 40, height: 40 };
      const player = new Player(mockSprite, GAME_CONFIG.BASE_WIDTH, GAME_CONFIG.BASE_HEIGHT);
      player.velocity = 100;

      stateManager.transition(GameState.PLAYING);
      stateManager.transition(GameState.PAUSED);

      // Simulate what GameEngine would do: check shouldAcceptJump before calling player.jump
      if (pauseController.shouldAcceptJump()) {
        player.jump();
      }

      // Velocity should remain unchanged (jump was not executed)
      expect(player.velocity).toBe(100);
    });

    it('should accept jump after resuming from pause', () => {
      const mockSprite = { width: 40, height: 40 };
      const player = new Player(mockSprite, GAME_CONFIG.BASE_WIDTH, GAME_CONFIG.BASE_HEIGHT);
      player.velocity = 100;

      stateManager.transition(GameState.PLAYING);
      stateManager.transition(GameState.PAUSED);
      stateManager.transition(GameState.PLAYING); // resume

      if (pauseController.shouldAcceptJump()) {
        player.jump();
      }

      expect(player.velocity).toBe(GAME_CONFIG.JUMP_IMPULSE);
    });
  });
});
