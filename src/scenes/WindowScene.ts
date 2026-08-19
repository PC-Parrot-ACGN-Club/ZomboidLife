import { BaseScene } from './BaseScene';
import { GAME_CONFIG, SceneType } from '@/config/GameConfig';
import { Graphics, Container } from 'pixi.js';
import { EnemyManager } from '@/systems/EnemyManager';
import { eventBus } from '@/core/EventBus';

export class WindowScene extends BaseScene {
  public readonly sceneId: SceneType = GAME_CONFIG.SCENES.WINDOW;
  private enemyVisualContainer!: Container;
  private glassLayer!: Graphics;
  private vfxContainer!: Graphics;
  private enemyManager: EnemyManager;

  constructor(enemyManager: EnemyManager) {
    super();
    this.enemyManager = enemyManager;
  }

  protected createPlaceholderVisuals(): void {
    // 1. 房间墙壁与窗外暗黑森林背景
    const bg = new Graphics();
    bg.rect(0, 0, GAME_CONFIG.CANVAS_WIDTH, GAME_CONFIG.CANVAS_HEIGHT);
    bg.fill({ color: 0x11161d });
    this.addChild(bg);

    this.createDebugBanner('[SCENE 2: 窗户防守]', 0x113355);

    // 2. 窗洞与窗外夜空 (怪物在此图层)
    const windowBack = new Graphics();
    windowBack.rect(GAME_CONFIG.CANVAS_WIDTH / 2 - 240, 130, 480, 440);
    windowBack.fill({ color: 0x020710 });
    this.addChild(windowBack);

    // 3. 怪物渲染层
    this.enemyVisualContainer = new Container();
    this.addChild(this.enemyVisualContainer);

    // 4. 玻璃反光与窗框十字格 (遮挡在怪物前面)
    this.glassLayer = new Graphics();
    this.renderGlass(100);
    this.addChild(this.glassLayer);

    const frame = new Graphics();
    const cx = GAME_CONFIG.CANVAS_WIDTH / 2;
    // 外窗框
    frame.rect(cx - 245, 125, 490, 450);
    frame.stroke({ width: 10, color: 0x3d3025 });
    // 十字窗格
    frame.moveTo(cx, 130);
    frame.lineTo(cx, 570);
    frame.moveTo(cx - 240, 350);
    frame.lineTo(cx + 240, 350);
    frame.stroke({ width: 6, color: 0x3d3025 });
    this.addChild(frame);

    // 5. 特效图层
    this.vfxContainer = new Graphics();
    this.addChild(this.vfxContainer);

    this.bindEvents();
  }

  public renderGlass(_health: number): void {
    this.glassLayer.clear();
    const cx = GAME_CONFIG.CANVAS_WIDTH / 2;
    this.glassLayer.rect(cx - 240, 130, 480, 440);
    this.glassLayer.fill({ color: 0x66ccff, alpha: 0.1 });
  }

  public override update(_deltaMs: number): void {
    if (!this.isCurrentActive) return;

    this.enemyVisualContainer.removeChildren();
    const enemies = this.enemyManager.getEnemiesForScene('window');
    const cx = GAME_CONFIG.CANVAS_WIDTH / 2;

    for (const enemy of enemies) {
      const g = new Graphics();
      if (enemy.stage === 0) {
        // 远端草坪潜伏 (小黑影)
        g.ellipse(cx + 60, 320, 20, 45);
        g.fill({ color: 0x050c18, alpha: 0.85 });
        // 荧光黄眼
        g.circle(cx + 56, 305, 2);
        g.circle(cx + 64, 305, 2);
        g.fill({ color: 0xeeff00 });
      } else {
        // 贴在玻璃上的巨大诡异笑脸
        g.ellipse(cx, 340, 95, 140);
        g.fill({ color: 0x112233 });
        // 巨型诡异大眼
        g.circle(cx - 30, 300, 12);
        g.circle(cx + 30, 300, 12);
        g.fill({ color: 0xffffff });
        g.circle(cx - 30, 300, 5);
        g.circle(cx + 30, 300, 5);
        g.fill({ color: 0x000000 });
        // 诡异咧嘴大笑
        g.arc(cx, 350, 40, 0.1, Math.PI - 0.1);
        g.stroke({ width: 6, color: 0xdd2222 });
      }
      this.enemyVisualContainer.addChild(g);
    }
  }

  public showMuzzleFlash(): void {
    this.vfxContainer.clear();
    this.vfxContainer.circle(GAME_CONFIG.CANVAS_WIDTH / 2, GAME_CONFIG.CANVAS_HEIGHT / 2, 280);
    this.vfxContainer.fill({ color: 0xffdd88, alpha: 0.35 });
    setTimeout(() => {
      this.vfxContainer.clear();
    }, 60);
  }

  private bindEvents(): void {
    eventBus.on('WEAPON_FIRED', (data) => {
      if (this.isCurrentActive && data.weapon === 'shotgun') {
        this.showMuzzleFlash();
      }
    });
  }
}
