export const GAME_CONFIG = {
  // 画布分辨率 (原生 16:9)
  CANVAS_WIDTH: 1280,
  CANVAS_HEIGHT: 720,

  // 场景定义
  SCENES: {
    DOOR: 'door' as const,
    WINDOW: 'window' as const,
    CELLAR: 'cellar' as const,
  },

  // 武器参数
  WEAPONS: {
    SHOTGUN: {
      NAME: 'shotgun' as const,
      MAGAZINE_SIZE: 3,
      RELOAD_TIME_MS: 1500,
      DAMAGE: 100,
      NOISE_INTENSITY: 1.0, // 激增噪音
      COOLDOWN_MS: 400,
    },
    KNIFE: {
      NAME: 'knife' as const,
      MAGAZINE_SIZE: Infinity,
      RELOAD_TIME_MS: 0,
      DAMAGE: 50,
      NOISE_INTENSITY: 0.0, // 完全静音
      COOLDOWN_MS: 300,
    },
  },

  // 敌人属性
  ENEMIES: {
    WALKER: {
      TYPE: 'walker' as const,
      TARGET_SCENE: 'door' as const,
      MAX_HEALTH: 100,
      MOVE_SPEED_MS: 4000, // 从远处到达门前所需时间
      ATTACK_INTERVAL_MS: 2000, // 拆板间隔
    },
    LAUGHER: {
      TYPE: 'laugher' as const,
      TARGET_SCENE: 'window' as const,
      MAX_HEALTH: 80,
      MOVE_SPEED_MS: 2800, // 移动较快
      BREAK_WINDOW_TIME_MS: 3000, // 到达窗户后破窗倒计时
    },
    MIMIC: {
      TYPE: 'mimic' as const,
      TARGET_SCENE: 'cellar' as const,
      MAX_HEALTH: 90,
      MOVE_SPEED_MS: 3500,
      ATTACK_INTERVAL_MS: 2500,
    },
  },

  // 波次与刷怪算法
  WAVE: {
    BASE_INTERVAL_MS: 4500,
    MIN_INTERVAL_MS: 800,
    NOISE_DECAY_RATE: 0.35, // 噪音衰减速度 (每秒)
    REST_TIME_MS: 4000, // 波次结束休整时间
  },

  // 防御工事
  BARRICADES: {
    DOOR_MAX_BOARDS: 3,
    WINDOW_MAX_HEALTH: 100,
    CELLAR_MAX_HEALTH: 100,
  },
};

export type SceneType = (typeof GAME_CONFIG.SCENES)[keyof typeof GAME_CONFIG.SCENES];
export type WeaponType = 'shotgun' | 'knife';
