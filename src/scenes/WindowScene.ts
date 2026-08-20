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

    // 3. 怪物渲染层与逃窜特效层
    this.enemyVisualContainer = new Container();
    this.addChild(this.enemyVisualContainer);

    this.fleeContainer = new Graphics();
    this.addChild(this.fleeContainer);

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

  private fleeTimerMs: number = 0;
  private fleeContainer!: Graphics;

  public override update(deltaMs: number): void {
    if (!this.isCurrentActive) return;

    // 更新惊吓逃窜视觉特效
    if (this.fleeTimerMs > 0) {
      this.fleeTimerMs -= deltaMs;
      this.renderFleeVfx();
      if (this.fleeTimerMs <= 0) {
        this.fleeContainer.clear();
      }
    }

    this.enemyVisualContainer.removeChildren();
    const enemies = this.enemyManager.getEnemiesForScene('window');
    const cx = GAME_CONFIG.CANVAS_WIDTH / 2;

    for (const enemy of enemies) {
      const g = new Graphics();
      const state = enemy.laugherState || (enemy.stage === 0 ? 'idle_far' : 'attacking');

      if (state === 'idle_far') {
        // 1. 远端草坪驻足不动 (小黑影 + 两颗黄色发光眼睛)
        const posX = cx + 70;
        const posY = 320;
        g.ellipse(posX, posY, 22, 48);
        g.fill({ color: 0x060c16, alpha: 0.88 });
        // 荧光黄眼
        g.circle(posX - 6, posY - 15, 2.5);
        g.circle(posX + 6, posY - 15, 2.5);
        g.fill({ color: 0xeeff00 });
      } else if (state === 'stare_close') {
        // 2. 贴在窗前玻璃上静止凝视 (巨大苍白面孔，双眼圆睁，无声贴脸)
        g.ellipse(cx, 340, 95, 140);
        g.fill({ color: 0x0f1d2b });
        // 巨型苍白大眼 (静态圆睁)
        g.circle(cx - 30, 300, 13);
        g.circle(cx + 30, 300, 13);
        g.fill({ color: 0xeeeeee });
        g.circle(cx - 30, 300, 5);
        g.circle(cx + 30, 300, 5);
        g.fill({ color: 0x000000 });
        // 诡异细线微笑 (闭合/静止凝视形态)
        g.arc(cx, 345, 32, 0.2, Math.PI - 0.2);
        g.stroke({ width: 4, color: 0x882222 });
      } else if (state === 'hidden') {
        // 3. 躲在窗框后 (大部分隐于右侧窗框与阴影中，可能看不到或仅见暗影边缘)
        const hideX = cx + 225;
        const hideY = 330;
        g.ellipse(hideX, hideY, 18, 55);
        g.fill({ color: 0x03060a, alpha: 0.45 });
        // 隐约的一只眼睛反光 (极难看清)
        g.circle(hideX - 4, hideY - 14, 1.5);
        g.fill({ color: 0xbbcc00, alpha: 0.4 });
      } else if (state === 'attacking') {
        // 4. 决定攻击并贴在窗前：血色狞笑、剧烈攻击震动特效
        const shakeX = (Math.random() - 0.5) * 6;
        const shakeY = (Math.random() - 0.5) * 4;
        const faceX = cx + shakeX;
        const faceY = 340 + shakeY;

        // 狞恶红黑面孔
        g.ellipse(faceX, faceY, 100, 145);
        g.fill({ color: 0x1a0d14 });

        // 血丝大眼
        g.circle(faceX - 30, faceY - 40, 14);
        g.circle(faceX + 30, faceY - 40, 14);
        g.fill({ color: 0xffffff });
        g.circle(faceX - 30, faceY - 40, 6);
        g.circle(faceX + 30, faceY - 40, 6);
        g.fill({ color: 0xdd1111 });

        // 狂暴裂口大笑
        g.arc(faceX, faceY + 10, 44, 0.05, Math.PI - 0.05);
        g.stroke({ width: 8, color: 0xff1111 });

        // 玻璃抓痕
        g.moveTo(faceX - 25, faceY - 10);
        g.lineTo(faceX - 10, faceY + 15);
        g.moveTo(faceX + 15, faceY - 8);
        g.lineTo(faceX + 30, faceY + 16);
        g.stroke({ width: 2, color: 0xff6666, alpha: 0.8 });
      }

      this.enemyVisualContainer.addChild(g);
    }
  }

  private renderFleeVfx(): void {
    this.fleeContainer.clear();
    const cx = GAME_CONFIG.CANVAS_WIDTH / 2;
    const progress = 1.0 - this.fleeTimerMs / 500; // 0.0 -> 1.0
    const alpha = Math.max(0, 1.0 - progress);

    // 受惊快速从窗前缩回草坪远处 (cx+70, 320)
    const fleeX = cx + progress * 70;
    const fleeY = 340 - progress * 20;
    const scale = Math.max(0.3, 1.0 - progress * 0.7);

    // 缩退残影
    this.fleeContainer.ellipse(fleeX, fleeY, 80 * scale, 120 * scale);
    this.fleeContainer.fill({ color: 0x050a12, alpha: alpha * 0.75 });

    // 速度线 / 扬尘烟雾
    for (let i = 0; i < 3; i++) {
      const lineY = fleeY + (i - 1) * 20 * scale;
      this.fleeContainer.moveTo(fleeX - 30 * scale, lineY);
      this.fleeContainer.lineTo(fleeX + 30 * scale, lineY);
      this.fleeContainer.stroke({ width: 2 * scale, color: 0x6688aa, alpha: alpha * 0.6 });
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

    eventBus.on('LAUGHER_SCARED_AWAY', () => {
      this.fleeTimerMs = 500;
    });
  }
}
