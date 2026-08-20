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
      MOVE_SPEED_MS: 2600, // 移动时间 (适度放宽至 2600ms)
      BREAK_WINDOW_TIME_MS: 3200, // 到达窗户后破窗倒计时 (适度放宽至 3200ms)
      DECISION_MIN_MS: 2600, // 徘徊状态决策最短时间
      DECISION_MAX_MS: 4800, // 徘徊状态决策最长时间
      ATTACK_CHANCE: 0.35, // 每次决断时发动攻击的概率
      MAX_WANDER_TIME_MS: 12000, // 最大徘徊时间 (超时后必定发动攻击)
    },
    MIMIC: {
      TYPE: 'mimic' as const,
      TARGET_SCENE: 'cellar' as const,
      MAX_HEALTH: 90,
      MOVE_SPEED_MS: 2800, // 爬梯阶段时间
      ATTACK_INTERVAL_MS: 2400,
      VOICE_INTERVAL_MIN_MS: 3500, // 发声最小间隔
      VOICE_INTERVAL_MAX_MS: 6000, // 发声最大间隔
      VOICE_VISIBILITY_DURATION_MS: 2500, // 发声时强制显形持续时间
      RETREAT_COOLDOWN_MS: 2500, // 玩家移开视线后恢复探出的时间
    },
  },

  // 波次与刷怪算法
  WAVE: {
    BASE_INTERVAL_MS: 3200, // 基础刷新间隔 (略微提高刷怪速度，从 4500ms 降至 3200ms)
    MIN_INTERVAL_MS: 600, // 极限最小刷新间隔 (从 800ms 降至 600ms)
    NOISE_DECAY_RATE: 0.35, // 噪音衰减速度 (每秒)
    REST_TIME_MS: 3000, // 波次结束休整时间 (从 4000ms 降至 3000ms)
    // 刷怪概率权重配置 (大幅降低 Laugher 占比)
    SPAWN_WEIGHTS: {
      WAVE_1: { walker: 0.85, laugher: 0.15, mimic: 0.00 }, // 第一波：行者 85%, 笑者 15%
      WAVE_2: { walker: 0.65, laugher: 0.15, mimic: 0.20 }, // 第二波：行者 65%, 笑者 15%, 拟态者 20%
      WAVE_DEFAULT: { walker: 0.55, laugher: 0.15, mimic: 0.30 }, // 后续波次：行者 55%, 笑者 15%, 拟态者 30%
    },
    // Laugher 刷新频率与防扎堆控制
    LAUGHER_CONFIG: {
      MIN_SPACING: 2, // 队列中两个 Laugher 之间至少间隔 2 只其他怪物
      EXTRA_SPAWN_DELAY_MS: 800, // 刷新 Laugher 时的额外延迟缓冲，降低瞬时频率
    },
  },

  // 防御工事与容错机制
  BARRICADES: {
    DOOR_MAX_BOARDS: 3,
    WINDOW_MAX_HEALTH: 100,
    CELLAR_MAX_HEALTH: 100,
    DOOR_TURRET_ENABLED: true, // 正门木板被攻破时自动机枪清除一次
    CELLAR_TRAP_ENABLED: true, // 活板门被攻破时落石/尖刺陷阱清除一次
  },

  // AI 自动游玩/观战模式配置
  AI: {
    DECISION_INTERVAL_MS: 80, // AI 思考与决策刷新周期 (毫秒)
    ACTION_DELAY_MS: 100, // 切换场景后的微量瞄准延迟 (保证打击感与视觉平滑)
    PATROL_INTERVAL_MS: 1600, // 安全期/巡视期的全防线轮巡间隔
    MAX_NOISE_PREFERENCE: 2.0, // 噪音容忍阈值
  },
};

export type SceneType = (typeof GAME_CONFIG.SCENES)[keyof typeof GAME_CONFIG.SCENES];
export type WeaponType = 'shotgun' | 'knife';
