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
      MAGAZINE_SIZE: 8, // 泵动式霰弹枪 8 发弹容
      RELOAD_TIME_PER_SHELL_MS: 500, // 逐发装填单发耗时
      RELOAD_START_DELAY_MS: 200, // 首次压弹前置动作延迟
      DAMAGE: 100,
      NOISE_INTENSITY: 1.0, // 激增噪音
      COOLDOWN_MS: 550, // 泵动上膛冷却时间
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
      MOVE_SPEED_MS: 3200, // 从远处到达门前所需时间 (略微提速)
      ATTACK_INTERVAL_MS: 2000, // 拆板间隔
    },
    LAUGHER: {
      TYPE: 'laugher' as const,
      TARGET_SCENE: 'window' as const,
      MAX_HEALTH: 80,
      MOVE_SPEED_MS: 2200, // 移动较快 (略微提速)
      BREAK_WINDOW_TIME_MS: 2800, // 到达窗户后破窗倒计时
    },
    MIMIC: {
      TYPE: 'mimic' as const,
      TARGET_SCENE: 'cellar' as const,
      MAX_HEALTH: 90,
      MOVE_SPEED_MS: 2800, // 略微提速
      ATTACK_INTERVAL_MS: 2400,
    },
  },

  // 波次与刷怪算法
  WAVE: {
    BASE_INTERVAL_MS: 3200, // 基础刷新间隔 (略微提高刷怪速度，从 4500ms 降至 3200ms)
    MIN_INTERVAL_MS: 600, // 极限最小刷新间隔 (从 800ms 降至 600ms)
    NOISE_DECAY_RATE: 0.35, // 噪音衰减速度 (每秒)
    REST_TIME_MS: 3000, // 波次结束休整时间 (从 4000ms 降至 3000ms)
  },

  // 防御工事与容错机制
  BARRICADES: {
    DOOR_MAX_BOARDS: 3,
    WINDOW_MAX_HEALTH: 100,
    CELLAR_MAX_HEALTH: 100,
    DOOR_TURRET_ENABLED: true, // 正门木板被攻破时自动机枪清除一次
    CELLAR_TRAP_ENABLED: true, // 活板门被攻破时落石/尖刺陷阱清除一次
  },
};

export type SceneType = (typeof GAME_CONFIG.SCENES)[keyof typeof GAME_CONFIG.SCENES];
export type WeaponType = 'shotgun' | 'knife';
