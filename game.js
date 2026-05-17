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
// SECTION: Module Exports (for testability)
// ============================================================

// Export for Node.js/test environments while keeping browser compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GAME_CONFIG, circleRectCollision, checkBoundaryCollision, GameState, VALID_TRANSITIONS, StateManager };
}
