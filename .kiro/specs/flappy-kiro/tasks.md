# Implementation Plan: Flappy Kiro

## Overview

Implement a Flappy Bird-style side-scroller game set in the Canal de Panamá, using HTML5 Canvas and vanilla JavaScript. The player controls a ghost character ("Flappy") navigating through container ship obstacles. The game features parallax backgrounds, progressive difficulty, audio effects, and localStorage-based high score persistence. All code resides in a single `game.js` file with an `index.html` entry point, runnable directly in the browser without a server or bundler.

## Tasks

- [x] 1. Set up project structure, configuration, and core interfaces
  - [x] 1.1 Create index.html with Canvas element and game.js script tag
    - Create the HTML5 entry point with a `<canvas>` element
    - Link to `game.js` as a module script
    - Include basic CSS for centering the canvas and removing margins
    - _Requirements: 1.1, 10.3, 10.4_

  - [x] 1.2 Create game.js with GAME_CONFIG constants and shared types
    - Define the `GAME_CONFIG` object with all constants from the design (physics, pipes, canvas, theme colors, difficulty, performance, audio)
    - Include Canal de Panamá theme colors: sky #87CEEB, water #2E8B8B, vegetation #228B22, hills #006400
    - Include container ship obstacle config: hull #4A4A4A, container colors [#CC3333, #3366CC, #33AA55, #FF8C00], border #333333, container height 15px, width 60px
    - Implement `circleRectCollision(circle, rect)` and `checkBoundaryCollision(circle, canvasHeight)` utility functions
    - _Requirements: 9.1, 9.5, 9.6, 4.1, 4.2, 4.3_

  - [x] 1.3 Implement StateManager class with valid state transitions
    - Implement states: Inicio, Playing, Paused, Game_Over
    - Enforce valid transitions per the state diagram in the design
    - Track `stateEnteredAt` timestamp for time-gated transitions (Game Over restart delay)
    - _Requirements: 7.1_

- [ ] 2. Implement Player physics and InputHandler
  - [~] 2.1 Implement Player class with gravity, jump, and velocity clamping
    - Apply gravity of 980 px/s² normalized by delta time
    - Jump sets velocity to -300 px/s regardless of current velocity
    - Clamp velocity to [-300, 500] range (max ascent / terminal velocity)
    - Update position using `y += velocity * deltaTime`
    - Keep player at fixed horizontal position (20% of canvas width)
    - Implement `getCollisionCircle()` returning center and radius (min(w,h) * 0.4)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6, 2.7, 2.8_

  - [ ]* 2.2 Write property tests for physics (Properties 1-5)
    - **Property 1: Physics Update Correctness** — verify velocity = v + 980*dt (clamped) and position = y + newVelocity*dt
    - **Property 2: Jump Impulse Override** — verify jump always sets velocity to -300
    - **Property 3: Velocity Bounds Invariant** — verify velocity stays in [-300, 500] for any sequence of updates/jumps
    - **Property 4: Linear Interpolation Correctness** — verify lerp(a, b, alpha) is always between min(a,b) and max(a,b)
    - **Property 5: Player Horizontal Position Invariant** — verify x always equals 20% of canvas width
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8**

  - [~] 2.3 Implement InputHandler class for keyboard and mouse events
    - Listen for Space/Click for jump and game start/restart
    - Listen for P/Escape for pause/resume
    - Expose callbacks: onJump, onPause, onResume, onRestart
    - Bind to canvas element for click events
    - _Requirements: 1.3, 7.2, 7.5, 7.9_

- [ ] 3. Implement PipeSystem (Container Ship obstacles) and DifficultySystem
  - [~] 3.1 Implement ObjectPool and PipePool classes
    - Create generic ObjectPool with acquire/release/prewarm methods
    - Create PipePool extending ObjectPool with spawn() method for configuring recycled pipes
    - Pre-warm with 10 pipe objects at initialization
    - _Requirements: 10.1 (performance)_

  - [~] 3.2 Implement PipeSystem with generation, movement, and cleanup
    - Generate pipe pairs with gap center between 20%-80% of canvas height
    - Move pipes left at current speed * deltaTime
    - Remove (release to pool) pipes that exit left edge (x + width < 0)
    - Track scoring: detect when player passes a pipe pair
    - Initial spacing of 250px between pairs, gap of 160px, speed of 150 px/s
    - Pipe width fixed at 60px
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [~] 3.3 Implement DifficultySystem with progressive scaling
    - Every 5 points: increase speed by 5% (max 200% of base = 300 px/s)
    - Every 10 points: reduce gap by 5px (min 100px)
    - Every 10 points: reduce spacing by 10px (min 180px)
    - Apply changes gradually without perceptible jumps
    - _Requirements: 3.7, 3.8, 3.9, 3.10_

  - [ ]* 3.4 Write property tests for pipes and difficulty (Properties 6-8)
    - **Property 6: Difficulty Scaling Correctness** — verify speed, gap, spacing formulas for any score 0-9999
    - **Property 7: Pipe Gap Center Range** — verify gap center always between 20%-80% of canvas height
    - **Property 8: Pipe Movement and Cleanup** — verify pipes move by speed*dt and are removed when off-screen
    - **Validates: Requirements 3.3, 3.4, 3.5, 3.7, 3.8, 3.9**

- [~] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement collision detection and scoring
  - [~] 5.1 Implement collision detection in GameEngine
    - Use `circleRectCollision` for player circle vs pipe rectangles (top and bottom)
    - Use `checkBoundaryCollision` for ceiling (y=0) and floor (y=canvasHeight) checks
    - Evaluate collisions every frame
    - Trigger Game_Over state on any collision
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6_

  - [ ]* 5.2 Write property tests for collision detection (Properties 9-10)
    - **Property 9: Circle-Rectangle Collision Detection** — verify collision iff distance from circle center to nearest rect point <= radius
    - **Property 10: Boundary Collision Detection** — verify ceiling collision iff cy-r<=0, floor collision iff cy+r>=canvasHeight
    - **Validates: Requirements 4.1, 4.2, 4.3**

  - [~] 5.3 Implement ScoreSystem with localStorage persistence
    - Increment score when player passes a pipe pair (max 9999)
    - Load high score from localStorage on init (default 0 if invalid)
    - Save high score when current score exceeds it
    - Validate stored values: must be integer in [0, 9999]
    - Handle localStorage unavailability gracefully
    - _Requirements: 6.1, 6.4, 6.5, 6.6_

  - [ ]* 5.4 Write property tests for score system (Properties 11-12)
    - **Property 11: Score Increment and Cap** — verify increment produces min(score+1, 9999)
    - **Property 12: High Score Persistence Round-Trip** — verify save/load round-trip for valid values, default 0 for invalid
    - **Validates: Requirements 6.1, 6.4, 6.5, 6.6**

- [ ] 6. Implement game state management (pause, game over, restart)
  - [~] 6.1 Implement pause/resume logic in GameEngine
    - Freeze all simulation (physics, pipes, clouds, background) when Paused
    - Preserve exact positions of all elements
    - Ignore jump inputs (Space/Click) while paused
    - Resume from exact state on P/Escape/Click
    - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.6_

  - [~] 6.2 Implement Game Over and restart logic
    - Stop scrolling and pipe generation on Game Over
    - Enforce 1-second delay before accepting restart input
    - On restart: reset score to 0, velocity to 0, reposition player, clear all pipes, reset difficulty to base values, preserve high score
    - _Requirements: 7.7, 7.8, 7.9, 7.10, 7.11, 7.12_

  - [ ]* 6.3 Write property tests for state management (Properties 13-16)
    - **Property 13: State Freeze in Non-Playing States** — verify no position/velocity changes during Paused or Game_Over updates
    - **Property 14: Pause/Resume Round-Trip** — verify Playing→Paused→Playing preserves all state exactly
    - **Property 15: Game Over Time Gate** — verify restart ignored before 1000ms, accepted after
    - **Property 16: Reset Completeness** — verify reset produces initial config (score=0, velocity=0, no pipes, base difficulty, high score preserved)
    - **Validates: Requirements 7.3, 7.5, 7.6, 7.7, 7.9, 7.10, 7.11**

- [~] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement AudioSystem
  - [~] 8.1 Implement AudioSystem with preloading and playback
    - Preload jump.wav and game_over.wav using Web Audio API (AudioContext + AudioBuffer)
    - Play jump.wav on each jump (allow simultaneous instances for rapid jumps)
    - Play game_over.wav once on Game Over
    - No sound during Paused state
    - Handle AudioContext autoplay policy: unlock on first user interaction
    - Implement 10-second timeout for asset loading with error message on failure
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 1.5, 1.6_

- [ ] 9. Implement rendering system (Background, Clouds, Pipes, HUD)
  - [~] 9.1 Implement Background class with Canal de Panamá parallax scene
    - Render layers in order: sky (#87CEEB), hills (#006400), vegetation (#228B22), water (#2E8B8B)
    - Scroll at 30% of pipe speed for parallax effect
    - Seamless wrapping when scroll completes a cycle
    - Retro hand-drawn style with clean lines and flat colors with subtle gradients
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [~] 9.2 Implement CloudSystem with multi-layer parallax
    - Render at least 3 clouds with soft edges and organic shapes
    - Each cloud has different speed (10%-50% of pipe speed) for depth effect
    - Opacity between 40%-70% (semi-transparent)
    - Recycle clouds that exit left edge
    - _Requirements: 9.2, 9.3_

  - [~] 9.3 Implement container ship rendering with BatchRenderer
    - Render container ships with dark gray hull (#4A4A4A) at the base
    - Stack colored containers (red #CC3333, blue #3366CC, green #33AA55, orange #FF8C00) with 15px height each
    - Draw dark borders (#333333) of 1px between containers
    - Total width 60px per obstacle
    - Pre-render ship segments on OffscreenCanvas for performance
    - Use BatchRenderer to group draw calls by style
    - _Requirements: 9.1, 9.5_

  - [~] 9.4 Implement HUD rendering with score display and state overlays
    - Dark opaque bar (30-60px height) at bottom of screen
    - "Score: [number]" at bottom-left, "High: [number]" at bottom-right
    - Show game state (Playing, Paused, Game Over) visibly
    - Pause overlay: semi-transparent with "PAUSED" text centered
    - Game Over overlay: "Game Over" with final score, high score, and restart instruction
    - Start screen: "Flappy Kiro" title centered with "Press Space or Click to start"
    - _Requirements: 6.2, 6.3, 6.7, 7.4, 7.8, 1.2_

  - [ ]* 9.5 Write property tests for background and clouds (Properties 17-18)
    - **Property 17: Background Parallax and Wrapping** — verify scroll at 30% of pipe speed and seamless wrapping (scrollX mod width in valid range)
    - **Property 18: Cloud System Invariants** — verify ≥3 clouds, opacity in [0.4, 0.7], speed factor in [0.1, 0.5], not all same speed
    - **Validates: Requirements 8.3, 8.4, 9.2, 9.3**

- [ ] 10. Implement canvas scaling and responsive layout
  - [~] 10.1 Implement canvas aspect ratio scaling (4:3)
    - Base resolution 800x600
    - Scale proportionally on window resize without distortion
    - Maintain 4:3 aspect ratio within available window space
    - _Requirements: 9.6, 9.7_

  - [ ]* 10.2 Write property test for canvas scaling (Property 19)
    - **Property 19: Canvas Aspect Ratio Scaling** — verify scaled dimensions maintain 4:3 ratio and fit within window
    - **Validates: Requirements 9.7**

- [ ] 11. Wire GameEngine together and implement game loop
  - [~] 11.1 Implement GameEngine class orchestrating all subsystems
    - Initialize all subsystems (Player, PipeSystem, Background, CloudSystem, HUD, AudioSystem, InputHandler, DifficultySystem, StateManager, ScoreSystem)
    - Load sprite (ghosty.png) and audio assets with 10-second timeout
    - Show error message on canvas if assets fail to load
    - Implement main game loop: Input → Update → Render using requestAnimationFrame
    - Normalize all movement with delta time; clamp deltaTime to max 1/30s for tab-inactive scenarios
    - Wire input callbacks to state transitions and player actions
    - Implement render order: sky → hills → vegetation → water → pipes → clouds → Flappy → HUD
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 10.1, 10.2, 8.6_

  - [ ]* 11.2 Write unit tests for GameEngine initialization and state transitions
    - Test start screen shows title and instruction text
    - Test state transitions follow valid paths
    - Test asset loading timeout triggers error message
    - Test render layer order
    - _Requirements: 1.2, 1.6, 7.1, 8.6_

- [~] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All code is vanilla JavaScript (no frameworks/bundlers) in a single game.js file
- The game must run by opening index.html directly in the browser
- Container ship obstacles use the Canal de Panamá theme with stacked colored containers and dark gray hulls
- Testing uses Vitest + fast-check as specified in the design

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3"] },
    { "id": 4, "tasks": ["3.4", "5.1", "5.3"] },
    { "id": 5, "tasks": ["5.2", "5.4", "6.1"] },
    { "id": 6, "tasks": ["6.2", "6.3"] },
    { "id": 7, "tasks": ["8.1", "9.1", "9.2"] },
    { "id": 8, "tasks": ["9.3", "9.4", "10.1"] },
    { "id": 9, "tasks": ["9.5", "10.2"] },
    { "id": 10, "tasks": ["11.1"] },
    { "id": 11, "tasks": ["11.2"] }
  ]
}
```
