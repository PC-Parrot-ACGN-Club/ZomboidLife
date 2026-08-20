import { GAME_CONFIG, SceneType } from '@/config/GameConfig';
import { eventBus } from '@/core/EventBus';
import { EnemyInstance, EnemyManager } from './EnemyManager';
import { WeaponSystem } from './WeaponSystem';
import { WaveSystem } from './WaveSystem';
import { SceneManager } from '@/scenes/SceneManager';

export interface SceneThreatAssessment {
  sceneId: SceneType;
  threat: number; // 0 ~ 3000
  reason: string;
  priorityTarget?: EnemyInstance;
}

export class AISystem {
  private enabled: boolean = false;
  private enemyManager: EnemyManager;
  private weaponSystem: WeaponSystem;
  private waveSystem: WaveSystem;
  private sceneManager: SceneManager;

  private decisionTimerMs: number = 0;
  private actionDelayTimerMs: number = 0;
  private patrolTimerMs: number = 0;
  private patrolIndex: number = 0;
  private readonly patrolOrder: SceneType[] = [
    GAME_CONFIG.SCENES.DOOR,
    GAME_CONFIG.SCENES.WINDOW,
    GAME_CONFIG.SCENES.CELLAR,
  ];

  // AI 状态与决策广播数据
  private currentState: string = '待机中';
  private currentThought: string = 'AI 核心已就绪，等待激活指令';
  private currentActionText: string = '无动作';
  private lastTargetScene: SceneType = GAME_CONFIG.SCENES.DOOR;
  private lastThreats = { door: 0, window: 0, cellar: 0 };

  constructor(
    enemyManager: EnemyManager,
    weaponSystem: WeaponSystem,
    waveSystem: WaveSystem,
    sceneManager: SceneManager
  ) {
    this.enemyManager = enemyManager;
    this.weaponSystem = weaponSystem;
    this.waveSystem = waveSystem;
    this.sceneManager = sceneManager;

    this.bindEvents();
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    this.decisionTimerMs = 0;
    this.actionDelayTimerMs = 0;
    this.patrolTimerMs = 0;

    if (this.enabled) {
      this.currentState = '🟢 战术系统接管';
      this.currentThought = 'AI 防守决策网络已全面激活，正在全方位扫描 3 路防线...';
      this.currentActionText = '初始化态势感知雷达';
    } else {
      this.currentState = '⚪ 手动操作';
      this.currentThought = 'AI 托管已关闭，控制权已移交玩家';
      this.currentActionText = '待命中';
    }

    eventBus.emit('AI_MODE_TOGGLED', this.enabled);
    this.broadcastThought();
  }

  public toggle(): void {
    this.setEnabled(!this.enabled);
  }

  public reset(): void {
    this.decisionTimerMs = 0;
    this.actionDelayTimerMs = 0;
    this.patrolTimerMs = 0;
    this.patrolIndex = 0;
    if (this.enabled) {
      this.currentState = '🟢 战术系统接管';
      this.currentThought = '新对局启动，AI 正在分析第一波进攻队列...';
      this.currentActionText = '严密监视';
      this.broadcastThought();
    }
  }

  public update(deltaMs: number): void {
    if (!this.enabled) return;

    if (this.actionDelayTimerMs > 0) {
      this.actionDelayTimerMs -= deltaMs;
    }

    this.decisionTimerMs += deltaMs;
    const interval = GAME_CONFIG.AI?.DECISION_INTERVAL_MS || 80;

    if (this.decisionTimerMs >= interval) {
      this.decisionTimerMs = 0;
      this.evaluateAndExecute(deltaMs);
    }
  }

  /**
   * 核心决策与行动执行管线
   */
  private evaluateAndExecute(deltaMs: number): void {
    const doorAssessment = this.calculateDoorThreat();
    const windowAssessment = this.calculateWindowThreat();
    const cellarAssessment = this.calculateCellarThreat();

    this.lastThreats = {
      door: Math.min(100, Math.round(doorAssessment.threat / 10)),
      window: Math.min(100, Math.round(windowAssessment.threat / 10)),
      cellar: Math.min(100, Math.round(cellarAssessment.threat / 10)),
    };

    const assessments: SceneThreatAssessment[] = [
      doorAssessment,
      windowAssessment,
      cellarAssessment,
    ];

    // 找到最高威胁的场景
    assessments.sort((a, b) => b.threat - a.threat);
    const topThreat = assessments[0];
    const currentSceneId = this.sceneManager.getCurrentSceneId();
    const isWaveResting = this.waveSystem.getIsWaveResting();
    const activeEnemiesCount = this.enemyManager.getAllActiveEnemies().length;
    const shotgunAmmo = this.weaponSystem.getAmmo();
    const isReloading = this.weaponSystem.getIsReloading();
    const currentWeapon = this.weaponSystem.getCurrentWeapon();

    // ==========================================
    // 决策分支 1: 波次休整期 (Wave Rest Period)
    // ==========================================
    if (isWaveResting && activeEnemiesCount === 0) {
      this.currentState = '🛡️ 阵地整备 / 满弹巡防';
      this.lastTargetScene = GAME_CONFIG.SCENES.DOOR;

      if (shotgunAmmo < GAME_CONFIG.WEAPONS.SHOTGUN.MAGAZINE_SIZE) {
        if (currentWeapon !== 'shotgun') {
          this.weaponSystem.setWeapon('shotgun');
        }
        if (!isReloading) {
          this.weaponSystem.startReload();
        }
        this.currentThought = `波次已清空，利用休整安全期压满霰弹枪弹药 (${shotgunAmmo}/8)...`;
        this.currentActionText = `⚡ 战术装填中 (${shotgunAmmo}/8)`;
      } else {
        this.currentThought = `武器弹药已全满 (8/8)，正门木板与防御装置就绪，等待下一波敌人进攻`;
        this.currentActionText = `👀 保持警戒`;
        if (currentSceneId !== GAME_CONFIG.SCENES.DOOR) {
          this.sceneManager.switchTo(GAME_CONFIG.SCENES.DOOR);
        }
      }
      this.broadcastThought();
      return;
    }

    // ==========================================
    // 决策分支 2: 紧急交火应对 (Active High/Critical Threat >= 200)
    // ==========================================
    if (topThreat.threat >= 200) {
      this.lastTargetScene = topThreat.sceneId;

      // 1. 若尚未切到最高威胁场景，立即执行精准切屏
      if (currentSceneId !== topThreat.sceneId) {
        this.currentState = '🚨 紧急战术转场';
        this.currentThought = topThreat.reason;
        this.currentActionText = `🔄 快速切入【${this.getSceneName(topThreat.sceneId)}】`;
        this.sceneManager.switchTo(topThreat.sceneId);
        this.actionDelayTimerMs = GAME_CONFIG.AI?.ACTION_DELAY_MS || 100;
        this.broadcastThought();
        return;
      }

      // 2. 已在目标场景，若处于转场延迟中，等待瞄准平滑
      if (this.actionDelayTimerMs > 0) {
        this.currentState = '🎯 锁定敌对目标';
        this.currentThought = topThreat.reason;
        this.currentActionText = `📐 瞄准敌怪躯干...`;
        this.broadcastThought();
        return;
      }

      // 3. 执行武器选择与击杀判定
      const targetEnemy = topThreat.priorityTarget;
      const isCloseRange =
        targetEnemy &&
        (targetEnemy.stage === targetEnemy.maxStage ||
          (targetEnemy.type === 'laugher' && targetEnemy.laugherState === 'attacking'));

      // 弹药与武器策略
      if (shotgunAmmo > 0) {
        // 霰弹枪有弹：优先使用霰弹枪 (100 伤害一枪必杀)
        if (currentWeapon !== 'shotgun') {
          this.weaponSystem.setWeapon('shotgun');
        }

        if (this.weaponSystem.getAttackCooldownMs() <= 0) {
          this.currentState = '💥 霰弹枪重火歼敌';
          this.currentThought = topThreat.reason;
          this.currentActionText = `🔥 霰弹枪开火！打击 [${targetEnemy?.type?.toUpperCase() || 'ENEMY'}]`;
          this.weaponSystem.attack();
        } else {
          this.currentState = '⚙️ 上膛推弹冷却';
          this.currentThought = `霰弹枪泵动上膛中，即将连续开火...`;
          this.currentActionText = `⏳ 泵动冷却中`;
        }
      } else {
        // 霰弹枪空弹 (0/8)
        if (isCloseRange) {
          // 敌人已在近战距离：果断切战术刀连击近战自卫
          if (currentWeapon !== 'knife') {
            this.weaponSystem.setWeapon('knife');
          }
          if (this.weaponSystem.getAttackCooldownMs() <= 0) {
            this.currentState = '🔪 静音战术刀近战';
            this.currentThought = `霰弹枪弹药耗尽且敌人近身，切换战术刀连续挥砍！`;
            this.currentActionText = `🗡️ 战术刀刺击 [${targetEnemy?.type?.toUpperCase() || 'ENEMY'}]`;
            this.weaponSystem.attack();
          } else {
            this.currentState = '🔪 近战挥砍准备';
            this.currentActionText = `⏳ 挥刀冷却中`;
          }
        } else {
          // 敌人还在中远距离：必须利用距离装填霰弹枪
          if (currentWeapon !== 'shotgun') {
            this.weaponSystem.setWeapon('shotgun');
          }
          if (!isReloading) {
            this.weaponSystem.startReload();
          }
          this.currentState = '⚡ 紧急压弹装填';
          this.currentThought = `敌人尚在中远距离，争分夺秒压入弹药，准备拦截！`;
          this.currentActionText = `⏳ 逐发装填 (${shotgunAmmo}/8)...`;
        }
      }

      this.broadcastThought();
      return;
    }

    // ==========================================
    // 决策分支 3: 低威胁巡视与战术装弹 (Threat < 200)
    // ==========================================
    // 若霰弹枪未满，优先在安全期装弹
    if (shotgunAmmo < GAME_CONFIG.WEAPONS.SHOTGUN.MAGAZINE_SIZE) {
      if (currentWeapon !== 'shotgun') {
        this.weaponSystem.setWeapon('shotgun');
      }
      if (!isReloading) {
        this.weaponSystem.startReload();
      }
      this.currentState = '⚡ 战术弹药补给';
      this.currentThought = `当前战局平缓，无致命威胁，正在压入霰弹枪弹药 (${shotgunAmmo}/8)...`;
      this.currentActionText = `⏳ 战术装填中 (${shotgunAmmo}/8)`;
      this.broadcastThought();
      return;
    }

    // 霰弹枪已满弹 (8/8)
    // 检查是否有远端潜在威胁需要主动清除或视线压制
    if (topThreat.threat > 0 && topThreat.priorityTarget) {
      this.lastTargetScene = topThreat.sceneId;

      if (currentSceneId !== topThreat.sceneId) {
        this.currentState = '👀 主动防线布控';
        this.currentThought = topThreat.reason;
        this.currentActionText = `🔄 切换至【${this.getSceneName(topThreat.sceneId)}】视线布防`;
        this.sceneManager.switchTo(topThreat.sceneId);
        this.actionDelayTimerMs = GAME_CONFIG.AI?.ACTION_DELAY_MS || 100;
        this.broadcastThought();
        return;
      }

      // 如果在地窖场景且面对底部 Mimic，直视可自动压制它缩回黑暗
      if (topThreat.sceneId === 'cellar' && topThreat.priorityTarget.stage === 0) {
        const isVoice = (topThreat.priorityTarget.mimicVoiceVisualTimerMs || 0) > 0;
        if (isVoice && this.weaponSystem.getAttackCooldownMs() <= 0) {
          this.currentState = '💥 精准狙杀显形拟态者';
          this.currentThought = `梯底拟态者发声显形！霰弹枪远距狙杀！`;
          this.currentActionText = `🔥 开火射击显形拟态者`;
          this.weaponSystem.attack();
        } else {
          this.currentState = '👁️ 视线压制';
          this.currentThought = `注视地窖梯底，拟态者受惊缩回黑暗深处，上爬暂停`;
          this.currentActionText = `🛡️ 视线威慑压制中`;
        }
        this.broadcastThought();
        return;
      }

      // 如果在窗户场景面对未攻击的 Laugher：AI 保持静默架枪守窗，严禁盲目开火吓退导致死循环
      if (topThreat.sceneId === 'window' && topThreat.priorityTarget.type === 'laugher') {
        this.currentState = '👀 窗口静默警戒';
        this.currentThought = '笑者在窗外徘徊未攻击，AI 保持静默满弹架枪，静候其破窗发动突袭再予击杀';
        this.currentActionText = '🛡️ 静默架枪守窗';
        this.broadcastThought();
        return;
      }

      // 其他远端敌人 (正门 Walker)：直接开火击杀
      if (this.weaponSystem.getAttackCooldownMs() <= 0) {
        this.currentState = '💥 远距离先行歼敌';
        this.currentThought = topThreat.reason;
        this.currentActionText = `🔥 霰弹枪远距射击 [${topThreat.priorityTarget.type.toUpperCase()}]`;
        this.weaponSystem.attack();
        this.broadcastThought();
        return;
      }
    }

    // 全场 0 敌人：定期轮巡各防线保持警惕
    this.patrolTimerMs += deltaMs;
    const patrolInterval = GAME_CONFIG.AI?.PATROL_INTERVAL_MS || 1600;

    if (this.patrolTimerMs >= patrolInterval) {
      this.patrolTimerMs = 0;
      this.patrolIndex = (this.patrolIndex + 1) % this.patrolOrder.length;
      const nextPatrolScene = this.patrolOrder[this.patrolIndex];
      this.lastTargetScene = nextPatrolScene;

      this.currentState = '🌐 全域安全巡查';
      this.currentThought = `全线平稳，正在轮巡【${this.getSceneName(nextPatrolScene)}】确认环境安全`;
      this.currentActionText = `🔍 巡查【${this.getSceneName(nextPatrolScene)}】`;
      this.sceneManager.switchTo(nextPatrolScene);
    } else {
      this.currentState = '🛡️ 防线监控';
      this.currentThought = `各入口防御完好，满弹状态，时刻准备迎击`;
      this.currentActionText = `👀 警戒中`;
    }

    this.broadcastThought();
  }

  // ==========================================
  // 各场景威胁度量化评估函数
  // ==========================================

  private calculateDoorThreat(): SceneThreatAssessment {
    const enemies = this.enemyManager.getEnemiesForScene('door');
    if (enemies.length === 0) {
      return {
        sceneId: 'door',
        threat: 0,
        reason: '正门走廊安全，无敌情',
      };
    }

    const sorted = [...enemies].sort((a, b) => b.stage - a.stage);
    const walker = sorted[0];
    const boards = this.enemyManager.getDoorBoards();
    const turretReady = this.enemyManager.isDoorTurretAvailable();

    if (walker.stage === 2) {
      if (boards === 0 && !turretReady) {
        return {
          sceneId: 'door',
          threat: 2800,
          reason: '🚨 致命危机：正门木板全毁且机枪耗尽，行者即将冲破室内！',
          priorityTarget: walker,
        };
      }
      if (boards <= 1) {
        return {
          sceneId: 'door',
          threat: 880,
          reason: `⚠️ 极高威胁：行者正在撕扯最后木板 (剩余木板: ${boards}/3)！`,
          priorityTarget: walker,
        };
      }
      return {
        sceneId: 'door',
        threat: 620,
        reason: `⚠️ 高威胁：行者正在撞击拆除木板 (剩余木板: ${boards}/3)`,
        priorityTarget: walker,
      };
    }

    if (walker.stage === 1) {
      const progress = walker.stageProgressMs / walker.stageDurationMs;
      return {
        sceneId: 'door',
        threat: 380 + Math.round(progress * 160),
        reason: `🚶 中威胁：行者进入走廊中段，正在逼近门前`,
        priorityTarget: walker,
      };
    }

    // stage === 0
    return {
      sceneId: 'door',
      threat: 140,
      reason: '🚶 低威胁：行者在走廊远端缓缓前行',
      priorityTarget: walker,
    };
  }

  private calculateWindowThreat(): SceneThreatAssessment {
    const enemies = this.enemyManager.getEnemiesForScene('window');
    if (enemies.length === 0) {
      return {
        sceneId: 'window',
        threat: 0,
        reason: '窗外安全，草坪无动静',
      };
    }

    const laugher = enemies[0];
    const state = laugher.laugherState || (laugher.stage === 0 ? 'idle_far' : 'attacking');

    if (state === 'attacking') {
      const breakTime = GAME_CONFIG.ENEMIES.LAUGHER.BREAK_WINDOW_TIME_MS;
      const remainingMs = Math.max(0, breakTime - laugher.attackTimerMs);
      const urgency = 1600 + Math.round((1 - remainingMs / breakTime) * 1200);
      return {
        sceneId: 'window',
        threat: urgency,
        reason: `🚨 致命危机：笑者破窗突袭中！仅剩 ${(remainingMs / 1000).toFixed(1)}s 破入！(立即开火或挥刀)`,
        priorityTarget: laugher,
      };
    }

    if (state === 'stare_close') {
      return {
        sceneId: 'window',
        threat: 80,
        reason: '👀 贴窗凝视：笑者在窗外窥探未攻击，AI 保持警戒静候其破窗突袭',
        priorityTarget: laugher,
      };
    }

    if (state === 'idle_far') {
      return {
        sceneId: 'window',
        threat: 40,
        reason: '👀 远端伫立：笑者在草坪远端观察，暂无实质威胁',
        priorityTarget: laugher,
      };
    }

    // hidden
    return {
      sceneId: 'window',
      threat: 20,
      reason: '🔍 阴影潜伏：笑者潜伏于窗框盲区，暂无实质威胁',
      priorityTarget: laugher,
    };
  }

  private calculateCellarThreat(): SceneThreatAssessment {
    const enemies = this.enemyManager.getEnemiesForScene('cellar');
    if (enemies.length === 0) {
      return {
        sceneId: 'cellar',
        threat: 0,
        reason: '地窖暗道安全，活板门完好',
      };
    }

    const sorted = [...enemies].sort((a, b) => b.stage - a.stage);
    const mimic = sorted[0];
    const cellarHealth = this.enemyManager.getCellarHealth();
    const trapReady = this.enemyManager.isCellarTrapAvailable();

    if (mimic.stage === 2) {
      if (cellarHealth <= 35 && !trapReady) {
        return {
          sceneId: 'cellar',
          threat: 2700,
          reason: '🚨 致命危机：活板门濒临破碎且陷阱耗尽，拟态者即将爬出！',
          priorityTarget: mimic,
        };
      }
      return {
        sceneId: 'cellar',
        threat: 920 + (100 - cellarHealth) * 3,
        reason: `⚠️ 极高威胁：拟态者疯狂撞击活板门 (耐久: ${cellarHealth}%)！`,
        priorityTarget: mimic,
      };
    }

    if (mimic.stage === 1) {
      const progress = mimic.stageProgressMs / mimic.stageDurationMs;
      return {
        sceneId: 'cellar',
        threat: 660 + Math.round(progress * 260),
        reason: `⚠️ 高威胁：拟态者沿梯攀爬中 (爬梯进度: ${Math.round(progress * 100)}%)！`,
        priorityTarget: mimic,
      };
    }

    // stage === 0 (梯底)
    const isVoiceActive = (mimic.mimicVoiceVisualTimerMs || 0) > 0;
    if (isVoiceActive) {
      return {
        sceneId: 'cellar',
        threat: 420,
        reason: '🔊 战术良机：拟态者在梯底发声显形，可远距离狙杀！',
        priorityTarget: mimic,
      };
    }

    if (mimic.mimicRetreated) {
      return {
        sceneId: 'cellar',
        threat: 80,
        reason: '🛡️ 拟态者受视线威慑潜伏在黑暗中',
        priorityTarget: mimic,
      };
    }

    return {
      sceneId: 'cellar',
      threat: 290,
      reason: '👀 拟态者在梯底窥探，需切入视线压制或击杀',
      priorityTarget: mimic,
    };
  }

  private getSceneName(sceneId: SceneType): string {
    const names: Record<SceneType, string> = {
      door: '正门 (1)',
      window: '窗户 (2)',
      cellar: '地窖 (3)',
    };
    return names[sceneId] || sceneId;
  }

  private broadcastThought(): void {
    eventBus.emit('AI_THOUGHT_UPDATED', {
      enabled: this.enabled,
      state: this.currentState,
      thought: this.currentThought,
      targetScene: this.lastTargetScene,
      threats: this.lastThreats,
      actionText: this.currentActionText,
    });
  }

  private bindEvents(): void {
    eventBus.on('GAME_RESTART', (data) => {
      if (data && typeof data.aiMode === 'boolean') {
        this.setEnabled(data.aiMode);
      }
      this.reset();
    });

    eventBus.on('GAME_OVER', () => {
      if (this.enabled) {
        this.currentState = '❌ 防御告破';
        this.currentThought = '防线被突破，AI 防御程序终止运行';
        this.currentActionText = '战斗结算';
        this.broadcastThought();
      }
    });
  }
}
