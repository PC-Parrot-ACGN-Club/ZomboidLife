import { GAME_CONFIG, SceneType } from '@/config/GameConfig';
import { eventBus } from '@/core/EventBus';
import { audioManager } from '@/audio/AudioManager';

export type EnemyType = 'walker' | 'laugher' | 'mimic';

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
}

export class EnemyManager {
  private enemies: Map<string, EnemyInstance> = new Map();
  private doorBoards: number = GAME_CONFIG.BARRICADES.DOOR_MAX_BOARDS;
  private windowHealth: number = GAME_CONFIG.BARRICADES.WINDOW_MAX_HEALTH;
  private cellarHealth: number = GAME_CONFIG.BARRICADES.CELLAR_MAX_HEALTH;
  private isGameOver: boolean = false;
  private mimicSoundTimerMs: number = 0;

  constructor() {
    this.bindEvents();
  }

  public reset(): void {
    this.enemies.clear();
    this.doorBoards = GAME_CONFIG.BARRICADES.DOOR_MAX_BOARDS;
    this.windowHealth = GAME_CONFIG.BARRICADES.WINDOW_MAX_HEALTH;
    this.cellarHealth = GAME_CONFIG.BARRICADES.CELLAR_MAX_HEALTH;
    this.isGameOver = false;
    this.mimicSoundTimerMs = 0;
  }

  public spawnEnemy(type: EnemyType): EnemyInstance {
    const id = `enemy_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let sceneId: SceneType = 'door';
    let maxHealth = 100;
    let stageDurationMs = 3000;
    let maxStage = 2;

    if (type === 'walker') {
      sceneId = GAME_CONFIG.SCENES.DOOR;
      maxHealth = GAME_CONFIG.ENEMIES.WALKER.MAX_HEALTH;
      stageDurationMs = 2800;
      maxStage = 2;
    } else if (type === 'laugher') {
      sceneId = GAME_CONFIG.SCENES.WINDOW;
      maxHealth = GAME_CONFIG.ENEMIES.LAUGHER.MAX_HEALTH;
      stageDurationMs = 2000;
      maxStage = 1;
    } else if (type === 'mimic') {
      sceneId = GAME_CONFIG.SCENES.CELLAR;
      maxHealth = GAME_CONFIG.ENEMIES.MIMIC.MAX_HEALTH;
      stageDurationMs = 2400;
      maxStage = 2;
    }

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
  }

  public update(deltaMs: number): void {
    if (this.isGameOver) return;

    // 更新各怪物状态与步进
    for (const [id, enemy] of this.enemies.entries()) {
      if (enemy.isDead) {
        this.enemies.delete(id);
        continue;
      }

      if (enemy.stage < enemy.maxStage) {
        // 正在靠近中
        enemy.stageProgressMs += deltaMs;
        if (enemy.stageProgressMs >= enemy.stageDurationMs) {
          enemy.stageProgressMs = 0;
          enemy.stage++;

          // 播放阶段步进与预警音效
          this.playStageSound(enemy);

          if (enemy.stage === enemy.maxStage) {
            enemy.isAttacking = true;
            enemy.attackTimerMs = 0;
          }
        }
      } else {
        // 已到达防御口，进行破坏倒计时/攻击
        this.handleEnemyAttacking(enemy, deltaMs);
      }
    }

    // 拟态者 Mimic 伪装声效定时器
    this.updateMimicSound(deltaMs);
  }

  private playStageSound(enemy: EnemyInstance): void {
    if (enemy.type === 'walker') {
      if (enemy.stage === 1) audioManager.playDoorWoodHit(0.0);
    } else if (enemy.type === 'laugher') {
      if (enemy.stage === 1) {
        audioManager.playWindowGlassTap(0.75);
        audioManager.playLaugherEerieSound(0.75);
      }
    } else if (enemy.type === 'mimic') {
      audioManager.playCellarLadderSound(-0.75);
    }
  }

  private handleEnemyAttacking(enemy: EnemyInstance, deltaMs: number): void {
    enemy.attackTimerMs += deltaMs;

    if (enemy.type === 'walker') {
      // 行者每 2.5 秒拆除一块木板
      const interval = GAME_CONFIG.ENEMIES.WALKER.ATTACK_INTERVAL_MS;
      if (enemy.attackTimerMs >= interval) {
        enemy.attackTimerMs = 0;
        this.doorBoards--;
        audioManager.playDoorWoodHit(0.0);
        eventBus.emit('BARRICADE_DAMAGED', {
          sceneId: 'door',
          currentHealth: Math.max(0, this.doorBoards),
          maxHealth: GAME_CONFIG.BARRICADES.DOOR_MAX_BOARDS,
        });

        if (this.doorBoards < 0) {
          this.triggerGameOver('正门木板全毁，行者冲入！');
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
      // 拟态者猛击活板门
      const interval = GAME_CONFIG.ENEMIES.MIMIC.ATTACK_INTERVAL_MS;
      if (enemy.attackTimerMs >= interval) {
        enemy.attackTimerMs = 0;
        this.cellarHealth -= 35;
        audioManager.playCellarLadderSound(-0.75);
        eventBus.emit('BARRICADE_DAMAGED', {
          sceneId: 'cellar',
          currentHealth: Math.max(0, this.cellarHealth),
          maxHealth: GAME_CONFIG.BARRICADES.CELLAR_MAX_HEALTH,
        });

        if (this.cellarHealth <= 0) {
          this.triggerGameOver('活板门被撞开，拟态者爬出！');
        }
      }
    }
  }

  private updateMimicSound(deltaMs: number): void {
    const hasMimic = Array.from(this.enemies.values()).some((e) => e.type === 'mimic' && !e.isDead);
    if (hasMimic) {
      this.mimicSoundTimerMs += deltaMs;
      if (this.mimicSoundTimerMs > 4000) {
        this.mimicSoundTimerMs = 0;
        audioManager.playMimicDeceptionSound();
      }
    }
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
      const closeTarget = targets.find((e) => e.stage === e.maxStage);
      if (closeTarget) {
        return this.applyDamage(closeTarget, damage);
      }
      return false;
    }

    // 霰弹枪优先攻击最近的敌人，同时造成范围伤害
    // 找到当前场景中 stage 最高的怪
    targets.sort((a, b) => b.stage - a.stage);
    const primary = targets[0];
    return this.applyDamage(primary, damage);
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
  }
}
