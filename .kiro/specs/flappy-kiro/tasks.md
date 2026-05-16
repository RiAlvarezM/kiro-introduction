# Implementation Plan: Flappy Kiro

## Overview

Implement a Flappy Bird-style side-scroller game using HTML5 Canvas and vanilla JavaScript. The game features a ghost character ("Flappy") navigating through pipes with progressive difficulty, a Panama City cartoon background with parallax, anime/retro visual style, audio effects, and localStorage-based high score persistence. All code resides in a single `game.js` file with an `index.html` entry point, runnable directly in the browser without a server or bundler.

## Tasks

- [ ] 1. Set up project structure, HTML entry point, and core game engine
  - [ ] 1.1 Create index.html with Canvas element and game.js script tag
    - Set up HTML5 boilerplate with a full-viewport canvas element
    - Include meta viewport tag for responsive scaling
    - Link to game.js as a module or script
    - _Requirements: 1.1, 9.6, 10.3, 10.4_

  - [ ] 1.2 Implement GAME_CONFIG constants and shared data types
    - Define the GAME_CONFIG object with all constants from the design (physics, pipes, difficulty, performance, audio, canvas)
    - Implement Rect and Circle interfaces/types
    - Implement `circleRectCollision()` and `checkBoundaryCollision()` utility functions
    - _Requirements: 2.1, 4.1, 4.2, 4.3, 4.6_

  - [ ] 1.3 Implement StateManager with valid state transitions
    - Create StateManager class with states: Inicio, Playing, Paused, Game_Over
    - Implement `transition()` method enforcing valid transitions per the state diagram
    - Track `stateEnteredAt` timestamp for time-gated transitions
    - _Requirements: 7.1_

  - [ ] 1.4 Implement GameEngine skeleton with game loop
    - Create GameEngine class with `init()`, `start()`, `reset()`, `loop()`, `update()`, `render()` methods
    - Implement requestAnimationFrame-based game loop with delta time calculation
    - Clamp deltaTime to max 1/30s to handle inactive tabs
    - Skip frames with deltaTime <= 0
    - _Requirements: 10.1, 10.2_

- [ ] 2. Implement player physics and input handling
  - [ ] 2.1 Implement Player class with gravity, jump, and velocity clamping
    - Create Player class with position, velocity, sprite properties
    - Implement `applyGravity(deltaTime)` with 980 px/s² acceleration
    - Implement `jump()` setting velocity to -300 px/s regardless of current velocity
    - Clamp velocity to [-300, 500] px/s range
    - Implement `update(deltaTime)` updating position with `y += velocity * deltaTime`
    - Keep player at fixed horizontal position (20% of canvas width)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6, 2.7, 2.8_

  - [ ]* 2.2 Write property tests for physics (Properties 1-3)
    - **Property 1: Physics Update Correctness** - verify velocity = v + 980*dt (clamped) and position = y + newVelocity*dt
    - **Property 2: Jump Impulse Override** - verify jump always sets velocity to -300 regardless of previous value
    - **Property 3: Velocity Bounds Invariant** - verify velocity always in [-300, 500] for any sequence of updates/jumps
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.6, 2.8**

  - [ ] 2.3 Implement InputHandler class for keyboard and mouse events
    - Bind Space key and click for jump/start/restart
    - Bind P and Escape keys for pause/resume
    - Implement `bind()` and `unbind()` methods
    - Route inputs to appropriate callbacks based on current game state
    - _Requirements: 1.3, 7.2, 7.5, 7.9_

  - [ ]* 2.4 Write property tests for player position and interpolation (Properties 4-5)
    - **Property 4: Linear Interpolation Correctness** - verify lerp(a, b, alpha) = a + (b-a)*alpha and result is between min(a,b) and max(a,b)
    - **Property 5: Player Horizontal Position Invariant** - verify player X always equals 20% of canvas width
    - **Validates: Requirements 2.5, 2.7**

- [ ] 3. Implement pipe system with object pooling and difficulty scaling
  - [ ] 3.1 Implement ObjectPool and PipePool classes
    - Create generic ObjectPool with `acquire()`, `release()`, `prewarm()` methods
    - Create PipePool extending ObjectPool with `spawn()` method for pipe configuration
    - Pre-warm pool with 10 pipe objects at initialization
    - _Requirements: 3.1, 3.5_

  - [ ] 3.2 Implement PipeSystem for pipe generation, movement, and cleanup
    - Create PipeSystem class managing active pipes array
    - Generate pipe pairs with gap center between 20%-80% of canvas height
    - Set pipe width to 60px, initial gap to 160px, initial spacing to 250px
    - Move pipes left at current speed * deltaTime
    - Remove pipes when fully off-screen (x + width < 0) by releasing to pool
    - Implement `checkScore()` to detect when player passes a pipe
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 3.3 Write property tests for pipes (Properties 7-8)
    - **Property 7: Pipe Gap Center Range** - verify gap center is between 20% and 80% of canvas height
    - **Property 8: Pipe Movement and Cleanup** - verify pipes move by speed*dt and are removed when off-screen
    - **Validates: Requirements 3.3, 3.4, 3.5**

  - [ ] 3.4 Implement DifficultySystem with progressive scaling
    - Create DifficultySystem class calculating speed, gap, and spacing based on score
    - Speed: min(150 * (1 + floor(score/5) * 0.05), 300) px/s
    - Gap: max(160 - floor(score/10) * 5, 100) px
    - Spacing: max(250 - floor(score/10) * 10, 180) px
    - Implement `reset()` to restore base values
    - _Requirements: 3.7, 3.8, 3.9, 3.10_

  - [ ]* 3.5 Write property test for difficulty scaling (Property 6)
    - **Property 6: Difficulty Scaling Correctness** - verify speed/gap/spacing formulas and bounds for any score 0-9999
    - **Validates: Requirements 3.7, 3.8, 3.9**

- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement collision detection and scoring
  - [ ] 5.1 Implement collision detection (circle-rect and boundary)
    - Implement `circleRectCollision()` using nearest-point-on-rect algorithm
    - Implement `checkBoundaryCollision()` for ceiling (cy - r <= 0) and ground (cy + r >= canvasHeight)
    - Define player hitbox as circle with radius = min(width, height) * 0.4
    - Integrate collision checks into game loop, triggering Game_Over on collision
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6_

  - [ ]* 5.2 Write property tests for collision detection (Properties 9-10)
    - **Property 9: Circle-Rectangle Collision Detection** - verify collision iff distance from center to nearest rect point <= radius
    - **Property 10: Boundary Collision Detection** - verify ceiling collision iff cy-r<=0, ground collision iff cy+r>=canvasHeight
    - **Validates: Requirements 4.1, 4.2, 4.3**

  - [ ] 5.3 Implement ScoreSystem with localStorage persistence
    - Create ScoreSystem class with `increment()`, `reset()`, `loadHighScore()`, `saveHighScore()`
    - Cap score at 9999
    - Load high score from localStorage with validation (integer 0-9999), default to 0
    - Save high score on new record, wrap in try/catch for unavailable localStorage
    - _Requirements: 6.1, 6.4, 6.5, 6.6_

  - [ ]* 5.4 Write property tests for scoring (Properties 11-12)
    - **Property 11: Score Increment and Cap** - verify increment produces min(score+1, 9999) and never exceeds 9999
    - **Property 12: High Score Persistence Round-Trip** - verify save/load round-trip and invalid data handling
    - **Validates: Requirements 6.1, 6.4, 6.5, 6.6**

- [ ] 6. Implement game state management (pause, game over, restart)
  - [ ] 6.1 Implement pause functionality with state freeze
    - Freeze all physics, pipe movement, clouds, and background when Paused
    - Ignore jump inputs during Paused state (only P/Escape/click to resume)
    - Resume from exact frozen state
    - _Requirements: 7.2, 7.3, 7.5, 7.6, 7.12_

  - [ ] 6.2 Implement Game Over state with time-gated restart
    - Stop scrolling and pipe generation on Game_Over
    - Enforce 1-second delay before accepting restart input
    - On restart: reset score to 0, player to initial position, velocity to 0, clear pipes, reset difficulty, preserve high score
    - _Requirements: 7.7, 7.9, 7.10, 7.11_

  - [ ]* 6.3 Write property tests for state management (Properties 13-16)
    - **Property 13: State Freeze in Non-Playing States** - verify no position/velocity changes during Paused or Game_Over updates
    - **Property 14: Pause/Resume Round-Trip** - verify exact state preservation through pause/resume cycle
    - **Property 15: Game Over Time Gate** - verify restart ignored before 1s, accepted after 1s
    - **Property 16: Reset Completeness** - verify all values return to initial state after reset
    - **Validates: Requirements 7.3, 7.5, 7.6, 7.7, 7.9, 7.10, 7.11**

- [ ] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement rendering system (background, pipes, clouds, player, HUD)
  - [ ] 8.1 Implement Background class with Panama City skyline and parallax
    - Draw programmatic Panama City cartoon skyline using Canvas 2D API
    - Use sky color #87CEEB as base
    - Scroll at 30% of pipe speed (parallax)
    - Implement seamless wrapping (scrollX modulo background width)
    - Retro/hand-drawn visual style
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 8.2 Write property test for background parallax (Property 17)
    - **Property 17: Background Parallax and Wrapping** - verify scroll speed is 30% of pipe speed and wrapping produces valid offset
    - **Validates: Requirements 8.3, 8.4**

  - [ ] 8.3 Implement CloudSystem with multi-layer parallax
    - Create CloudSystem maintaining at least 3 clouds
    - Each cloud has opacity in [0.4, 0.7] and speed factor in [0.1, 0.5] relative to pipe speed
    - Ensure varied speed factors for depth effect
    - Draw clouds with soft edges and rounded organic shapes (anime style)
    - Recycle clouds that exit screen
    - _Requirements: 9.2, 9.3_

  - [ ]* 8.4 Write property test for cloud system (Property 18)
    - **Property 18: Cloud System Invariants** - verify min 3 clouds, opacity in [0.4, 0.7], speed in [0.1, 0.5], varied speeds
    - **Validates: Requirements 9.2, 9.3**

  - [ ] 8.5 Implement pipe rendering with anime style
    - Render pipes with green fill, darker border (min 2px), and cap segment at open end
    - Use BatchRenderer with pre-rendered offscreen canvas for pipe segments
    - _Requirements: 9.1_

  - [ ] 8.6 Implement HUD rendering (score, high score, game state overlays)
    - Render dark opaque bar (30-60px height) at bottom of screen
    - Display "Score: X" on bottom-left, "High: X" on bottom-right
    - Show game state overlays: title screen, "PAUSED" overlay, Game Over screen with scores and restart instruction
    - _Requirements: 6.2, 6.3, 6.7, 7.4, 7.8, 1.2_

  - [ ] 8.7 Implement render layer ordering and canvas scaling
    - Render in order: sky → city background → pipes → clouds → Flappy → HUD
    - Implement 4:3 aspect ratio scaling on window resize
    - Base resolution 800x600, scale proportionally without distortion
    - _Requirements: 8.6, 9.6, 9.7_

  - [ ]* 8.8 Write property test for canvas scaling (Property 19)
    - **Property 19: Canvas Aspect Ratio Scaling** - verify 4:3 ratio maintained and canvas fits within window
    - **Validates: Requirements 9.7**

- [ ] 9. Implement audio system and asset loading
  - [ ] 9.1 Implement AudioSystem with preloading and autoplay handling
    - Create AudioSystem using Web Audio API (AudioContext + AudioBuffer)
    - Preload jump.wav and game_over.wav during initialization
    - Implement `unlock()` to resume AudioContext on first user interaction
    - Allow concurrent playback of jump sounds
    - Silence audio during Paused state
    - Wrap all playback in try/catch for graceful failure
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ] 9.2 Implement asset loading with timeout and error handling
    - Load ghosty.png sprite and audio files with Promise.race against 10s timeout
    - Show error message on canvas if any asset fails to load
    - Only show start screen after all assets loaded successfully
    - _Requirements: 1.4, 1.5, 1.6_

- [ ] 10. Implement performance optimizations (BatchRenderer, object pooling, PerformanceMonitor)
  - [ ] 10.1 Implement BatchRenderer with offscreen canvas pre-rendering
    - Create BatchRenderer class grouping draw calls by context state
    - Pre-render pipe segments and clouds on offscreen canvases
    - Minimize fillStyle/strokeStyle changes and save/restore calls
    - _Requirements: 10.1_

  - [ ] 10.2 Implement PerformanceMonitor for FPS tracking
    - Create PerformanceMonitor with ring buffer of last 60 frame times
    - Calculate rolling FPS average
    - Detect performance degradation (FPS < 45 for 10+ frames)
    - _Requirements: 10.1_

- [ ] 11. Wire all systems together and integration
  - [ ] 11.1 Wire GameEngine to orchestrate all subsystems
    - Connect GameEngine.init() to load assets and initialize all subsystems
    - Wire game loop: Input → State check → Update (physics, pipes, difficulty, clouds, background) → Collision → Render
    - Connect InputHandler callbacks to appropriate state transitions and player actions
    - Connect ScoreSystem to PipeSystem score detection
    - Connect DifficultySystem to PipeSystem speed/gap/spacing
    - Connect AudioSystem to jump and game over events
    - _Requirements: 1.1, 1.3, 10.1, 10.2, 10.3, 10.4_

  - [ ]* 11.2 Write unit tests for integration scenarios
    - Test full game initialization flow
    - Test state transitions (Inicio → Playing → Paused → Playing → Game_Over → Playing)
    - Test score increment on pipe pass
    - Test difficulty update on score change
    - Test audio triggers on jump and game over
    - _Requirements: 1.3, 6.1, 7.1, 5.1, 5.2_

- [ ] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All code goes in a single `game.js` file with `index.html` as entry point
- Testing uses Vitest + fast-check (installed as dev dependencies, not bundled with the game)
- The game itself has zero external dependencies and runs by opening index.html directly

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4"] },
    { "id": 2, "tasks": ["2.1", "2.3", "3.1"] },
    { "id": 3, "tasks": ["2.2", "2.4", "3.2", "3.4"] },
    { "id": 4, "tasks": ["3.3", "3.5", "5.1", "5.3"] },
    { "id": 5, "tasks": ["5.2", "5.4", "6.1", "6.2"] },
    { "id": 6, "tasks": ["6.3"] },
    { "id": 7, "tasks": ["8.1", "8.3", "8.5", "8.6", "9.1", "9.2"] },
    { "id": 8, "tasks": ["8.2", "8.4", "8.7", "8.8", "10.1", "10.2"] },
    { "id": 9, "tasks": ["11.1"] },
    { "id": 10, "tasks": ["11.2"] }
  ]
}
```
