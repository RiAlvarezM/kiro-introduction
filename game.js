// ============================================================
// Flappy Kiro - Canal de Panamá Theme
// Single-file game implementation (vanilla JS + HTML5 Canvas)
// ============================================================

// ============================================================
// SECTION: Configuration
// ============================================================

const GAME_CONFIG = {
  // Canvas
  BASE_WIDTH: 800,
  BASE_HEIGHT: 600,
  ASPECT_RATIO: 4/3,

  // Player
  PLAYER_X_PERCENT: 0.20,
  PLAYER_WIDTH: 40,
  PLAYER_HEIGHT: 48,
  GRAVITY: 980,
  JUMP_IMPULSE: -300,
  TERMINAL_VELOCITY: 500,
  MAX_UP_VELOCITY: -300,
  HITBOX_RADIUS_FACTOR: 0.4,

  // Pipes
  PIPE_WIDTH: 60,
  BASE_SPEED: 150,
  BASE_GAP: 160,
  BASE_SPACING: 250,
  MIN_GAP: 100,
  MIN_SPACING: 180,
  MAX_SPEED_MULTIPLIER: 2.0,

  // Difficulty increments
  SPEED_INCREMENT_INTERVAL: 5,
  SPEED_INCREMENT_PERCENT: 0.05,
  GAP_REDUCTION_INTERVAL: 10,
  GAP_REDUCTION_PX: 5,
  SPACING_REDUCTION_INTERVAL: 10,
  SPACING_REDUCTION_PX: 10,

  // Background - Canal de Panamá
  BG_PARALLAX_FACTOR: 0.3,
  SKY_COLOR: '#87CEEB',
  HILLS_COLOR: '#006400',
  VEGETATION_COLOR: '#228B22',
  WATER_COLOR: '#2E8B8B',

  // Portacontenedores (obstáculos)
  SHIP_HULL_COLOR: '#4A4A4A',
  CONTAINER_COLORS: ['#CC3333', '#3366CC', '#33AA55', '#FF8C00'],
  CONTAINER_BORDER_COLOR: '#333333',
  CONTAINER_HEIGHT: 15,

  // Clouds
  MIN_CLOUDS: 3,
  CLOUD_MIN_SPEED: 0.1,
  CLOUD_MAX_SPEED: 0.5,
  CLOUD_MIN_OPACITY: 0.4,
  CLOUD_MAX_OPACITY: 0.7,

  // Score
  MAX_SCORE: 9999,
  STORAGE_KEY: 'flappy_kiro_high_score',

  // Game Over
  RESTART_DELAY_MS: 1000,

  // Asset loading
  ASSET_TIMEOUT_MS: 10000,

  // Performance & Pooling
  TARGET_FPS: 60,
  DEGRADATION_THRESHOLD_FPS: 45,
  PIPE_POOL_INITIAL_SIZE: 10,
  CLOUD_POOL_INITIAL_SIZE: 6,
  USE_OFFSCREEN_CANVAS: true,
  FPS_SAMPLE_SIZE: 60,

  // Audio
  AUDIO_FILES: ['assets/jump.wav', 'assets/game_over.wav'],
  SPRITE_FILE: 'assets/ghosty.png'
};

// ============================================================
// SECTION: Shared Types & Collision Utilities
// ============================================================

/**
 * Detección de colisión círculo vs rectángulo.
 * Encuentra el punto más cercano del rectángulo al centro del círculo,
 * luego verifica si la distancia es menor o igual al radio.
 *
 * @param {{ cx: number, cy: number, radius: number }} circle
 * @param {{ x: number, y: number, width: number, height: number }} rect
 * @returns {boolean}
 */
function circleRectCollision(circle, rect) {
  const nearestX = Math.max(rect.x, Math.min(circle.cx, rect.x + rect.width));
  const nearestY = Math.max(rect.y, Math.min(circle.cy, rect.y + rect.height));
  const dx = circle.cx - nearestX;
  const dy = circle.cy - nearestY;
  return (dx * dx + dy * dy) <= (circle.radius * circle.radius);
}

/**
 * Detección de colisión con límites (suelo/techo) usando hitbox circular.
 *
 * @param {{ cx: number, cy: number, radius: number }} circle
 * @param {number} canvasHeight
 * @returns {boolean}
 */
function checkBoundaryCollision(circle, canvasHeight) {
  return circle.cy - circle.radius <= 0 || circle.cy + circle.radius >= canvasHeight;
}

// ============================================================
// SECTION: Game State Management
// ============================================================

/**
 * Enum de estados del juego.
 */
const GameState = Object.freeze({
  INICIO: 'inicio',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'game_over'
});

/**
 * Mapa de transiciones válidas entre estados.
 * Cada clave es un estado actual, y su valor es un array de estados destino permitidos.
 */
const VALID_TRANSITIONS = Object.freeze({
  [GameState.INICIO]: [GameState.PLAYING],
  [GameState.PLAYING]: [GameState.PAUSED, GameState.GAME_OVER],
  [GameState.PAUSED]: [GameState.PLAYING],
  [GameState.GAME_OVER]: [GameState.PLAYING]
});

/**
 * Gestor de estado del juego.
 * Controla las transiciones entre estados y rastrea el tiempo en el estado actual.
 */
class StateManager {
  constructor() {
    this.currentState = GameState.INICIO;
    this.stateEnteredAt = Date.now();
  }

  /**
   * Intenta transicionar al nuevo estado.
   * @param {string} newState - El estado destino (valor de GameState)
   * @returns {boolean} true si la transición fue válida y se ejecutó, false en caso contrario
   */
  transition(newState) {
    const allowedTransitions = VALID_TRANSITIONS[this.currentState];
    if (!allowedTransitions || !allowedTransitions.includes(newState)) {
      return false;
    }
    this.currentState = newState;
    this.stateEnteredAt = Date.now();
    return true;
  }

  /**
   * Retorna el estado actual del juego.
   * @returns {string}
   */
  getState() {
    return this.currentState;
  }

  /**
   * Retorna el tiempo en milisegundos desde que se entró al estado actual.
   * @returns {number}
   */
  getTimeInState() {
    return Date.now() - this.stateEnteredAt;
  }
}

// ============================================================
// SECTION: Player
// ============================================================

/**
 * Gestiona la física y el estado del personaje Flappy.
 * Usa una hitbox circular para colisiones más precisas con el sprite redondeado del fantasmita.
 */
class Player {
  /**
   * @param {HTMLImageElement} spriteImage - Imagen del sprite del personaje (ghosty.png)
   * @param {number} canvasWidth - Ancho del canvas para calcular posición horizontal
   * @param {number} canvasHeight - Alto del canvas para calcular posición vertical inicial
   */
  constructor(spriteImage, canvasWidth, canvasHeight) {
    this.sprite = spriteImage;
    this.width = GAME_CONFIG.PLAYER_WIDTH;
    this.height = GAME_CONFIG.PLAYER_HEIGHT;
    this.x = canvasWidth * GAME_CONFIG.PLAYER_X_PERCENT;
    this.y = canvasHeight / 2;
    this.velocity = 0;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
  }

  /**
   * Aplica gravedad y actualiza la posición del jugador.
   * @param {number} deltaTime - Tiempo transcurrido desde el último frame (en segundos)
   */
  update(deltaTime) {
    // Apply gravity to velocity
    this.velocity += GAME_CONFIG.GRAVITY * deltaTime;

    // Clamp velocity to bounds [MAX_UP_VELOCITY, TERMINAL_VELOCITY]
    this.velocity = Math.max(GAME_CONFIG.MAX_UP_VELOCITY, Math.min(this.velocity, GAME_CONFIG.TERMINAL_VELOCITY));

    // Update vertical position
    this.y += this.velocity * deltaTime;

    // Keep horizontal position fixed at 20% of canvas width
    this.x = this.canvasWidth * GAME_CONFIG.PLAYER_X_PERCENT;
  }

  /**
   * Ejecuta un salto: establece la velocidad vertical al impulso de salto,
   * independientemente de la velocidad actual.
   */
  jump() {
    this.velocity = GAME_CONFIG.JUMP_IMPULSE;
  }

  /**
   * Retorna la hitbox circular del jugador para detección de colisiones.
   * @returns {{ cx: number, cy: number, radius: number }}
   */
  getCollisionCircle() {
    return {
      cx: this.x,
      cy: this.y,
      radius: Math.min(this.width, this.height) * GAME_CONFIG.HITBOX_RADIUS_FACTOR
    };
  }

  /**
   * Renderiza el sprite del jugador centrado en su posición.
   * @param {CanvasRenderingContext2D} ctx
   */
  render(ctx) {
    ctx.drawImage(
      this.sprite,
      this.x - this.width / 2,
      this.y - this.height / 2,
      this.width,
      this.height
    );
  }

  /**
   * Reinicia el jugador a su posición y velocidad inicial.
   */
  reset() {
    this.y = this.canvasHeight / 2;
    this.velocity = 0;
    this.x = this.canvasWidth * GAME_CONFIG.PLAYER_X_PERCENT;
  }
}

// ============================================================
// SECTION: Input Handler
// ============================================================

/**
 * Captura y procesa eventos de teclado y mouse/click.
 * No decide el estado del juego — solo dispara callbacks que el GameEngine asigna.
 */
class InputHandler {
  /**
   * @param {HTMLCanvasElement} canvas - Elemento canvas para capturar eventos de clic
   */
  constructor(canvas) {
    this.canvas = canvas;

    // Callbacks asignados por el GameEngine
    this.onJump = null;
    this.onPause = null;
    this.onResume = null;
    this.onRestart = null;

    // Bind event handlers para poder removerlos después
    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handleClick = this._handleClick.bind(this);

    this.bind();
  }

  /**
   * Registra los event listeners de teclado y clic.
   */
  bind() {
    document.addEventListener('keydown', this._handleKeyDown);
    this.canvas.addEventListener('click', this._handleClick);
  }

  /**
   * Remueve los event listeners registrados.
   */
  unbind() {
    document.removeEventListener('keydown', this._handleKeyDown);
    this.canvas.removeEventListener('click', this._handleClick);
  }

  /**
   * Maneja eventos de teclado.
   * - Space: salto / inicio / reinicio
   * - P / Escape: pausa / reanudar
   * @param {KeyboardEvent} event
   */
  _handleKeyDown(event) {
    const key = event.code;

    if (key === 'Space') {
      event.preventDefault();
      if (this.onJump) this.onJump();
      if (this.onRestart) this.onRestart();
    } else if (key === 'KeyP' || key === 'Escape') {
      event.preventDefault();
      if (this.onPause) this.onPause();
      if (this.onResume) this.onResume();
    }
  }

  /**
   * Maneja eventos de clic en el canvas.
   * El clic funciona como salto, inicio, reinicio, y también como reanudar desde pausa.
   * @param {MouseEvent} event
   */
  _handleClick(event) {
    event.preventDefault();
    if (this.onJump) this.onJump();
    if (this.onRestart) this.onRestart();
    if (this.onResume) this.onResume();
  }
}

// ============================================================
// SECTION: Utility Functions
// ============================================================

/**
 * Interpolación lineal entre dos valores.
 * @param {number} a - Valor inicial
 * @param {number} b - Valor final
 * @param {number} alpha - Factor de interpolación en [0, 1]
 * @returns {number} Valor interpolado entre a y b
 */
function lerp(a, b, alpha) {
  return a + (b - a) * alpha;
}

// ============================================================
// SECTION: Object Pooling
// ============================================================

/**
 * Generic object pool to avoid allocations during gameplay.
 * Acquires objects from the pool or creates new ones via the factory function.
 * Released objects are returned to the pool for reuse.
 */
class ObjectPool {
  /**
   * @param {function(): T} factory - Function that creates a new object
   * @param {number} initialSize - Number of objects to pre-create
   */
  constructor(factory, initialSize) {
    this.factory = factory;
    this.pool = [];
    this.active = new Set();
    this.prewarm(initialSize);
  }

  /**
   * Acquires an object from the pool, or creates a new one if the pool is empty.
   * @returns {T}
   */
  acquire() {
    const obj = this.pool.length > 0 ? this.pool.pop() : this.factory();
    this.active.add(obj);
    return obj;
  }

  /**
   * Releases an object back to the pool for reuse.
   * @param {T} obj
   */
  release(obj) {
    this.active.delete(obj);
    this.pool.push(obj);
  }

  /**
   * Pre-creates objects and adds them to the pool.
   * @param {number} count - Number of objects to pre-create
   */
  prewarm(count) {
    for (let i = 0; i < count; i++) {
      this.pool.push(this.factory());
    }
  }

  /**
   * Returns the number of objects currently in use.
   * @returns {number}
   */
  getActiveCount() {
    return this.active.size;
  }

  /**
   * Returns the number of objects available in the pool.
   * @returns {number}
   */
  getPoolSize() {
    return this.pool.length;
  }
}

/**
 * Specialized pool for pipe (portacontenedores) objects.
 * Creates pipe objects with the structure needed by PipeSystem.
 */
class PipePool extends ObjectPool {
  constructor() {
    super(() => ({
      x: 0,
      gapCenterY: 0,
      gapSize: 0,
      scored: false,
      topRect: { x: 0, y: 0, width: 0, height: 0 },
      bottomRect: { x: 0, y: 0, width: 0, height: 0 },
      active: false
    }), GAME_CONFIG.PIPE_POOL_INITIAL_SIZE);
  }

  /**
   * Acquires a pipe from the pool and configures it with the given parameters.
   * @param {number} x - Horizontal position
   * @param {number} gapCenterY - Vertical center of the gap
   * @param {number} gapSize - Size of the gap in pixels
   * @returns {object} Configured pipe object
   */
  spawn(x, gapCenterY, gapSize) {
    const pipe = this.acquire();
    pipe.x = x;
    pipe.gapCenterY = gapCenterY;
    pipe.gapSize = gapSize;
    pipe.scored = false;
    pipe.active = true;

    // Configure top rect (from top of canvas to top of gap)
    pipe.topRect.x = x;
    pipe.topRect.y = 0;
    pipe.topRect.width = GAME_CONFIG.PIPE_WIDTH;
    pipe.topRect.height = gapCenterY - gapSize / 2;

    // Configure bottom rect (from bottom of gap to bottom of canvas)
    pipe.bottomRect.x = x;
    pipe.bottomRect.y = gapCenterY + gapSize / 2;
    pipe.bottomRect.width = GAME_CONFIG.PIPE_WIDTH;
    pipe.bottomRect.height = GAME_CONFIG.BASE_HEIGHT - (gapCenterY + gapSize / 2);

    return pipe;
  }
}

// ============================================================
// SECTION: Pipe System
// ============================================================

/**
 * Generates, moves, and cleans up pipe pairs (portacontenedores).
 * Uses object pooling to avoid allocations during gameplay.
 * Tracks scoring when the player passes a pipe pair.
 */
class PipeSystem {
  /**
   * @param {PipePool} pool - Pool of reusable pipe objects
   */
  constructor(pool) {
    this.pool = pool;
    this.activePipes = [];
    this.lastPipeX = 0;
  }

  /**
   * Updates all active pipes: moves them left, spawns new ones, and removes off-screen pipes.
   * @param {number} deltaTime - Time elapsed since last frame (seconds)
   * @param {number} speed - Current pipe speed in px/s
   * @param {number} gap - Current gap size in px
   * @param {number} spacing - Current horizontal spacing between pipe pairs in px
   */
  update(deltaTime, speed, gap, spacing) {
    // Move all active pipes to the left
    for (let i = 0; i < this.activePipes.length; i++) {
      const pipe = this.activePipes[i];
      pipe.x -= speed * deltaTime;

      // Update hitbox positions to match new x
      pipe.topRect.x = pipe.x;
      pipe.bottomRect.x = pipe.x;
    }

    // Remove pipes that have exited the left edge
    for (let i = this.activePipes.length - 1; i >= 0; i--) {
      const pipe = this.activePipes[i];
      if (pipe.x + GAME_CONFIG.PIPE_WIDTH < 0) {
        pipe.active = false;
        this.pool.release(pipe);
        this.activePipes.splice(i, 1);
      }
    }

    // Spawn new pipes when needed
    // Determine if we need to spawn: either no pipes exist, or the last pipe is far enough from the right edge
    const rightmostX = this._getRightmostPipeX();
    const shouldSpawn = this.activePipes.length === 0 ||
      (GAME_CONFIG.BASE_WIDTH - rightmostX >= spacing);

    if (shouldSpawn) {
      const gapCenterY = this._randomGapCenter();
      const newPipe = this.pool.spawn(GAME_CONFIG.BASE_WIDTH, gapCenterY, gap);
      this.activePipes.push(newPipe);
      this.lastPipeX = GAME_CONFIG.BASE_WIDTH;
    }

    // Update lastPipeX to track the rightmost pipe's current position
    if (this.activePipes.length > 0) {
      this.lastPipeX = this._getRightmostPipeX();
    }
  }

  /**
   * Checks if the player has passed a pipe pair for scoring.
   * A pipe is scored when the player's X position passes the pipe's right edge (pipe.x + PIPE_WIDTH).
   * @param {number} playerX - The player's horizontal position
   * @returns {{ scored: boolean }}
   */
  checkScore(playerX) {
    let scored = false;
    for (let i = 0; i < this.activePipes.length; i++) {
      const pipe = this.activePipes[i];
      if (!pipe.scored && playerX > pipe.x + GAME_CONFIG.PIPE_WIDTH) {
        pipe.scored = true;
        scored = true;
      }
    }
    return { scored };
  }

  /**
   * Returns the array of currently active pipes.
   * @returns {object[]}
   */
  getActivePipes() {
    return this.activePipes;
  }

  /**
   * Resets the pipe system, releasing all active pipes back to the pool.
   */
  reset() {
    for (let i = 0; i < this.activePipes.length; i++) {
      const pipe = this.activePipes[i];
      pipe.active = false;
      this.pool.release(pipe);
    }
    this.activePipes = [];
    this.lastPipeX = 0;
  }

  /**
   * Generates a random gap center Y position between 20% and 80% of canvas height.
   * @returns {number}
   * @private
   */
  _randomGapCenter() {
    const minY = GAME_CONFIG.BASE_HEIGHT * 0.2;
    const maxY = GAME_CONFIG.BASE_HEIGHT * 0.8;
    return minY + Math.random() * (maxY - minY);
  }

  /**
   * Finds the X position of the rightmost active pipe.
   * @returns {number}
   * @private
   */
  _getRightmostPipeX() {
    let maxX = -Infinity;
    for (let i = 0; i < this.activePipes.length; i++) {
      if (this.activePipes[i].x > maxX) {
        maxX = this.activePipes[i].x;
      }
    }
    return maxX;
  }

  static PIPE_WIDTH = GAME_CONFIG.PIPE_WIDTH;
}

// ============================================================
// SECTION: Difficulty System
// ============================================================

/**
 * Sistema de dificultad progresiva.
 * Calcula velocidad, gap y spacing basados en el puntaje actual.
 * Los incrementos se aplican de forma escalonada según los intervalos configurados.
 */
class DifficultySystem {
  constructor() {
    this.speed = GAME_CONFIG.BASE_SPEED;
    this.gap = GAME_CONFIG.BASE_GAP;
    this.spacing = GAME_CONFIG.BASE_SPACING;
  }

  /**
   * Recalcula los parámetros de dificultad basados en el puntaje actual.
   * - Velocidad: +5% cada 5 puntos, máximo 200% de la base (300 px/s)
   * - Gap: -5px cada 10 puntos, mínimo 100px
   * - Spacing: -10px cada 10 puntos, mínimo 180px
   * @param {number} score - Puntaje actual del jugador
   */
  update(score) {
    // Speed: min(BASE_SPEED * (1 + floor(score/5) * 0.05), BASE_SPEED * MAX_SPEED_MULTIPLIER)
    const speedIncrements = Math.floor(score / GAME_CONFIG.SPEED_INCREMENT_INTERVAL);
    this.speed = Math.min(
      GAME_CONFIG.BASE_SPEED * (1 + speedIncrements * GAME_CONFIG.SPEED_INCREMENT_PERCENT),
      GAME_CONFIG.BASE_SPEED * GAME_CONFIG.MAX_SPEED_MULTIPLIER
    );

    // Gap: max(BASE_GAP - floor(score/10) * GAP_REDUCTION_PX, MIN_GAP)
    const gapReductions = Math.floor(score / GAME_CONFIG.GAP_REDUCTION_INTERVAL);
    this.gap = Math.max(
      GAME_CONFIG.BASE_GAP - gapReductions * GAME_CONFIG.GAP_REDUCTION_PX,
      GAME_CONFIG.MIN_GAP
    );

    // Spacing: max(BASE_SPACING - floor(score/10) * SPACING_REDUCTION_PX, MIN_SPACING)
    const spacingReductions = Math.floor(score / GAME_CONFIG.SPACING_REDUCTION_INTERVAL);
    this.spacing = Math.max(
      GAME_CONFIG.BASE_SPACING - spacingReductions * GAME_CONFIG.SPACING_REDUCTION_PX,
      GAME_CONFIG.MIN_SPACING
    );
  }

  /**
   * Reinicia todos los valores de dificultad a sus valores base.
   */
  reset() {
    this.speed = GAME_CONFIG.BASE_SPEED;
    this.gap = GAME_CONFIG.BASE_GAP;
    this.spacing = GAME_CONFIG.BASE_SPACING;
  }
}

// ============================================================
// SECTION: Collision System
// ============================================================

/**
 * Evalúa colisiones del jugador contra portacontenedores y límites del canvas.
 * Llamado por el GameEngine en cada frame durante el estado Playing.
 *
 * @param {Player} player - Instancia del jugador
 * @param {PipeSystem} pipeSystem - Sistema de portacontenedores activos
 * @param {number} canvasHeight - Altura del canvas para verificar límites
 * @returns {boolean} true si se detectó alguna colisión (pipe o boundary)
 */
function checkCollisions(player, pipeSystem, canvasHeight) {
  const circle = player.getCollisionCircle();

  // Check boundary collision (ceiling y=0, floor y=canvasHeight)
  if (checkBoundaryCollision(circle, canvasHeight)) {
    return true;
  }

  // Check collision against each active pipe's top and bottom rectangles
  const activePipes = pipeSystem.getActivePipes();
  for (let i = 0; i < activePipes.length; i++) {
    const pipe = activePipes[i];
    if (circleRectCollision(circle, pipe.topRect)) {
      return true;
    }
    if (circleRectCollision(circle, pipe.bottomRect)) {
      return true;
    }
  }

  return false;
}

// ============================================================
// SECTION: Score System
// ============================================================

/**
 * Sistema de puntuación con persistencia en localStorage.
 * Gestiona el puntaje actual, el puntaje máximo (high score),
 * y la lectura/escritura segura en localStorage.
 */
class ScoreSystem {
  constructor() {
    this.score = 0;
    this.highScore = this.loadHighScore();
  }

  /**
   * Incrementa el puntaje actual en 1, con un máximo de MAX_SCORE (9999).
   * Si el nuevo puntaje supera el high score, actualiza y persiste el high score.
   */
  increment() {
    this.score = Math.min(this.score + 1, GAME_CONFIG.MAX_SCORE);
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.saveHighScore();
    }
  }

  /**
   * Reinicia el puntaje actual a 0 y recarga el high score desde localStorage.
   */
  reset() {
    this.score = 0;
    this.highScore = this.loadHighScore();
  }

  /**
   * Carga el high score desde localStorage.
   * Valida que el valor sea un entero entre 0 y 9999.
   * Retorna 0 si el valor es inválido o localStorage no está disponible.
   * @returns {number}
   */
  loadHighScore() {
    try {
      const stored = localStorage.getItem(GAME_CONFIG.STORAGE_KEY);
      if (stored === null) {
        return 0;
      }
      const parsed = Number(stored);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > GAME_CONFIG.MAX_SCORE) {
        return 0;
      }
      return parsed;
    } catch (e) {
      return 0;
    }
  }

  /**
   * Guarda el high score actual en localStorage.
   * Envuelto en try/catch para manejar errores de cuota o indisponibilidad.
   */
  saveHighScore() {
    try {
      localStorage.setItem(GAME_CONFIG.STORAGE_KEY, String(this.highScore));
    } catch (e) {
      // Silently ignore localStorage errors (quota exceeded, unavailable, etc.)
    }
  }
}

// ============================================================
// SECTION: Pause Controller
// ============================================================

/**
 * Controlador de pausa que encapsula la lógica de congelamiento del juego.
 * Coordina con StateManager para determinar si la simulación debe actualizarse.
 * Garantiza que al reanudar no se acumule delta time del período de pausa.
 *
 * Uso por el GameEngine:
 * - Antes de actualizar subsistemas, verificar `shouldUpdate()`
 * - Antes de aceptar saltos, verificar `shouldAcceptJump()`
 * - Al calcular deltaTime en el game loop, usar `filterDeltaTime(rawDelta)` para
 *   descartar el tiempo acumulado durante la pausa
 */
class PauseController {
  /**
   * @param {StateManager} stateManager - Instancia del gestor de estado del juego
   */
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.wasPaused = false;
  }

  /**
   * Determina si la simulación debe actualizarse en este frame.
   * Retorna true solo cuando el estado es Playing.
   * @returns {boolean}
   */
  shouldUpdate() {
    return this.stateManager.getState() === GameState.PLAYING;
  }

  /**
   * Determina si se deben aceptar entradas de salto.
   * Los saltos solo se aceptan durante el estado Playing.
   * @returns {boolean}
   */
  shouldAcceptJump() {
    return this.stateManager.getState() === GameState.PLAYING;
  }

  /**
   * Filtra el delta time para evitar acumulación durante la pausa.
   * Cuando el juego acaba de reanudar (transición de paused a playing),
   * retorna 0 para el primer frame, evitando un salto de posición.
   * En frames normales durante Playing, retorna el delta time sin modificar.
   *
   * @param {number} rawDeltaTime - Delta time crudo calculado desde timestamps (en segundos)
   * @returns {number} Delta time filtrado (0 si se acaba de reanudar, rawDeltaTime en caso contrario)
   */
  filterDeltaTime(rawDeltaTime) {
    const isPaused = this.stateManager.getState() === GameState.PAUSED;

    if (isPaused) {
      this.wasPaused = true;
      return 0;
    }

    // Si acabamos de reanudar, descartar el delta time acumulado
    if (this.wasPaused) {
      this.wasPaused = false;
      return 0;
    }

    return rawDeltaTime;
  }

  /**
   * Reinicia el estado interno del controlador de pausa.
   */
  reset() {
    this.wasPaused = false;
  }
}

// ============================================================
// SECTION: Restart Controller
// ============================================================

/**
 * Controlador de reinicio que encapsula la lógica de Game Over → restart.
 * Garantiza que el reinicio solo se acepte después de RESTART_DELAY_MS (1 segundo)
 * desde que se entró al estado Game Over, y coordina el reset de todos los subsistemas.
 */
class RestartController {
  /**
   * @param {StateManager} stateManager - Instancia del gestor de estado del juego
   */
  constructor(stateManager) {
    this.stateManager = stateManager;
  }

  /**
   * Determina si el reinicio puede ejecutarse.
   * Retorna true solo si el estado actual es GAME_OVER y ha transcurrido
   * al menos RESTART_DELAY_MS (1000ms) desde que se entró al estado.
   * @returns {boolean}
   */
  canRestart() {
    return (
      this.stateManager.getState() === GameState.GAME_OVER &&
      this.stateManager.getTimeInState() >= GAME_CONFIG.RESTART_DELAY_MS
    );
  }

  /**
   * Ejecuta el reinicio completo del juego.
   * Llama reset() en todos los subsistemas y transiciona el estado a PLAYING.
   * El high score se preserva porque ScoreSystem.reset() recarga desde localStorage.
   *
   * @param {Player} player - Instancia del jugador
   * @param {PipeSystem} pipeSystem - Sistema de portacontenedores
   * @param {DifficultySystem} difficultySystem - Sistema de dificultad
   * @param {ScoreSystem} scoreSystem - Sistema de puntuación
   * @returns {boolean} true si el reinicio se ejecutó, false si no se pudo (estado inválido o delay no cumplido)
   */
  performRestart(player, pipeSystem, difficultySystem, scoreSystem) {
    if (!this.canRestart()) {
      return false;
    }

    // Reset all subsystems
    player.reset();
    pipeSystem.reset();
    difficultySystem.reset();
    scoreSystem.reset();

    // Transition state to PLAYING
    this.stateManager.transition(GameState.PLAYING);
    return true;
  }
}

// ============================================================
// SECTION: Audio System
// ============================================================

/**
 * Sistema de audio que gestiona la carga y reproducción de efectos de sonido.
 * Usa Web Audio API (AudioContext + AudioBuffer) para baja latencia y
 * reproducción simultánea de múltiples instancias del mismo sonido.
 *
 * Maneja la política de autoplay del navegador: el AudioContext se desbloquea
 * en la primera interacción del usuario (click/keydown).
 */
class AudioSystem {
  constructor() {
    this.audioContext = null;
    this.jumpSound = null;
    this.gameOverSound = null;
    this.unlocked = false;
  }

  /**
   * Inicializa el sistema de audio: crea el AudioContext y precarga los archivos de audio.
   * Usa Promise.race con un timeout de ASSET_TIMEOUT_MS (10 segundos).
   * @throws {Error} Si la carga falla o excede el timeout
   */
  async init() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      throw new Error('Web Audio API is not supported in this browser');
    }

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Audio asset loading timed out after 10 seconds')), GAME_CONFIG.ASSET_TIMEOUT_MS);
    });

    const loadPromise = Promise.all([
      this._loadAudioBuffer(GAME_CONFIG.AUDIO_FILES[0]),
      this._loadAudioBuffer(GAME_CONFIG.AUDIO_FILES[1])
    ]);

    const buffers = await Promise.race([loadPromise, timeoutPromise]);

    this.jumpSound = buffers[0];
    this.gameOverSound = buffers[1];
  }

  /**
   * Fetches and decodes an audio file into an AudioBuffer.
   * @param {string} url - Path to the audio file
   * @returns {Promise<AudioBuffer>}
   * @private
   */
  async _loadAudioBuffer(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load audio file: ${url} (${response.status})`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return await this.audioContext.decodeAudioData(arrayBuffer);
  }

  /**
   * Plays the jump sound effect.
   * Creates a new AudioBufferSourceNode each time to allow overlapping playback
   * for rapid jumps.
   */
  playJump() {
    if (!this.unlocked || !this.jumpSound) return;
    try {
      const source = this.audioContext.createBufferSource();
      source.buffer = this.jumpSound;
      source.connect(this.audioContext.destination);
      source.start(0);
    } catch (e) {
      // Gracefully handle playback errors
    }
  }

  /**
   * Plays the game over sound effect once.
   */
  playGameOver() {
    if (!this.unlocked || !this.gameOverSound) return;
    try {
      const source = this.audioContext.createBufferSource();
      source.buffer = this.gameOverSound;
      source.connect(this.audioContext.destination);
      source.start(0);
    } catch (e) {
      // Gracefully handle playback errors
    }
  }

  /**
   * Unlocks the AudioContext on first user interaction.
   * Handles the browser autoplay policy by resuming a suspended AudioContext.
   * Should be called from a user-initiated event handler (click, keydown).
   */
  unlock() {
    if (this.unlocked) return;
    if (!this.audioContext) return;

    try {
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().then(() => {
          this.unlocked = true;
        }).catch(() => {
          // Continue without sound if resume fails
        });
      } else {
        this.unlocked = true;
      }
    } catch (e) {
      // Continue without sound silently
    }
  }
}

// ============================================================
// SECTION: Background (Canal de Panamá Parallax Scene)
// ============================================================

/**
 * Renderiza el fondo con efecto parallax representando el área del Canal de Panamá.
 * Capas (de atrás hacia adelante): cielo, cerros, vegetación, agua.
 * Se desplaza al 30% de la velocidad de los portacontenedores para crear profundidad.
 * Dibuja el fondo dos veces (offset por canvasWidth) para lograr wrapping sin costuras.
 */
class Background {
  /**
   * @param {number} canvasWidth - Ancho del canvas
   * @param {number} canvasHeight - Alto del canvas
   */
  constructor(canvasWidth, canvasHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.scrollX = 0;
  }

  /**
   * Actualiza el desplazamiento del fondo con parallax.
   * @param {number} deltaTime - Tiempo transcurrido desde el último frame (en segundos)
   * @param {number} pipeSpeed - Velocidad actual de los portacontenedores (px/s)
   */
  update(deltaTime, pipeSpeed) {
    this.scrollX += pipeSpeed * GAME_CONFIG.BG_PARALLAX_FACTOR * deltaTime;
    // Wrap using modulo to keep scrollX in [0, canvasWidth)
    this.scrollX = this.scrollX % this.canvasWidth;
  }

  /**
   * Renderiza todas las capas del fondo con parallax.
   * @param {CanvasRenderingContext2D} ctx
   */
  render(ctx) {
    const w = this.canvasWidth;
    const h = this.canvasHeight;
    const offset = -this.scrollX;

    // Layer 1: Sky — full canvas fill
    ctx.fillStyle = GAME_CONFIG.SKY_COLOR;
    ctx.fillRect(0, 0, w, h);

    // Draw scrolling layers twice for seamless wrapping
    for (let i = 0; i < 2; i++) {
      const xOff = offset + i * w;
      this._renderHills(ctx, xOff, w, h);
      this._renderVegetation(ctx, xOff, w, h);
      this._renderWater(ctx, xOff, w, h);
    }
  }

  /**
   * Dibuja los cerros lejanos (30-50% desde arriba).
   * Usa curvas bezier para crear formas onduladas de colinas.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} xOff - Offset horizontal para parallax
   * @param {number} w - Ancho del canvas
   * @param {number} h - Alto del canvas
   * @private
   */
  _renderHills(ctx, xOff, w, h) {
    const hillTop = h * 0.30;
    const hillBottom = h * 0.50;

    ctx.fillStyle = GAME_CONFIG.HILLS_COLOR;
    ctx.beginPath();
    ctx.moveTo(xOff, hillBottom);

    // Create rolling hills with bezier curves
    const segments = 4;
    const segWidth = w / segments;
    for (let i = 0; i < segments; i++) {
      const x1 = xOff + i * segWidth;
      const x2 = xOff + (i + 1) * segWidth;
      const peakY = hillTop + Math.sin(i * 1.8 + 0.5) * (h * 0.06);
      const cp1x = x1 + segWidth * 0.3;
      const cp1y = peakY;
      const cp2x = x1 + segWidth * 0.7;
      const cp2y = peakY + (h * 0.02);
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, hillBottom - Math.sin(i * 1.2) * (h * 0.03));
    }

    ctx.lineTo(xOff + w, hillBottom);
    ctx.lineTo(xOff + w, hillBottom);
    ctx.lineTo(xOff, hillBottom);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Dibuja la vegetación tropical (50-70% desde arriba).
   * Usa arcos y formas redondeadas para simular copas de árboles.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} xOff - Offset horizontal para parallax
   * @param {number} w - Ancho del canvas
   * @param {number} h - Alto del canvas
   * @private
   */
  _renderVegetation(ctx, xOff, w, h) {
    const vegTop = h * 0.48;
    const vegBottom = h * 0.70;

    // Base vegetation band
    ctx.fillStyle = GAME_CONFIG.VEGETATION_COLOR;
    ctx.fillRect(xOff, vegTop + (h * 0.05), w, vegBottom - vegTop);

    // Tree canopy shapes along the top of vegetation
    ctx.beginPath();
    const treeCount = 8;
    const treeSpacing = w / treeCount;
    for (let i = 0; i < treeCount; i++) {
      const tx = xOff + i * treeSpacing + treeSpacing * 0.5;
      const ty = vegTop + (h * 0.05);
      const radius = treeSpacing * 0.4 + Math.sin(i * 2.1) * (treeSpacing * 0.1);
      ctx.moveTo(tx + radius, ty);
      ctx.arc(tx, ty, radius, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  /**
   * Dibuja el agua del canal (parte inferior ~20-30% del canvas).
   * Usa un rectángulo con un sutil efecto de ondas.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} xOff - Offset horizontal para parallax
   * @param {number} w - Ancho del canvas
   * @param {number} h - Alto del canvas
   * @private
   */
  _renderWater(ctx, xOff, w, h) {
    const waterTop = h * 0.72;
    const waterHeight = h - waterTop;

    // Main water fill
    ctx.fillStyle = GAME_CONFIG.WATER_COLOR;
    ctx.fillRect(xOff, waterTop, w, waterHeight);

    // Subtle wave lines for retro hand-drawn feel
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    for (let row = 0; row < 3; row++) {
      const wy = waterTop + waterHeight * 0.25 + row * (waterHeight * 0.2);
      ctx.beginPath();
      ctx.moveTo(xOff, wy);
      const waveSegments = 12;
      const waveWidth = w / waveSegments;
      for (let j = 0; j < waveSegments; j++) {
        const wx1 = xOff + j * waveWidth + waveWidth * 0.5;
        const wy1 = wy + (j % 2 === 0 ? -3 : 3);
        const wx2 = xOff + (j + 1) * waveWidth;
        const wy2 = wy;
        ctx.quadraticCurveTo(wx1, wy1, wx2, wy2);
      }
      ctx.stroke();
    }
  }

  /**
   * Reinicia el desplazamiento del fondo a 0.
   */
  reset() {
    this.scrollX = 0;
  }
}

// ============================================================
// SECTION: Cloud System
// ============================================================

/**
 * Sistema de nubes decorativas con parallax multicapa.
 * Cada nube se mueve a una velocidad diferente (10%-50% de la velocidad de portacontenedores)
 * para crear un efecto de profundidad. Las nubes se reciclan al salir por el borde izquierdo.
 */
class CloudSystem {
  /**
   * @param {number} canvasWidth - Ancho del canvas
   * @param {number} canvasHeight - Alto del canvas
   */
  constructor(canvasWidth, canvasHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.clouds = [];
    this._initClouds();
  }

  /**
   * Crea el conjunto inicial de nubes distribuidas por el canvas.
   * Garantiza al menos MIN_CLOUDS nubes y que no todas tengan el mismo speedFactor.
   * @private
   */
  _initClouds() {
    this.clouds = [];
    const count = Math.max(GAME_CONFIG.MIN_CLOUDS, GAME_CONFIG.CLOUD_POOL_INITIAL_SIZE);

    for (let i = 0; i < count; i++) {
      this.clouds.push(this._createCloud(true));
    }

    // Ensure not all clouds have the same speed factor (variety for depth effect)
    this._ensureSpeedVariety();
  }

  /**
   * Crea una nube con propiedades aleatorias.
   * @param {boolean} distributeAcrossCanvas - Si true, distribuye x a lo largo del canvas; si false, posiciona al borde derecho
   * @returns {{ x: number, y: number, width: number, height: number, speedFactor: number, opacity: number }}
   * @private
   */
  _createCloud(distributeAcrossCanvas) {
    const width = 80 + Math.random() * 120;   // 80-200px
    const height = 30 + Math.random() * 50;   // 30-80px
    const y = Math.random() * (this.canvasHeight * 0.4); // upper 40% of canvas
    const speedFactor = GAME_CONFIG.CLOUD_MIN_SPEED + Math.random() * (GAME_CONFIG.CLOUD_MAX_SPEED - GAME_CONFIG.CLOUD_MIN_SPEED);
    const opacity = GAME_CONFIG.CLOUD_MIN_OPACITY + Math.random() * (GAME_CONFIG.CLOUD_MAX_OPACITY - GAME_CONFIG.CLOUD_MIN_OPACITY);

    let x;
    if (distributeAcrossCanvas) {
      // Distribute clouds across the full canvas width (including some off-screen to the right)
      x = Math.random() * (this.canvasWidth + width);
    } else {
      // Position at the right edge (for recycled clouds)
      x = this.canvasWidth + Math.random() * 100;
    }

    return { x, y, width, height, speedFactor, opacity };
  }

  /**
   * Garantiza que no todas las nubes tengan el mismo speedFactor.
   * Si todas son iguales, ajusta la primera y última para crear variedad.
   * @private
   */
  _ensureSpeedVariety() {
    if (this.clouds.length < 2) return;

    const firstSpeed = this.clouds[0].speedFactor;
    const allSame = this.clouds.every(c => c.speedFactor === firstSpeed);

    if (allSame) {
      // Force different speeds on first and last cloud
      this.clouds[0].speedFactor = GAME_CONFIG.CLOUD_MIN_SPEED;
      this.clouds[this.clouds.length - 1].speedFactor = GAME_CONFIG.CLOUD_MAX_SPEED;
    }
  }

  /**
   * Actualiza la posición de todas las nubes.
   * Cada nube se mueve a la izquierda a su propio speedFactor * pipeSpeed * deltaTime.
   * Las nubes que salen por el borde izquierdo se reciclan al borde derecho.
   *
   * @param {number} deltaTime - Tiempo transcurrido desde el último frame (en segundos)
   * @param {number} pipeSpeed - Velocidad actual de los portacontenedores (px/s)
   */
  update(deltaTime, pipeSpeed) {
    for (let i = 0; i < this.clouds.length; i++) {
      const cloud = this.clouds[i];
      cloud.x -= cloud.speedFactor * pipeSpeed * deltaTime;

      // Recycle cloud that exits left edge
      if (cloud.x + cloud.width < 0) {
        this.clouds[i] = this._createCloud(false);
      }
    }
  }

  /**
   * Renderiza todas las nubes con bordes suaves y formas orgánicas.
   * Usa múltiples elipses superpuestas con globalAlpha para apariencia suave.
   *
   * @param {CanvasRenderingContext2D} ctx
   */
  render(ctx) {
    ctx.save();

    for (let i = 0; i < this.clouds.length; i++) {
      const cloud = this.clouds[i];
      ctx.globalAlpha = cloud.opacity;
      this._drawCloud(ctx, cloud);
    }

    ctx.restore();
  }

  /**
   * Dibuja una nube individual usando múltiples elipses superpuestas
   * para crear una forma orgánica con bordes suaves.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ x: number, y: number, width: number, height: number }} cloud
   * @private
   */
  _drawCloud(ctx, cloud) {
    const { x, y, width, height } = cloud;
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    ctx.fillStyle = '#FFFFFF';

    // Main body ellipse (largest, centered)
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, width * 0.4, height * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Left bump
    ctx.beginPath();
    ctx.ellipse(centerX - width * 0.25, centerY + height * 0.05, width * 0.25, height * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Right bump
    ctx.beginPath();
    ctx.ellipse(centerX + width * 0.25, centerY + height * 0.05, width * 0.25, height * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Top bump (gives organic puffy look)
    ctx.beginPath();
    ctx.ellipse(centerX + width * 0.1, centerY - height * 0.15, width * 0.2, height * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Small extra bump for organic feel
    ctx.beginPath();
    ctx.ellipse(centerX - width * 0.15, centerY - height * 0.1, width * 0.15, height * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Reinicia las nubes a posiciones iniciales.
   */
  reset() {
    this._initClouds();
  }
}

// ============================================================
// SECTION: BatchRenderer (Container Ship Rendering)
// ============================================================

/**
 * Renderizador por lotes para portacontenedores (container ships).
 * Pre-renderiza segmentos de contenedores apilados en OffscreenCanvas
 * y los dibuja con drawImage() para rendimiento óptimo.
 *
 * Agrupa draw calls por estilo para minimizar cambios de estado del contexto Canvas.
 * Usa una tira alta de contenedores pre-renderizada y recorta (source clipping)
 * la altura correcta para cada pipe.
 */
class BatchRenderer {
  /**
   * @param {CanvasRenderingContext2D} ctx - Contexto del canvas principal
   */
  constructor(ctx) {
    this.ctx = ctx;
    this._segmentCache = null;
  }

  /**
   * Pre-renderiza un segmento de portacontenedores (contenedores apilados + casco).
   * Crea un OffscreenCanvas con contenedores de colores apilados y el casco del barco
   * en la base. El resultado se puede reutilizar con drawImage() y source clipping.
   *
   * @param {number} width - Ancho del segmento (PIPE_WIDTH = 60px)
   * @param {number} height - Altura total del segmento a pre-renderizar
   * @returns {HTMLCanvasElement|OffscreenCanvas} Canvas pre-renderizado reutilizable
   */
  prerenderPipeSegment(width, height) {
    const useOffscreen = GAME_CONFIG.USE_OFFSCREEN_CANVAS && typeof OffscreenCanvas !== 'undefined';
    const canvas = useOffscreen
      ? new OffscreenCanvas(width, height)
      : document.createElement('canvas');

    if (!useOffscreen) {
      canvas.width = width;
      canvas.height = height;
    }

    const octx = canvas.getContext('2d');
    const containerH = GAME_CONFIG.CONTAINER_HEIGHT;
    const hullH = 10;
    const colors = GAME_CONFIG.CONTAINER_COLORS;
    const borderColor = GAME_CONFIG.CONTAINER_BORDER_COLOR;

    // Draw stacked containers from top to bottom, leaving room for hull at the base
    let y = 0;
    let colorIndex = 0;
    while (y < height - hullH) {
      const segmentHeight = Math.min(containerH, height - hullH - y);
      // Fill container with color
      octx.fillStyle = colors[colorIndex % colors.length];
      octx.fillRect(0, y, width, segmentHeight);

      // Draw dark border between containers (1px)
      octx.strokeStyle = borderColor;
      octx.lineWidth = 1;
      octx.strokeRect(0, y, width, segmentHeight);

      y += containerH;
      colorIndex++;
    }

    // Draw hull at the base (dark gray)
    octx.fillStyle = GAME_CONFIG.SHIP_HULL_COLOR;
    octx.fillRect(0, height - hullH, width, hullH);

    return canvas;
  }

  /**
   * Renderiza un par de pipes (portacontenedores superior e inferior) usando
   * segmentos pre-renderizados. Usa source clipping para la altura correcta.
   *
   * - Top pipe: invertido (contenedores cuelgan desde arriba, casco en la parte inferior del pipe superior)
   * - Bottom pipe: casco en la parte superior, contenedores apilados hacia abajo
   *
   * @param {{ x: number, topRect: { height: number }, bottomRect: { y: number, height: number } }} pipe - Objeto pipe con posición y dimensiones
   * @param {number} canvasHeight - Altura del canvas
   */
  renderPipe(pipe, canvasHeight) {
    const width = GAME_CONFIG.PIPE_WIDTH;
    const topHeight = pipe.topRect.height;
    const bottomHeight = pipe.bottomRect.height;

    // Render top pipe (inverted: hull at bottom, containers stacking upward)
    if (topHeight > 0) {
      const topSegment = this._getOrCreateSegment(width, topHeight);
      // Draw inverted: flip vertically so hull is at the bottom of the top pipe
      this.ctx.save();
      this.ctx.translate(pipe.x, topHeight);
      this.ctx.scale(1, -1);
      this.ctx.drawImage(topSegment, 0, 0, width, topHeight, 0, 0, width, topHeight);
      this.ctx.restore();
    }

    // Render bottom pipe (normal: hull at top, containers stacking downward)
    if (bottomHeight > 0) {
      const bottomSegment = this._getOrCreateSegment(width, bottomHeight);
      this.ctx.drawImage(bottomSegment, 0, 0, width, bottomHeight, pipe.x, pipe.bottomRect.y, width, bottomHeight);
    }
  }

  /**
   * Obtiene un segmento pre-renderizado del cache o crea uno nuevo.
   * Para simplificar, cachea un segmento grande y usa source clipping.
   *
   * @param {number} width - Ancho del segmento
   * @param {number} height - Altura requerida
   * @returns {HTMLCanvasElement|OffscreenCanvas}
   * @private
   */
  _getOrCreateSegment(width, height) {
    // Use a single tall cached segment and clip from it
    const maxHeight = GAME_CONFIG.BASE_HEIGHT;
    if (!this._segmentCache || this._segmentCache.width < width || this._segmentCache.height < maxHeight) {
      this._segmentCache = this.prerenderPipeSegment(width, maxHeight);
    }

    // If the requested height fits within the cached segment, use source clipping
    if (height <= this._segmentCache.height) {
      return this._segmentCache;
    }

    // Fallback: create a new segment for the exact height
    return this.prerenderPipeSegment(width, height);
  }
}

// ============================================================
// SECTION: Canvas Scaling
// ============================================================

/**
 * Calcula las dimensiones escaladas del canvas que mantienen la proporción 4:3
 * dentro del espacio disponible de la ventana.
 *
 * Función pura sin dependencia del DOM, exportada para testing.
 *
 * @param {number} windowWidth - Ancho disponible de la ventana en píxeles
 * @param {number} windowHeight - Alto disponible de la ventana en píxeles
 * @returns {{ width: number, height: number }} Dimensiones escaladas que mantienen 4:3
 */
function calculateScaledDimensions(windowWidth, windowHeight) {
  const aspectRatio = GAME_CONFIG.ASPECT_RATIO;

  let width, height;

  if (windowWidth / windowHeight > aspectRatio) {
    // Height-constrained: use full height, calculate width
    height = windowHeight;
    width = height * aspectRatio;
  } else {
    // Width-constrained: use full width, calculate height
    width = windowWidth;
    height = width / aspectRatio;
  }

  return { width, height };
}

/**
 * Gestiona el escalado del canvas manteniendo la proporción de aspecto 4:3.
 * La resolución interna del canvas permanece en 800x600 (el juego renderiza a esta resolución).
 * El CSS width/height escala la visualización proporcionalmente.
 */
class CanvasScaler {
  /**
   * @param {HTMLCanvasElement} canvas - Elemento canvas del juego
   */
  constructor(canvas) {
    this.canvas = canvas;

    // Set internal resolution to base dimensions (never changes)
    this.canvas.width = GAME_CONFIG.BASE_WIDTH;
    this.canvas.height = GAME_CONFIG.BASE_HEIGHT;

    // Bind resize handler
    this._handleResize = this._handleResize.bind(this);

    // Initial scale
    this._applyScale(window.innerWidth, window.innerHeight);

    // Listen for window resize events
    window.addEventListener('resize', this._handleResize);
  }

  /**
   * Maneja el evento de redimensionamiento de la ventana.
   * @private
   */
  _handleResize() {
    this._applyScale(window.innerWidth, window.innerHeight);
  }

  /**
   * Aplica el escalado CSS al canvas basado en las dimensiones de la ventana.
   * La resolución interna (canvas.width/height) permanece en 800x600.
   *
   * @param {number} windowWidth - Ancho disponible de la ventana
   * @param {number} windowHeight - Alto disponible de la ventana
   * @private
   */
  _applyScale(windowWidth, windowHeight) {
    const { width, height } = calculateScaledDimensions(windowWidth, windowHeight);

    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';
  }

  /**
   * Remueve el event listener de resize. Llamar al destruir el scaler.
   */
  destroy() {
    window.removeEventListener('resize', this._handleResize);
  }
}

// ============================================================
// SECTION: HUD (Heads-Up Display)
// ============================================================

/**
 * Renderiza la interfaz de usuario: barra de puntaje, overlays de estado,
 * pantalla de inicio y pantalla de Game Over.
 *
 * Rendering logic por estado:
 * - PLAYING: barra de puntaje en la parte inferior
 * - INICIO: título centrado + instrucción de inicio
 * - PAUSED: barra de puntaje + overlay semi-transparente + texto "PAUSED"
 * - GAME_OVER: barra de puntaje + overlay + "Game Over" + puntajes + instrucción de reinicio
 */
class HUD {
  constructor() {
    this.BAR_HEIGHT = 40;
    this.BAR_COLOR = 'rgba(0, 0, 0, 0.8)';
    this.OVERLAY_COLOR = 'rgba(0, 0, 0, 0.5)';
  }

  /**
   * Renderiza el HUD según el estado actual del juego.
   * @param {CanvasRenderingContext2D} ctx - Contexto del canvas
   * @param {string} state - Estado actual del juego (GameState enum value)
   * @param {number} score - Puntaje actual
   * @param {number} highScore - Puntaje máximo
   * @param {number} canvasWidth - Ancho del canvas
   * @param {number} canvasHeight - Alto del canvas
   * @param {number} [timeInState=0] - Tiempo en milisegundos desde que se entró al estado actual
   */
  render(ctx, state, score, highScore, canvasWidth, canvasHeight, timeInState = 0) {
    switch (state) {
      case GameState.INICIO:
        this._renderStartScreen(ctx, canvasWidth, canvasHeight);
        break;
      case GameState.PLAYING:
        this._renderScoreBar(ctx, score, highScore, canvasWidth, canvasHeight);
        break;
      case GameState.PAUSED:
        this._renderScoreBar(ctx, score, highScore, canvasWidth, canvasHeight);
        this._renderOverlay(ctx, canvasWidth, canvasHeight);
        this._renderPausedText(ctx, canvasWidth, canvasHeight);
        break;
      case GameState.GAME_OVER:
        this._renderScoreBar(ctx, score, highScore, canvasWidth, canvasHeight);
        this._renderOverlay(ctx, canvasWidth, canvasHeight);
        this._renderGameOverText(ctx, score, highScore, canvasWidth, canvasHeight, timeInState);
        break;
    }
  }

  /**
   * Dibuja la barra de puntaje oscura en la parte inferior del canvas.
   * Muestra "Score: X" a la izquierda y "High: X" a la derecha.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} score
   * @param {number} highScore
   * @param {number} canvasWidth
   * @param {number} canvasHeight
   * @private
   */
  _renderScoreBar(ctx, score, highScore, canvasWidth, canvasHeight) {
    const barY = canvasHeight - this.BAR_HEIGHT;

    // Draw dark opaque bar
    ctx.fillStyle = this.BAR_COLOR;
    ctx.fillRect(0, barY, canvasWidth, this.BAR_HEIGHT);

    // Score text (left-aligned)
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Score: ${score}`, 10, barY + this.BAR_HEIGHT / 2);

    // High score text (right-aligned)
    ctx.textAlign = 'right';
    ctx.fillText(`High: ${highScore}`, canvasWidth - 10, barY + this.BAR_HEIGHT / 2);
  }

  /**
   * Dibuja un overlay semi-transparente sobre todo el canvas.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} canvasWidth
   * @param {number} canvasHeight
   * @private
   */
  _renderOverlay(ctx, canvasWidth, canvasHeight) {
    ctx.fillStyle = this.OVERLAY_COLOR;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  /**
   * Dibuja la pantalla de inicio con el título y la instrucción.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} canvasWidth
   * @param {number} canvasHeight
   * @private
   */
  _renderStartScreen(ctx, canvasWidth, canvasHeight) {
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    // Title: "Flappy Kiro"
    ctx.font = 'bold 48px monospace';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Flappy Kiro', centerX, centerY - 30);

    // Instruction
    ctx.font = '20px monospace';
    ctx.fillText('Press Space or Click to start', centerX, centerY + 30);
  }

  /**
   * Dibuja el texto de pausa centrado.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} canvasWidth
   * @param {number} canvasHeight
   * @private
   */
  _renderPausedText(ctx, canvasWidth, canvasHeight) {
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    // "PAUSED" title
    ctx.font = 'bold 48px monospace';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PAUSED', centerX, centerY - 20);

    // Resume instruction
    ctx.font = '20px monospace';
    ctx.fillText('Press P, Escape, or Click to resume', centerX, centerY + 30);
  }

  /**
   * Dibuja la pantalla de Game Over con puntajes y la instrucción de reinicio.
   * La instrucción de reinicio solo aparece después de 1 segundo (RESTART_DELAY_MS).
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} score
   * @param {number} highScore
   * @param {number} canvasWidth
   * @param {number} canvasHeight
   * @param {number} timeInState - Tiempo en ms desde que se entró al estado Game Over
   * @private
   */
  _renderGameOverText(ctx, score, highScore, canvasWidth, canvasHeight, timeInState) {
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    // "Game Over" title
    ctx.font = 'bold 48px monospace';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Game Over', centerX, centerY - 50);

    // Score display
    ctx.font = '20px monospace';
    ctx.fillText(`Score: ${score}`, centerX, centerY);

    // High score display
    ctx.fillText(`High Score: ${highScore}`, centerX, centerY + 35);

    // Restart instruction (only after 1 second)
    if (timeInState >= GAME_CONFIG.RESTART_DELAY_MS) {
      ctx.fillText('Press Space or Click to restart', centerX, centerY + 80);
    }
  }
}

// ============================================================
// SECTION: Game Engine
// ============================================================

/**
 * Motor principal del juego. Orquesta todos los subsistemas:
 * carga de assets, game loop (Input → Update → Render), y coordinación de estado.
 *
 * Normaliza todo el movimiento con delta time y clampea a max 1/30s
 * para manejar escenarios de tab inactivo.
 */
class GameEngine {
  /**
   * @param {HTMLCanvasElement} canvas - Elemento canvas del juego
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Subsystems (initialized in init())
    this.stateManager = null;
    this.player = null;
    this.pipeSystem = null;
    this.background = null;
    this.cloudSystem = null;
    this.hud = null;
    this.audioSystem = null;
    this.inputHandler = null;
    this.difficultySystem = null;
    this.scoreSystem = null;
    this.pauseController = null;
    this.restartController = null;
    this.batchRenderer = null;
    this.canvasScaler = null;

    // Game loop state
    this.lastTimestamp = 0;
    this.running = false;

    // Sprite image
    this.spriteImage = null;
  }

  /**
   * Carga los recursos (sprite y audio) e inicializa todos los subsistemas.
   * Muestra un mensaje de error en el canvas si la carga falla o excede el timeout de 10s.
   * @returns {Promise<void>}
   */
  async init() {
    try {
      // Load sprite image with timeout
      this.spriteImage = await this._loadSprite(GAME_CONFIG.SPRITE_FILE);

      // Initialize audio system
      this.audioSystem = new AudioSystem();
      await this.audioSystem.init();

      // Initialize all subsystems
      this.stateManager = new StateManager();
      this.player = new Player(this.spriteImage, GAME_CONFIG.BASE_WIDTH, GAME_CONFIG.BASE_HEIGHT);
      this.pipeSystem = new PipeSystem(new PipePool());
      this.background = new Background(GAME_CONFIG.BASE_WIDTH, GAME_CONFIG.BASE_HEIGHT);
      this.cloudSystem = new CloudSystem(GAME_CONFIG.BASE_WIDTH, GAME_CONFIG.BASE_HEIGHT);
      this.hud = new HUD();
      this.difficultySystem = new DifficultySystem();
      this.scoreSystem = new ScoreSystem();
      this.pauseController = new PauseController(this.stateManager);
      this.restartController = new RestartController(this.stateManager);
      this.batchRenderer = new BatchRenderer(this.ctx);
      this.canvasScaler = new CanvasScaler(this.canvas);

      // Initialize input handler and wire callbacks
      this.inputHandler = new InputHandler(this.canvas);
      this._wireInputCallbacks();

    } catch (error) {
      // Show error message on canvas
      this._renderError(error.message || 'Failed to load game assets');
      throw error;
    }
  }

  /**
   * Loads the sprite image with a 10-second timeout.
   * @param {string} src - Path to the sprite image
   * @returns {Promise<HTMLImageElement>}
   * @private
   */
  _loadSprite(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const timeout = setTimeout(() => {
        reject(new Error('Sprite loading timed out after 10 seconds'));
      }, GAME_CONFIG.ASSET_TIMEOUT_MS);

      img.onload = () => {
        clearTimeout(timeout);
        resolve(img);
      };

      img.onerror = () => {
        clearTimeout(timeout);
        reject(new Error(`Failed to load sprite: ${src}`));
      };

      img.src = src;
    });
  }

  /**
   * Renders an error message on the canvas when asset loading fails.
   * @param {string} message - Error message to display
   * @private
   */
  _renderError(message) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Dark background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);

    // Error title
    ctx.font = 'bold 24px monospace';
    ctx.fillStyle = '#FF4444';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Error Loading Game', w / 2, h / 2 - 30);

    // Error message
    ctx.font = '16px monospace';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(message, w / 2, h / 2 + 10);

    // Retry instruction
    ctx.font = '14px monospace';
    ctx.fillStyle = '#AAAAAA';
    ctx.fillText('Please refresh the page to try again', w / 2, h / 2 + 50);
  }

  /**
   * Inicia el game loop con requestAnimationFrame.
   */
  start() {
    this.running = true;
    this.lastTimestamp = 0;
    requestAnimationFrame((timestamp) => this.loop(timestamp));
  }

  /**
   * Frame principal del game loop.
   * Calcula deltaTime (clamped a max 1/30s), luego llama update y render.
   * @param {number} timestamp - Timestamp del frame actual (ms, de requestAnimationFrame)
   */
  loop(timestamp) {
    if (!this.running) return;

    // Calculate delta time in seconds
    if (this.lastTimestamp === 0) {
      this.lastTimestamp = timestamp;
    }

    let deltaTime = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;

    // Clamp deltaTime to max 1/30s (0.0333s) for tab-inactive scenarios
    deltaTime = Math.min(deltaTime, 1 / 30);

    // Filter delta time through pause controller (handles pause/resume transitions)
    deltaTime = this.pauseController.filterDeltaTime(deltaTime);

    // Update and render
    this.update(deltaTime);
    this.render();

    // Schedule next frame
    requestAnimationFrame((ts) => this.loop(ts));
  }

  /**
   * Actualiza todos los subsistemas si el juego está en estado Playing.
   * @param {number} deltaTime - Tiempo transcurrido filtrado (en segundos)
   */
  update(deltaTime) {
    if (!this.pauseController.shouldUpdate()) return;

    // Update player physics
    this.player.update(deltaTime);

    // Update pipes with current difficulty parameters
    this.pipeSystem.update(deltaTime, this.difficultySystem.speed, this.difficultySystem.gap, this.difficultySystem.spacing);

    // Update background parallax
    this.background.update(deltaTime, this.difficultySystem.speed);

    // Update clouds
    this.cloudSystem.update(deltaTime, this.difficultySystem.speed);

    // Check collisions
    if (checkCollisions(this.player, this.pipeSystem, GAME_CONFIG.BASE_HEIGHT)) {
      this.stateManager.transition(GameState.GAME_OVER);
      this.audioSystem.playGameOver();
      return;
    }

    // Check score
    const { scored } = this.pipeSystem.checkScore(this.player.x);
    if (scored) {
      this.scoreSystem.increment();
      this.difficultySystem.update(this.scoreSystem.score);
    }
  }

  /**
   * Renderiza todos los elementos en el orden correcto:
   * background → pipes (via BatchRenderer) → clouds → player → HUD
   */
  render() {
    // Clear canvas (background.render fills the entire canvas starting with sky)
    this.background.render(this.ctx);

    // Render pipes (container ships) via batch renderer
    const activePipes = this.pipeSystem.getActivePipes();
    for (let i = 0; i < activePipes.length; i++) {
      this.batchRenderer.renderPipe(activePipes[i], GAME_CONFIG.BASE_HEIGHT);
    }

    // Render clouds
    this.cloudSystem.render(this.ctx);

    // Render player (Flappy)
    this.player.render(this.ctx);

    // Render HUD
    this.hud.render(
      this.ctx,
      this.stateManager.getState(),
      this.scoreSystem.score,
      this.scoreSystem.highScore,
      GAME_CONFIG.BASE_WIDTH,
      GAME_CONFIG.BASE_HEIGHT,
      this.stateManager.getTimeInState()
    );
  }

  /**
   * Conecta los callbacks del InputHandler a la lógica del juego:
   * - onJump: inicio → playing, o playing → player.jump() + audio
   * - onPause: playing → paused
   * - onResume: paused → playing
   * - onRestart: game_over (after delay) → restart
   * @private
   */
  _wireInputCallbacks() {
    this.inputHandler.onJump = () => {
      // Unlock audio on first interaction
      this.audioSystem.unlock();

      const state = this.stateManager.getState();

      if (state === GameState.INICIO) {
        this.stateManager.transition(GameState.PLAYING);
      } else if (state === GameState.PLAYING && this.pauseController.shouldAcceptJump()) {
        this.player.jump();
        this.audioSystem.playJump();
      }
    };

    this.inputHandler.onPause = () => {
      if (this.stateManager.getState() === GameState.PLAYING) {
        this.stateManager.transition(GameState.PAUSED);
      }
    };

    this.inputHandler.onResume = () => {
      if (this.stateManager.getState() === GameState.PAUSED) {
        this.stateManager.transition(GameState.PLAYING);
      }
    };

    this.inputHandler.onRestart = () => {
      // Unlock audio on interaction
      this.audioSystem.unlock();

      if (this.restartController.canRestart()) {
        this.restartController.performRestart(
          this.player,
          this.pipeSystem,
          this.difficultySystem,
          this.scoreSystem
        );
        this.pauseController.reset();
        this.background.reset();
        this.cloudSystem.reset();
      }
    };
  }
}

// ============================================================
// SECTION: Initialization
// ============================================================

// Auto-start when DOM is ready (only in browser environment)
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const engine = new GameEngine(canvas);
    engine.init().then(() => engine.start()).catch(err => console.error(err));
  });
}

// ============================================================
// SECTION: Module Exports (for testability)
// ============================================================

// Export for Node.js/test environments while keeping browser compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GAME_CONFIG, circleRectCollision, checkBoundaryCollision, GameState, VALID_TRANSITIONS, StateManager, Player, InputHandler, lerp, ObjectPool, PipePool, PipeSystem, DifficultySystem, checkCollisions, ScoreSystem, PauseController, RestartController, AudioSystem, Background, CloudSystem, BatchRenderer, CanvasScaler, calculateScaledDimensions, HUD, GameEngine };
}
