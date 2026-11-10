// EntrapBall VR — Core Game Balance & Mechanics Configuration
window.GAME_CONFIG = {
  DEFAULT_ROOM_NAME: 'Xellossan',
  PEER_PREFIX: 'entrapball-vr-p2p-2026-',

  // Arena Grid Settings (24x24 cells, 2m per cell = 48m x 48m arena)
  GRID_SIZE: 24,
  CELL_SIZE: 2.0,
  WALL_HEIGHT: 3.2,
  EYE_HEIGHT: 1.7,

  // Player Movement & Controls
  MOVE_SPEED: 10.5,          // meters per second
  SPRINT_MULTIPLIER: 1.35,   // Shift key boost
  DESKTOP_MOUSE_SENS: 0.0022,
  VR_TURN_SPEED: 2.3,        // radians per second for right thumbstick rotation
  PLAYER_RADIUS: 0.55,

  // Block Building & Deleting Mechanics (Moraff's Entrap + JezzBall hybrid)
  BASE_BUILD_COOLDOWN: 0.28, // ~3.5 blocks per second placement / deletion rate
  BUILD_RANGE_CELLS: 2,      // Default grid distance ahead of player
  MIN_BUILD_RANGE: 1,
  MAX_BUILD_RANGE: 5,
  BALL_CLEARANCE_MARGIN: 0.65, // Extra safety buffer (meters) beyond ball radius where walls cannot be placed

  // Customizable Pre-Game Defaults (Selectable on Start Screen)
  DEFAULT_BALL_COUNT: 3,
  MIN_BALL_COUNT: 1,
  MAX_BALL_COUNT: 10,

  DEFAULT_LIVES: 3,
  MIN_LIVES: 1,
  MAX_LIVES: 10,
  INVULNERABILITY_TIME: 3.0, // Seconds of phase shield after taking a hit

  // Capture & Trapping Thresholds
  TARGET_CAPTURE_PCT: 75,    // Capture 75% of arena OR box all balls to win level
  BALL_TRAP_MAX_CELLS: 9     // If an enclosed pocket has <= 9 open cells per ball, balls inside are contained!
};
