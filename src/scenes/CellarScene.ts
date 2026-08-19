import { BaseScene } from './BaseScene';
import { GAME_CONFIG, SceneType } from '@/config/GameConfig';
import { Graphics, Container } from 'pixi.js';
import { EnemyManager } from '@/systems/EnemyManager';
import { eventBus } from '@/core/EventBus';

export class CellarScene extends BaseScene {
  public readonly sceneId: SceneType = GAME_CONFIG.SCENES.CELLAR;
  private enemyVisualContainer!: Container;
  private trapdoorVisual!: Graphics;
  private vfxContainer!: Graphics;
  private enemyManager: EnemyManager;
  private shakeOffset: number = 0;

  constructor(enemyManager: EnemyManager) {
    super();
    this.enemyManager = enemyManager;
  }

  protected createPlaceholderVisuals(): void {
    // 1. 深色地下室地板与暗角
    const bg = new Graphics();
    bg.rect(0, 0, GAME_CONFIG.CANVAS_WIDTH, GAME_CONFIG.CANVAS_HEIGHT);
    bg.fill({ color: 0x140f0c });
    this.addChild(bg);

    this.createDebugBanner('[SCENE 3: 地窖活板门]', 0x4a2a11);

    // 2. 活板门暗道口 (通往地底)
    const hole = new Graphics();
    const cx = GAME_CONFIG.CANVAS_WIDTH / 2;
    hole.ellipse(cx, 470, 260, 140);
    hole.fill({ color: 0x020101 });
    hole.stroke({ width: 8, color: 0x241408 });
    this.addChild(hole);

    // 3. 木梯
    const ladder = new Graphics();
    ladder.moveTo(cx - 50, 390);
    ladder.lineTo(cx - 30, 600);
    ladder.moveTo(cx + 50, 390);
    ladder.lineTo(cx + 30, 600);
    for (let y = 410; y < 600; y += 28) {
      ladder.moveTo(cx - 45, y);
      ladder.lineTo(cx + 45, y);
    }
    ladder.stroke({ width: 5, color: 0x5c4228 });
    this.addChild(ladder);

    // 4. 怪物图层 (在梯子上爬行)
    this.enemyVisualContainer = new Container();
    this.addChild(this.enemyVisualContainer);

    // 5. 活板门盖与铁链
    this.trapdoorVisual = new Graphics();
    this.addChild(this.trapdoorVisual);
    this.renderTrapdoor(100);

    // 6. 特效图层
    this.vfxContainer = new Graphics();
    this.addChild(this.vfxContainer);

    this.bindEvents();
  }

  public renderTrapdoor(_health: number): void {
    this.trapdoorVisual.clear();
    const cx = GAME_CONFIG.CANVAS_WIDTH / 2 + this.shakeOffset;
    const cy = 350;

    // 活板门木盖板
    this.trapdoorVisual.roundRect(cx - 200, cy, 400, 56, 4);
    this.trapdoorVisual.fill({ color: 0x4a321e });
    this.trapdoorVisual.stroke({ width: 4, color: 0x2b1c10 });

    // 门把手与铁锁
    this.trapdoorVisual.circle(cx, cy + 28, 8);
    this.trapdoorVisual.fill({ color: 0x888888 });
  }

  public override update(_deltaMs: number): void {
    if (!this.isCurrentActive) return;

    this.enemyVisualContainer.removeChildren();
    const enemies = this.enemyManager.getEnemiesForScene('cellar');
    const cx = GAME_CONFIG.CANVAS_WIDTH / 2;

    for (const enemy of enemies) {
      const g = new Graphics();
      if (enemy.stage === 0) {
        // 梯底深处 (两颗幽绿发光眼睛)
        g.circle(cx - 8, 560, 3);
        g.circle(cx + 8, 560, 3);
        g.fill({ color: 0x00ff88 });
      } else if (enemy.stage === 1) {
        // 爬到梯子中段
        g.ellipse(cx, 480, 40, 60);
        g.fill({ color: 0x221122 });
        g.circle(cx - 10, 460, 4);
        g.circle(cx + 10, 460, 4);
        g.fill({ color: 0x00ffaa });
      } else {
        // 爬至门顶正在疯狂顶门 (门板剧烈震动)
        g.ellipse(cx, 400, 75, 90);
        g.fill({ color: 0x331828 });
        g.circle(cx - 16, 380, 6);
        g.circle(cx + 16, 380, 6);
        g.fill({ color: 0x00ffcc });

        this.shakeOffset = (Math.random() - 0.5) * 8;
      }
      this.enemyVisualContainer.addChild(g);
    }

    if (enemies.every((e) => e.stage < 2)) {
      this.shakeOffset = 0;
    }

    this.renderTrapdoor(this.enemyManager.getCellarHealth());
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
