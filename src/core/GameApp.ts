import { Application } from 'pixi.js';
import { GAME_CONFIG } from '@/config/GameConfig';
import { SceneManager } from '@/scenes/SceneManager';
import { HUDOverlay } from '@/ui/HUDOverlay';
import { EnemyManager } from '@/systems/EnemyManager';
import { WeaponSystem } from '@/systems/WeaponSystem';
import { WaveSystem } from '@/systems/WaveSystem';
import { AISystem } from '@/systems/AISystem';
import { CCTVModal } from '@/ui/CCTVModal';
import { GameOverModal } from '@/ui/GameOverModal';
import { StartScreen } from '@/ui/StartScreen';
import { audioManager } from '@/audio/AudioManager';
import { eventBus } from './EventBus';

export class GameApp {
  public app: Application;
  public enemyManager!: EnemyManager;
  public weaponSystem!: WeaponSystem;
  public waveSystem!: WaveSystem;
  public aiSystem!: AISystem;
  public sceneManager!: SceneManager;
  public hud!: HUDOverlay;
  public cctvModal!: CCTVModal;
  public gameOverModal!: GameOverModal;
  public startScreen!: StartScreen;
  private isRunning: boolean = false;

  constructor() {
    this.app = new Application();
  }

  public async init(): Promise<void> {
    const container = document.getElementById('game-canvas-container');
    if (!container) {
      throw new Error('未找到 #game-canvas-container 容器');
    }

    // 初始化 PixiJS v8 应用
    await this.app.init({
      width: GAME_CONFIG.CANVAS_WIDTH,
      height: GAME_CONFIG.CANVAS_HEIGHT,
      backgroundColor: 0x080808,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: true,
    });

    container.appendChild(this.app.canvas);
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());

    // 1. 初始化核心系统
    this.enemyManager = new EnemyManager();
    this.weaponSystem = new WeaponSystem(this.enemyManager);
    this.waveSystem = new WaveSystem(this.enemyManager);

    // 2. 初始化 CCTV 模态框与场景管理器
    this.cctvModal = new CCTVModal(this.enemyManager);
    this.gameOverModal = new GameOverModal();

    this.sceneManager = new SceneManager(
      this.app.stage,
      this.enemyManager,
      () => this.cctvModal.toggle()
    );
    await this.sceneManager.init();

    // 3. 初始化 AI 决策系统
    this.aiSystem = new AISystem(
      this.enemyManager,
      this.weaponSystem,
      this.waveSystem,
      this.sceneManager
    );

    // 4. 初始化 HUD
    this.hud = new HUDOverlay(this.waveSystem, this.enemyManager);

    // 5. 开始界面引导
    this.startScreen = new StartScreen((options) => {
      this.isRunning = true;
      if (options?.aiMode) {
        this.aiSystem.setEnabled(true);
      } else {
        this.aiSystem.setEnabled(false);
      }
      audioManager.startAmbientDrone();
    });

    // 6. 事件总线绑定
    this.bindEvents();

    // 7. 游戏主循环 Ticker
    this.app.ticker.add((ticker) => {
      if (!this.isRunning) return;
      const deltaMs = ticker.deltaMS;
      this.update(deltaMs);
    });

    console.log('🎮 Zomboid Defense 全部核心子系统加载完毕 (含 AI 自主决策中枢)');
  }

  private update(deltaMs: number): void {
    this.enemyManager.update(deltaMs);
    this.weaponSystem.update(deltaMs);
    this.waveSystem.update(deltaMs);
    this.sceneManager.update(deltaMs);
    this.aiSystem.update(deltaMs);
    this.hud.update();

    // 动态计算全场危机紧张度并调节环境音
    this.updateAudioTension(deltaMs);

    // 处理后坐力震屏偏移
    const offset = this.weaponSystem.getRecoilOffset();
    this.app.stage.position.set(offset.x, offset.y);
  }

  private updateAudioTension(deltaMs: number): void {
    const activeEnemies = this.enemyManager.getAllActiveEnemies();
    let tension = 0;

    // 若有怪物正在破门/破窗/顶门，紧张度瞬间拉满
    const isUnderAttack = activeEnemies.some((e) => e.stage === e.maxStage);
    if (isUnderAttack) {
      tension += 0.65;
    } else if (activeEnemies.some((e) => e.stage >= 1)) {
      tension += 0.35;
    }

    // 枪声噪音也会拉高紧张度
    const noise = this.waveSystem.getNoiseLevel();
    tension += Math.min(0.4, noise * 0.25);

    audioManager.setTensionLevel(tension);
    audioManager.updateAmbientLoop(deltaMs);
  }

  private bindEvents(): void {
    eventBus.on('SCENE_CHANGED', (sceneId) => {
      if (this.sceneManager.getCurrentScene()?.sceneId !== sceneId) {
        this.sceneManager.switchTo(sceneId);
      }
    });

    eventBus.on('AI_MODE_TOGGLED', (enabled) => {
      this.aiSystem.setEnabled(enabled);
    });

    eventBus.on('GAME_OVER', () => {
      audioManager.stopAmbientDrone();
      this.gameOverModal.show({
        survivalTime: this.waveSystem.getSurvivalSeconds(),
        kills: this.waveSystem.getTotalKills(),
        waves: this.waveSystem.getCurrentWave(),
        aiMode: this.aiSystem.isEnabled(),
      });
    });

    eventBus.on('GAME_RESTART', (data) => {
      this.isRunning = true;
      if (data && typeof data.aiMode === 'boolean') {
        this.aiSystem.setEnabled(data.aiMode);
      }
      audioManager.startAmbientDrone();
    });
  }

  private handleResize(): void {
    const canvas = this.app.canvas;
    if (!canvas) return;

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    const scale = Math.min(
      windowWidth / GAME_CONFIG.CANVAS_WIDTH,
      windowHeight / GAME_CONFIG.CANVAS_HEIGHT
    );

    canvas.style.width = `${GAME_CONFIG.CANVAS_WIDTH * scale}px`;
    canvas.style.height = `${GAME_CONFIG.CANVAS_HEIGHT * scale}px`;
  }
}
