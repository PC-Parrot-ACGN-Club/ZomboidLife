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

      // 核心公式: 噪音压缩刷新间隔
      const dynamicInterval = Math.max(
        GAME_CONFIG.WAVE.MIN_INTERVAL_MS,
        GAME_CONFIG.WAVE.BASE_INTERVAL_MS / (1.0 + 1.6 * this.noiseLevel)
      );

      if (this.spawnTimerMs >= dynamicInterval) {
        this.spawnTimerMs = 0;
        const nextType = this.enemyQueue.shift()!;
        this.enemyManager.spawnEnemy(nextType);
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
    const queue: EnemyType[] = [];

    for (let i = 0; i < totalCount; i++) {
      const rand = Math.random();
      if (wave === 1) {
        // 第一波：70% 行者, 30% 笑者
        queue.push(rand < 0.7 ? 'walker' : 'laugher');
      } else if (wave === 2) {
        // 第二波：50% 行者, 40% 笑者, 10% 拟态者
        if (rand < 0.5) queue.push('walker');
        else if (rand < 0.9) queue.push('laugher');
        else queue.push('mimic');
      } else {
        // 第三波及之后：40% 行者, 35% 笑者, 25% 拟态者
        if (rand < 0.4) queue.push('walker');
        else if (rand < 0.75) queue.push('laugher');
        else queue.push('mimic');
      }
    }

    // 随机打乱队列
    return queue.sort(() => Math.random() - 0.5);
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
