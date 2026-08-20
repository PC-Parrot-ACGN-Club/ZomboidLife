import { GAME_CONFIG } from '@/config/GameConfig';
import { eventBus } from '@/core/EventBus';
import { EnemyManager, EnemyType } from './EnemyManager';

export class WaveSystem {
  private currentWave: number = 1;
  private enemyQueue: EnemyType[] = [];
  private totalKills: number = 0;
  private noiseLevel: number = 0; // 0.0 ~ 3.0
  private spawnTimerMs: number = 0;
  private isWaveResting: boolean = false;
  private restTimerMs: number = 0;
  private enemyManager: EnemyManager;
  private isGameOver: boolean = false;
  private startTime: number = Date.now();

  constructor(enemyManager: EnemyManager) {
    this.enemyManager = enemyManager;
    this.bindEvents();
    this.startNewWave(1);
  }

  public reset(): void {
    this.currentWave = 1;
    this.totalKills = 0;
    this.noiseLevel = 0;
    this.spawnTimerMs = 0;
    this.isWaveResting = false;
    this.restTimerMs = 0;
    this.isGameOver = false;
    this.startTime = Date.now();
    this.startNewWave(1);
  }

  public update(deltaMs: number): void {
    if (this.isGameOver) return;

    // 1. 噪音自然指数衰减
    if (this.noiseLevel > 0) {
      this.noiseLevel = Math.max(
        0,
        this.noiseLevel - (deltaMs / 1000) * GAME_CONFIG.WAVE.NOISE_DECAY_RATE
      );
    }

    // 2. 波次休整倒计时
    if (this.isWaveResting) {
      this.restTimerMs -= deltaMs;
      if (this.restTimerMs <= 0) {
        this.isWaveResting = false;
        this.startNewWave(this.currentWave + 1);
      }
      return;
    }

    // 3. 刷怪生成时钟与噪音压缩
    if (this.enemyQueue.length > 0) {
      this.spawnTimerMs += deltaMs;

      // 核心公式: 基础刷怪速度 (随波次轻微提速) + 噪音压缩刷新间隔
      const waveSpeedFactor = Math.min(1.35, 1.0 + (this.currentWave - 1) * 0.06);
      const baseInterval = GAME_CONFIG.WAVE.BASE_INTERVAL_MS / waveSpeedFactor;
      let dynamicInterval = Math.max(
        GAME_CONFIG.WAVE.MIN_INTERVAL_MS,
        baseInterval / (1.0 + 1.6 * this.noiseLevel)
      );

      // 若当前队列即将刷出的是 Laugher，增加额外延迟缓冲，降低 Laugher 的瞬时刷新频率
      if (this.enemyQueue[0] === 'laugher') {
        dynamicInterval += GAME_CONFIG.WAVE.LAUGHER_CONFIG.EXTRA_SPAWN_DELAY_MS;
      }

      if (this.spawnTimerMs >= dynamicInterval) {
        // 同一时间窗外最多有一只 Laugher
        if (this.enemyQueue[0] === 'laugher' && this.enemyManager.hasActiveLaugher()) {
          // 查找队列中下一个非 Laugher 怪物提前刷出
          const nextNonLaugherIndex = this.enemyQueue.findIndex((t) => t !== 'laugher');
          if (nextNonLaugherIndex !== -1) {
            this.spawnTimerMs = 0;
            const [nextType] = this.enemyQueue.splice(nextNonLaugherIndex, 1);
            this.enemyManager.spawnEnemy(nextType);
          } else {
            // 队列中只剩 Laugher，等待场上的 Laugher 死亡
            this.spawnTimerMs = dynamicInterval;
          }
        } else {
          this.spawnTimerMs = 0;
          const nextType = this.enemyQueue.shift()!;
          this.enemyManager.spawnEnemy(nextType);
        }
      }
    } else {
      // 队列已刷完，检查场上是否所有怪物已被消灭
      const activeEnemies = this.enemyManager.getAllActiveEnemies();
      if (activeEnemies.length === 0 && !this.isWaveResting) {
        this.handleWaveCleared();
      }
    }
  }

  private startNewWave(wave: number): void {
    this.currentWave = wave;
    this.spawnTimerMs = 0;
    this.enemyQueue = this.generateEnemyQueue(wave);
    eventBus.emit('WAVE_STARTED', wave);
    console.log(`[WaveSystem] Wave ${wave} 开始，怪物总数: ${this.enemyQueue.length}`);
  }

  private generateEnemyQueue(wave: number): EnemyType[] {
    const totalCount = 6 + (wave - 1) * 4;
    const weights =
      wave === 1
        ? GAME_CONFIG.WAVE.SPAWN_WEIGHTS.WAVE_1
        : wave === 2
        ? GAME_CONFIG.WAVE.SPAWN_WEIGHTS.WAVE_2
        : GAME_CONFIG.WAVE.SPAWN_WEIGHTS.WAVE_DEFAULT;

    // 限制单波次内 Laugher 的最大数量 (波次 1 最多 1 只，后续波次按 15% 比例限制)
    const maxLaughers = wave === 1 ? 1 : Math.max(1, Math.round(totalCount * weights.laugher));
    let laugherCount = 0;
    const initialQueue: EnemyType[] = [];

    for (let i = 0; i < totalCount; i++) {
      const rand = Math.random();
      if (rand < weights.walker) {
        initialQueue.push('walker');
      } else if (rand < weights.walker + weights.laugher) {
        if (laugherCount < maxLaughers) {
          initialQueue.push('laugher');
          laugherCount++;
        } else {
          initialQueue.push('walker');
        }
      } else {
        initialQueue.push('mimic');
      }
    }

    // 随机洗牌 (Fisher-Yates 洗牌算法)
    for (let i = initialQueue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [initialQueue[i], initialQueue[j]] = [initialQueue[j], initialQueue[i]];
    }

    // 防扎堆与安全间隔编排：确保 Laugher 不出现在首位，且 Laugher 之间至少间隔指定数量的其他怪物
    const minSpacing = GAME_CONFIG.WAVE.LAUGHER_CONFIG.MIN_SPACING;
    const nonLaughers = initialQueue.filter((t) => t !== 'laugher');
    const laughers = initialQueue.filter((t) => t === 'laugher');

    const resultQueue: EnemyType[] = [];
    let lastLaugherDistance = minSpacing; // 初始允许在安全距离后插入

    // 开局首只怪强制为非 Laugher，给玩家留出初始布防与观察时间
    if (nonLaughers.length > 0) {
      resultQueue.push(nonLaughers.shift()!);
      lastLaugherDistance = 1;
    }

    while (nonLaughers.length > 0 || laughers.length > 0) {
      if (laughers.length > 0 && lastLaugherDistance >= minSpacing) {
        resultQueue.push(laughers.shift()!);
        lastLaugherDistance = 0;
      } else if (nonLaughers.length > 0) {
        resultQueue.push(nonLaughers.shift()!);
        lastLaugherDistance++;
      } else {
        // 只剩 Laugher 时的兜底追加
        resultQueue.push(laughers.shift()!);
        lastLaugherDistance = 0;
      }
    }

    return resultQueue;
  }

  private handleWaveCleared(): void {
    this.isWaveResting = true;
    this.restTimerMs = GAME_CONFIG.WAVE.REST_TIME_MS;
    eventBus.emit('WAVE_CLEARED', this.currentWave);
    console.log(`[WaveSystem] Wave ${this.currentWave} 清理完毕，进入休整`);
  }

  public getCurrentWave(): number {
    return this.currentWave;
  }

  public getTotalKills(): number {
    return this.totalKills;
  }

  public getNoiseLevel(): number {
    return this.noiseLevel;
  }

  public getSurvivalSeconds(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  public getRemainingInWave(): number {
    return this.enemyQueue.length + this.enemyManager.getAllActiveEnemies().length;
  }

  public getIsWaveResting(): boolean {
    return this.isWaveResting;
  }

  private bindEvents(): void {
    // 监听枪声噪音产生
    eventBus.on('NOISE_PRODUCED', (intensity) => {
      this.noiseLevel = Math.min(3.0, this.noiseLevel + intensity);
    });

    // 监听击杀
    eventBus.on('ENEMY_KILLED', () => {
      this.totalKills++;
    });

    // 游戏结束时统计数据
    eventBus.on('GAME_OVER', () => {
      this.isGameOver = true;
    });

    eventBus.on('GAME_RESTART', () => {
      this.reset();
    });
  }
}
