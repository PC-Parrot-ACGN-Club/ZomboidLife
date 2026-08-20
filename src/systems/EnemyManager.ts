import { GAME_CONFIG, SceneType } from '@/config/GameConfig';
import { eventBus } from '@/core/EventBus';
import { audioManager } from '@/audio/AudioManager';

export type EnemyType = 'walker' | 'laugher' | 'mimic';
export type LaugherSubState = 'idle_far' | 'stare_close' | 'hidden' | 'attacking';
export type MimicVoiceType = 'own' | 'walker' | 'laugher';

export interface EnemyInstance {
  id: string;
  type: EnemyType;
  sceneId: SceneType;
  health: number;
  maxHealth: number;
  stage: number; // 0: Far, 1: Mid, 2: Close/Attacking
  maxStage: number;
  stageProgressMs: number; // 当前阶段行进时间
  stageDurationMs: number; // 阶段完成所需时间
  isAttacking: boolean;
  attackTimerMs: number;
  isDead: boolean;

  // Laugher 特有状态机制
  laugherState?: LaugherSubState;
  laugherStateTimerMs?: number;
  laugherNextDecisionMs?: number;
  laugherTotalWanderMs?: number;

  // Mimic 特有机制
  mimicRetreated?: boolean; // 是否处于缩回黑暗状态
  mimicRetreatTimerMs?: number; // 移开视线后的探出恢复计时
  mimicVoiceTimerMs?: number; // 发声计时
  mimicVoiceVisualTimerMs?: number; // 发声强制显形计时
  mimicLastVoiceType?: MimicVoiceType; // 上次发声类型
}

export class EnemyManager {
  private enemies: Map<string, EnemyInstance> = new Map();
  private doorBoards: number = GAME_CONFIG.BARRICADES.DOOR_MAX_BOARDS;
  private windowHealth: number = GAME_CONFIG.BARRICADES.WINDOW_MAX_HEALTH;
  private cellarHealth: number = GAME_CONFIG.BARRICADES.CELLAR_MAX_HEALTH;
  private doorTurretAvailable: boolean = true;
  private cellarTrapAvailable: boolean = true;
  private isGameOver: boolean = false;
  private currentActiveScene: SceneType = GAME_CONFIG.SCENES.DOOR;

  constructor() {
    this.bindEvents();
  }

  public reset(): void {
    this.enemies.clear();
    this.doorBoards = GAME_CONFIG.BARRICADES.DOOR_MAX_BOARDS;
    this.windowHealth = GAME_CONFIG.BARRICADES.WINDOW_MAX_HEALTH;
    this.cellarHealth = GAME_CONFIG.BARRICADES.CELLAR_MAX_HEALTH;
    this.doorTurretAvailable = true;
    this.cellarTrapAvailable = true;
    this.isGameOver = false;
    this.currentActiveScene = GAME_CONFIG.SCENES.DOOR;
  }

  public hasActiveLaugher(): boolean {
    return Array.from(this.enemies.values()).some(
      (e) => e.type === 'laugher' && !e.isDead
    );
  }

  public spawnEnemy(type: EnemyType): EnemyInstance {
    const id = `enemy_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let sceneId: SceneType = 'door';
    let maxHealth = 100;
    let stageDurationMs = 2400;
    let maxStage = 2;

    if (type === 'walker') {
      sceneId = GAME_CONFIG.SCENES.DOOR;
      maxHealth = GAME_CONFIG.ENEMIES.WALKER.MAX_HEALTH;
      stageDurationMs = 2400;
      maxStage = 2;

      const enemy: EnemyInstance = {
        id,
        type,
        sceneId,
        health: maxHealth,
        maxHealth,
        stage: 0,
        maxStage,
        stageProgressMs: 0,
        stageDurationMs,
        isAttacking: false,
        attackTimerMs: 0,
        isDead: false,
      };

      this.enemies.set(id, enemy);
      eventBus.emit('ENEMY_SPAWNED', { id, type, sceneId });
      return enemy;
    } else if (type === 'laugher') {
      // 1. 同一时间窗外最多有一只 Laugher
      const existing = Array.from(this.enemies.values()).find(
        (e) => e.type === 'laugher' && !e.isDead
      );
      if (existing) {
        return existing;
      }

      sceneId = GAME_CONFIG.SCENES.WINDOW;
      maxHealth = GAME_CONFIG.ENEMIES.LAUGHER.MAX_HEALTH;
      stageDurationMs = GAME_CONFIG.ENEMIES.LAUGHER.MOVE_SPEED_MS;
      maxStage = 1;

      // 初始徘徊状态：40% 远端驻足，35% 躲在窗后，25% 贴脸凝视
      const rand = Math.random();
      const initialLaugherState: LaugherSubState =
        rand < 0.4 ? 'idle_far' : rand < 0.75 ? 'hidden' : 'stare_close';

      const decisionMin = GAME_CONFIG.ENEMIES.LAUGHER.DECISION_MIN_MS;
      const decisionMax = GAME_CONFIG.ENEMIES.LAUGHER.DECISION_MAX_MS;

      const enemy: EnemyInstance = {
        id,
        type,
        sceneId,
        health: maxHealth,
        maxHealth,
        stage: initialLaugherState === 'stare_close' ? 1 : 0,
        maxStage,
        stageProgressMs: 0,
        stageDurationMs,
        isAttacking: false,
        attackTimerMs: 0,
        isDead: false,
        laugherState: initialLaugherState,
        laugherStateTimerMs: 0,
        laugherNextDecisionMs: decisionMin + Math.random() * (decisionMax - decisionMin),
        laugherTotalWanderMs: 0,
      };

      this.enemies.set(id, enemy);
      eventBus.emit('ENEMY_SPAWNED', { id, type, sceneId });
      return enemy;
    } else {
      // mimic
      sceneId = GAME_CONFIG.SCENES.CELLAR;
      maxHealth = GAME_CONFIG.ENEMIES.MIMIC.MAX_HEALTH;
      stageDurationMs = GAME_CONFIG.ENEMIES.MIMIC.MOVE_SPEED_MS;
      maxStage = 2;

      const voiceMin = GAME_CONFIG.ENEMIES.MIMIC.VOICE_INTERVAL_MIN_MS;
      const voiceMax = GAME_CONFIG.ENEMIES.MIMIC.VOICE_INTERVAL_MAX_MS;

      const enemy: EnemyInstance = {
        id,
        type,
        sceneId,
        health: maxHealth,
        maxHealth,
        stage: 0,
        maxStage,
        stageProgressMs: 0,
        stageDurationMs,
        isAttacking: false,
        attackTimerMs: 0,
        isDead: false,
        mimicRetreated: this.currentActiveScene === 'cellar', // 若玩家此时正看地窖，则初始缩在黑暗中
        mimicRetreatTimerMs: 0,
        mimicVoiceTimerMs: voiceMin + Math.random() * (voiceMax - voiceMin),
        mimicVoiceVisualTimerMs: 0,
        mimicLastVoiceType: 'own',
      };

      this.enemies.set(id, enemy);
      eventBus.emit('ENEMY_SPAWNED', { id, type, sceneId });
      return enemy;
    }
  }

  public update(deltaMs: number): void {
    if (this.isGameOver) return;

    for (const [id, enemy] of this.enemies.entries()) {
      if (enemy.isDead) {
        this.enemies.delete(id);
        continue;
      }

      if (enemy.type === 'walker') {
        this.updateWalker(enemy, deltaMs);
      } else if (enemy.type === 'laugher') {
        this.updateLaugher(enemy, deltaMs);
      } else if (enemy.type === 'mimic') {
        this.updateMimic(enemy, deltaMs);
      }
    }
  }

  private updateWalker(enemy: EnemyInstance, deltaMs: number): void {
    if (enemy.stage < enemy.maxStage) {
      enemy.stageProgressMs += deltaMs;
      if (enemy.stageProgressMs >= enemy.stageDurationMs) {
        enemy.stageProgressMs = 0;
        enemy.stage++;
        if (enemy.stage === 1) {
          audioManager.playDoorWoodHit(0.0);
        } else if (enemy.stage === enemy.maxStage) {
          enemy.isAttacking = true;
          enemy.attackTimerMs = 0;
        }
      }
    } else {
      this.handleEnemyAttacking(enemy, deltaMs);
    }
  }

  private updateLaugher(enemy: EnemyInstance, deltaMs: number): void {
    if (enemy.laugherState !== 'attacking') {
      enemy.laugherStateTimerMs = (enemy.laugherStateTimerMs || 0) + deltaMs;
      enemy.laugherTotalWanderMs = (enemy.laugherTotalWanderMs || 0) + deltaMs;

      const nextDecision = enemy.laugherNextDecisionMs || 3000;
      if (enemy.laugherStateTimerMs >= nextDecision) {
        enemy.laugherStateTimerMs = 0;

        const maxWander = GAME_CONFIG.ENEMIES.LAUGHER.MAX_WANDER_TIME_MS;
        const mustAttack = (enemy.laugherTotalWanderMs || 0) >= maxWander;
        const willAttack = mustAttack || Math.random() < GAME_CONFIG.ENEMIES.LAUGHER.ATTACK_CHANCE;

        if (willAttack) {
          // 决定攻击：必定贴在窗前，并发出诡异笑声与敲窗声
          enemy.laugherState = 'attacking';
          enemy.stage = 1;
          enemy.isAttacking = true;
          enemy.attackTimerMs = 0;

          audioManager.playWindowGlassTap(0.75);
          audioManager.playLaugherEerieSound(0.75);
          eventBus.emit('LAUGHER_ATTACK_DECIDED', { id: enemy.id });
        } else {
          // 在 远处不动(idle_far) / 贴脸不动(stare_close) / 躲在窗后(hidden) 间随机转换
          const states: LaugherSubState[] = ['idle_far', 'stare_close', 'hidden'];
          const otherStates = states.filter((s) => s !== enemy.laugherState);
          enemy.laugherState = otherStates[Math.floor(Math.random() * otherStates.length)];
          enemy.stage = enemy.laugherState === 'stare_close' ? 1 : 0;

          const decisionMin = GAME_CONFIG.ENEMIES.LAUGHER.DECISION_MIN_MS;
          const decisionMax = GAME_CONFIG.ENEMIES.LAUGHER.DECISION_MAX_MS;
          enemy.laugherNextDecisionMs = decisionMin + Math.random() * (decisionMax - decisionMin);
        }
      }
    } else {
      // 正在破窗突袭
      this.handleEnemyAttacking(enemy, deltaMs);
    }
  }

  private updateMimic(enemy: EnemyInstance, deltaMs: number): void {
    // 1. 发声显形计时器更新
    if (enemy.mimicVoiceVisualTimerMs && enemy.mimicVoiceVisualTimerMs > 0) {
      enemy.mimicVoiceVisualTimerMs -= deltaMs;
    }

    // 2. 发声定时器 (发出自身声音或模仿 Walker/Laugher，发声时必定在地图/画面上可见)
    enemy.mimicVoiceTimerMs = (enemy.mimicVoiceTimerMs || 4000) - deltaMs;
    if (enemy.mimicVoiceTimerMs <= 0) {
      const voiceMin = GAME_CONFIG.ENEMIES.MIMIC.VOICE_INTERVAL_MIN_MS;
      const voiceMax = GAME_CONFIG.ENEMIES.MIMIC.VOICE_INTERVAL_MAX_MS;
      enemy.mimicVoiceTimerMs = voiceMin + Math.random() * (voiceMax - voiceMin);

      const r = Math.random();
      const voiceType: MimicVoiceType = r < 0.4 ? 'own' : r < 0.7 ? 'walker' : 'laugher';
      enemy.mimicLastVoiceType = voiceType;

      // 播放声音 (声源固定在左侧地窖)
      audioManager.playMimicSound(voiceType);

      // 发声时必定在地图/画面可见
      enemy.mimicVoiceVisualTimerMs = GAME_CONFIG.ENEMIES.MIMIC.VOICE_VISIBILITY_DURATION_MS;
      enemy.mimicRetreated = false; // 破除隐蔽露头发声
      eventBus.emit('MIMIC_VOICE_EMITTED', { id: enemy.id, voiceType });
    }

    // 3. 视线对抗与移动逻辑
    const isPlayerLooking = this.currentActiveScene === 'cellar';
    const isVoiceActive = (enemy.mimicVoiceVisualTimerMs || 0) > 0;

    if (enemy.stage === 0) {
      // 在梯底
      if (isPlayerLooking) {
        if (!isVoiceActive) {
          // 玩家看到底部 Mimic，Mimic 缩回黑暗深处并暂停上爬
          enemy.mimicRetreated = true;
          enemy.stageProgressMs = 0;
        }
      } else {
        // 玩家不在地窖
        if (enemy.mimicRetreated) {
          enemy.mimicRetreatTimerMs = (enemy.mimicRetreatTimerMs || 0) + deltaMs;
          if (enemy.mimicRetreatTimerMs >= GAME_CONFIG.ENEMIES.MIMIC.RETREAT_COOLDOWN_MS) {
            enemy.mimicRetreated = false;
            enemy.mimicRetreatTimerMs = 0;
          }
        } else {
          // 探出后开始向上攀爬
          enemy.stageProgressMs += deltaMs;
          if (enemy.stageProgressMs >= enemy.stageDurationMs) {
            enemy.stageProgressMs = 0;
            enemy.stage = 1; // 爬到梯子中段
            audioManager.playCellarLadderSound(-0.75);
          }
        }
      }
    } else if (enemy.stage === 1) {
      // 在梯子中段：无论玩家是否看到，继续上爬！
      enemy.stageProgressMs += deltaMs;
      if (enemy.stageProgressMs >= enemy.stageDurationMs) {
        enemy.stageProgressMs = 0;
        enemy.stage = 2; // 爬至门顶
        enemy.isAttacking = true;
        audioManager.playCellarLadderSound(-0.75);
      }
    } else {
      // 在门顶攻击活板门
      this.handleEnemyAttacking(enemy, deltaMs);
    }
  }

  private handleEnemyAttacking(enemy: EnemyInstance, deltaMs: number): void {
    enemy.attackTimerMs += deltaMs;

    if (enemy.type === 'walker') {
      const interval = GAME_CONFIG.ENEMIES.WALKER.ATTACK_INTERVAL_MS;
      if (enemy.attackTimerMs >= interval) {
        enemy.attackTimerMs = 0;

        if (this.doorBoards > 0) {
          // 正在拆除木板
          this.doorBoards--;
          audioManager.playDoorWoodHit(0.0);
          eventBus.emit('BARRICADE_DAMAGED', {
            sceneId: 'door',
            currentHealth: Math.max(0, this.doorBoards),
            maxHealth: GAME_CONFIG.BARRICADES.DOOR_MAX_BOARDS,
          });

          // 正门木板被彻底攻破！检查容错机制
          if (this.doorBoards === 0) {
            if (this.doorTurretAvailable) {
              this.triggerDoorTurretFaultTolerance();
            }
          }
        } else {
          // 木板已全毁且机枪已耗尽，怪物直接冲入
          this.triggerGameOver('正门木板全毁且机枪耗尽，行者冲入室内！');
        }
      }
    } else if (enemy.type === 'laugher') {
      // 笑者在窗前停留超过破窗时间直接破窗
      const breakTime = GAME_CONFIG.ENEMIES.LAUGHER.BREAK_WINDOW_TIME_MS;
      if (enemy.attackTimerMs >= breakTime) {
        this.windowHealth = 0;
        audioManager.playWindowGlassTap(0.75);
        this.triggerGameOver('笑者破窗而入！');
      }
    } else if (enemy.type === 'mimic') {
      const interval = GAME_CONFIG.ENEMIES.MIMIC.ATTACK_INTERVAL_MS;
      if (enemy.attackTimerMs >= interval) {
        enemy.attackTimerMs = 0;

        if (this.cellarHealth > 0) {
          // 猛击活板门
          this.cellarHealth = Math.max(0, this.cellarHealth - 35);
          audioManager.playCellarLadderSound(-0.75);
          eventBus.emit('BARRICADE_DAMAGED', {
            sceneId: 'cellar',
            currentHealth: this.cellarHealth,
            maxHealth: GAME_CONFIG.BARRICADES.CELLAR_MAX_HEALTH,
          });

          // 活板门被彻底攻破！检查容错机制
          if (this.cellarHealth === 0) {
            if (this.cellarTrapAvailable) {
              this.triggerCellarTrapFaultTolerance();
            }
          }
        } else {
          // 活板门已被破坏且陷阱已消耗，怪物直接爬出
          this.triggerGameOver('活板门被撞开且陷阱已消耗，拟态者爬入室内！');
        }
      }
    }
  }

  /**
   * 触发正门自动机枪容错机制：清除正门路上所有僵尸，机枪弹药耗尽
   */
  private triggerDoorTurretFaultTolerance(): void {
    this.doorTurretAvailable = false;
    const doorEnemies = Array.from(this.enemies.values()).filter(
      (e) => e.sceneId === 'door' && !e.isDead
    );

    for (const e of doorEnemies) {
      e.isDead = true;
      this.enemies.delete(e.id);
      eventBus.emit('ENEMY_KILLED', {
        id: e.id,
        type: e.type,
        sceneId: e.sceneId,
      });
    }

    audioManager.playTurretFire();
    console.log(`[Fault Tolerance] 室内自动机枪开火！清除了正门 ${doorEnemies.length} 只僵尸！弹药耗尽`);
    eventBus.emit('FAULT_TOLERANCE_TRIGGERED', {
      type: 'turret',
      sceneId: 'door',
      message: '🚨 室内自动机枪开火！正门僵尸全灭！(机枪弹药已耗尽)',
      clearedCount: doorEnemies.length,
    });
  }

  /**
   * 触发地窖陷阱容错机制：清除梯子上所有怪，陷阱消耗
   */
  private triggerCellarTrapFaultTolerance(): void {
    this.cellarTrapAvailable = false;
    const cellarEnemies = Array.from(this.enemies.values()).filter(
      (e) => e.sceneId === 'cellar' && !e.isDead
    );

    for (const e of cellarEnemies) {
      e.isDead = true;
      this.enemies.delete(e.id);
      eventBus.emit('ENEMY_KILLED', {
        id: e.id,
        type: e.type,
        sceneId: e.sceneId,
      });
    }

    audioManager.playTrapTrigger();
    console.log(`[Fault Tolerance] 预设陷阱触发！砸死地窖梯子上 ${cellarEnemies.length} 只怪物！陷阱已消耗`);
    eventBus.emit('FAULT_TOLERANCE_TRIGGERED', {
      type: 'trap',
      sceneId: 'cellar',
      message: '⚙️ 预设陷阱触发！落石砸死梯子上所有怪物！(陷阱已消耗)',
      clearedCount: cellarEnemies.length,
    });
  }

  /**
   * 玩家攻击命中判定
   */
  public hitEnemiesInScene(
    sceneId: SceneType,
    weaponType: 'shotgun' | 'knife',
    damage: number
  ): boolean {
    const targets = Array.from(this.enemies.values()).filter(
      (e) => e.sceneId === sceneId && !e.isDead
    );

    if (targets.length === 0) return false;

    // 战术刀只能攻击处于 Close/Attacking 状态的怪
    if (weaponType === 'knife') {
      const closeTarget = targets.find((e) => {
        if (e.type === 'laugher') {
          // 只有在 Laugher 准备发动攻击时才能用刀攻击它
          return e.laugherState === 'attacking';
        }
        return e.stage === e.maxStage;
      });
      if (closeTarget) {
        return this.applyDamage(closeTarget, damage);
      }
      return false;
    }

    // 霰弹枪攻击逻辑
    if (sceneId === 'window') {
      const laugher = targets.find((e) => e.type === 'laugher');
      if (laugher) {
        if (laugher.laugherState === 'attacking') {
          // 只有在 Laugher 准备发动攻击时才能用枪造成伤害
          return this.applyDamage(laugher, damage);
        } else {
          // Laugher 没攻击时，玩家在窗口开枪会把 Laugher 吓走
          return this.scareAwayLaugher(laugher);
        }
      }
      return false;
    }

    // 霰弹枪在正门/地窖优先攻击最近的敌人，同时造成范围伤害
    // 找到当前场景中 stage 最高的怪
    targets.sort((a, b) => b.stage - a.stage);
    const primary = targets[0];
    return this.applyDamage(primary, damage);
  }

  /**
   * 玩家在窗口开枪吓退未发动攻击的笑者 (缩回草坪远处，不逃离场景)
   */
  public scareAwayLaugher(laugher: EnemyInstance): boolean {
    if (laugher.isDead) return false;

    // 吓退回草坪远端 idle_far 状态，重置决断计时
    laugher.laugherState = 'idle_far';
    laugher.stage = 0;
    laugher.laugherStateTimerMs = 0;
    const decisionMin = GAME_CONFIG.ENEMIES.LAUGHER.DECISION_MIN_MS;
    const decisionMax = GAME_CONFIG.ENEMIES.LAUGHER.DECISION_MAX_MS;
    laugher.laugherNextDecisionMs = decisionMin + Math.random() * (decisionMax - decisionMin);

    audioManager.playLaugherFleeSound(0.75);
    console.log(`[Laugher] 窗口枪声惊吓！笑者受惊缩回草坪远处！id: ${laugher.id}`);

    eventBus.emit('LAUGHER_SCARED_AWAY', { id: laugher.id });
    return true;
  }

  private applyDamage(enemy: EnemyInstance, damage: number): boolean {
    enemy.health -= damage;
    audioManager.playHitFlesh();
    eventBus.emit('ENEMY_DAMAGED', { id: enemy.id, damage });

    if (enemy.health <= 0) {
      enemy.isDead = true;
      this.enemies.delete(enemy.id);
      eventBus.emit('ENEMY_KILLED', {
        id: enemy.id,
        type: enemy.type,
        sceneId: enemy.sceneId,
      });
      return true;
    }
    return true;
  }

  public getEnemiesForScene(sceneId: SceneType): EnemyInstance[] {
    return Array.from(this.enemies.values()).filter(
      (e) => e.sceneId === sceneId && !e.isDead
    );
  }

  public getAllActiveEnemies(): EnemyInstance[] {
    return Array.from(this.enemies.values()).filter((e) => !e.isDead);
  }

  public getDoorBoards(): number {
    return this.doorBoards;
  }

  public getWindowHealth(): number {
    return this.windowHealth;
  }

  public getCellarHealth(): number {
    return this.cellarHealth;
  }

  public isDoorTurretAvailable(): boolean {
    return this.doorTurretAvailable;
  }

  public isCellarTrapAvailable(): boolean {
    return this.cellarTrapAvailable;
  }

  private triggerGameOver(reason: string): void {
    if (this.isGameOver) return;
    this.isGameOver = true;
    audioManager.playGameOver();
    console.log(`[GAME OVER] ${reason}`);
    eventBus.emit('GAME_OVER', {
      survivalTime: 0,
      kills: 0,
      waves: 0,
    });
  }

  private bindEvents(): void {
    eventBus.on('GAME_RESTART', () => {
      this.reset();
    });

    eventBus.on('SCENE_CHANGED', (sceneId: SceneType) => {
      this.currentActiveScene = sceneId;
      // 当玩家切到地窖场景时，若 Mimic 正在梯底且未处于发声显形期，立即触发缩回黑暗
      if (sceneId === 'cellar') {
        for (const enemy of this.enemies.values()) {
          if (
            enemy.type === 'mimic' &&
            !enemy.isDead &&
            enemy.stage === 0 &&
            (!enemy.mimicVoiceVisualTimerMs || enemy.mimicVoiceVisualTimerMs <= 0)
          ) {
            enemy.mimicRetreated = true;
            enemy.stageProgressMs = 0;
          }
        }
      }
    });
  }
}
