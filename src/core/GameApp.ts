import { Application } from 'pixi.js';
import { GAME_CONFIG } from '@/config/GameConfig';
import { SceneManager } from '@/scenes/SceneManager';
import { HUDOverlay } from '@/ui/HUDOverlay';
import { EnemyManager } from '@/systems/EnemyManager';
import { WeaponSystem } from '@/systems/WeaponSystem';
import { WaveSystem } from '@/systems/WaveSystem';
import { CCTVModal } from '@/ui/CCTVModal';
import { GameOverModal } from '@/ui/GameOverModal';
import { StartScreen } from '@/ui/StartScreen';
import { eventBus } from './EventBus';

export class GameApp {
  public app: Application;
  public enemyManager!: EnemyManager;
  public weaponSystem!: WeaponSystem;
  public waveSystem!: WaveSystem;
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

    // 3. 初始化 HUD
    this.hud = new HUDOverlay(this.waveSystem, this.enemyManager);

    // 4. 开始界面引导
    this.startScreen = new StartScreen(() => {
      this.isRunning = true;
    });

    // 5. 事件总线绑定
    this.bindEvents();

    // 6. 游戏主循环 Ticker
    this.app.ticker.add((ticker) => {
      if (!this.isRunning) return;
      const deltaMs = ticker.deltaMS;
      this.update(deltaMs);
    });

    console.log('🎮 Zomboid Defense 全部核心子系统加载完毕');
  }

  private update(deltaMs: number): void {
    this.enemyManager.update(deltaMs);
    this.weaponSystem.update(deltaMs);
    this.waveSystem.update(deltaMs);
    this.sceneManager.update(deltaMs);
    this.hud.update();

    // 处理后坐力震屏偏移
    const offset = this.weaponSystem.getRecoilOffset();
    this.app.stage.position.set(offset.x, offset.y);
  }

  private bindEvents(): void {
    eventBus.on('SCENE_CHANGED', (sceneId) => {
      if (this.sceneManager.getCurrentScene()?.sceneId !== sceneId) {
        this.sceneManager.switchTo(sceneId);
      }
    });

    eventBus.on('GAME_OVER', () => {
      this.gameOverModal.show({
        survivalTime: this.waveSystem.getSurvivalSeconds(),
        kills: this.waveSystem.getTotalKills(),
        waves: this.waveSystem.getCurrentWave(),
      });
    });

    eventBus.on('GAME_RESTART', () => {
      this.isRunning = true;
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
