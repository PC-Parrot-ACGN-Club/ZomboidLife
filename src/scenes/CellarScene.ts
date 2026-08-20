import { BaseScene } from './BaseScene';
import { GAME_CONFIG, SceneType } from '@/config/GameConfig';
import { Graphics, Container } from 'pixi.js';
import { EnemyManager } from '@/systems/EnemyManager';
import { eventBus } from '@/core/EventBus';

export class CellarScene extends BaseScene {
  public readonly sceneId: SceneType = GAME_CONFIG.SCENES.CELLAR;
  private enemyVisualContainer!: Container;
  private trapdoorVisual!: Graphics;
  private trapMechanismVisual!: Graphics;
  private vfxContainer!: Graphics;
  private enemyManager: EnemyManager;
  private shakeOffset: number = 0;
  private trapCrushTimer: number = 0;

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

    // 5. 陷阱机关装置 (悬挂在梯口上方两侧的重石与尖刺机关)
    this.trapMechanismVisual = new Graphics();
    this.addChild(this.trapMechanismVisual);
    this.renderTrapMechanism();

    // 6. 活板门盖与铁链
    this.trapdoorVisual = new Graphics();
    this.addChild(this.trapdoorVisual);
    this.renderTrapdoor(100);

    // 7. 特效图层
    this.vfxContainer = new Graphics();
    this.addChild(this.vfxContainer);

    this.bindEvents();
  }

  public renderTrapMechanism(): void {
    this.trapMechanismVisual.clear();
    const cx = GAME_CONFIG.CANVAS_WIDTH / 2;
    const isReady = this.enemyManager.isCellarTrapAvailable();

    if (isReady) {
      // 预设重石刺木机关 (蓄势待发)
      this.trapMechanismVisual.moveTo(cx - 150, 220);
      this.trapMechanismVisual.lineTo(cx - 150, 320);
      this.trapMechanismVisual.moveTo(cx + 150, 220);
      this.trapMechanismVisual.lineTo(cx + 150, 320);
      this.trapMechanismVisual.stroke({ width: 4, color: 0x666666 });

      // 吊石重锤
      this.trapMechanismVisual.rect(cx - 170, 300, 40, 40);
      this.trapMechanismVisual.rect(cx + 130, 300, 40, 40);
      this.trapMechanismVisual.fill({ color: 0x3d3530 });
      this.trapMechanismVisual.stroke({ width: 2, color: 0x00ff88 });
    } else {
      // 机关已断绳触发，仅留断链
      this.trapMechanismVisual.moveTo(cx - 150, 220);
      this.trapMechanismVisual.lineTo(cx - 150, 260);
      this.trapMechanismVisual.moveTo(cx + 150, 220);
      this.trapMechanismVisual.lineTo(cx + 150, 260);
      this.trapMechanismVisual.stroke({ width: 3, color: 0x444444 });
    }
  }

  public renderTrapdoor(health: number): void {
    this.trapdoorVisual.clear();
    const cx = GAME_CONFIG.CANVAS_WIDTH / 2 + this.shakeOffset;
    const cy = 350;

    if (health <= 0) {
      // 活板门彻底被砸烂敞开
      this.trapdoorVisual.moveTo(cx - 200, cy);
      this.trapdoorVisual.lineTo(cx - 180, cy - 70);
      this.trapdoorVisual.lineTo(cx - 130, cy - 80);
      this.trapdoorVisual.lineTo(cx - 120, cy);
      this.trapdoorVisual.fill({ color: 0x2b1c10 });
      this.trapdoorVisual.stroke({ width: 3, color: 0x150d06 });

      // 右侧残破碎板
      this.trapdoorVisual.moveTo(cx + 120, cy);
      this.trapdoorVisual.lineTo(cx + 140, cy - 65);
      this.trapdoorVisual.lineTo(cx + 190, cy - 75);
      this.trapdoorVisual.lineTo(cx + 200, cy);
      this.trapdoorVisual.fill({ color: 0x2b1c10 });
      this.trapdoorVisual.stroke({ width: 3, color: 0x150d06 });
      return;
    }

    // 正常活板门木盖板
    this.trapdoorVisual.roundRect(cx - 200, cy, 400, 56, 4);
    this.trapdoorVisual.fill({ color: 0x4a321e });
    this.trapdoorVisual.stroke({ width: 4, color: 0x2b1c10 });

    // 门把手与铁锁
    this.trapdoorVisual.circle(cx, cy + 28, 8);
    this.trapdoorVisual.fill({ color: 0x888888 });
  }

  public override update(deltaMs: number): void {
    if (!this.isCurrentActive) return;

    // 刷新机关状态
    this.renderTrapMechanism();

    // 更新陷阱砸落动画
    if (this.trapCrushTimer > 0) {
      this.trapCrushTimer -= deltaMs;
      this.renderTrapCrushVfx();
      if (this.trapCrushTimer <= 0) {
        this.vfxContainer.clear();
      }
    }

    this.enemyVisualContainer.removeChildren();
    const enemies = this.enemyManager.getEnemiesForScene('cellar');
    const cx = GAME_CONFIG.CANVAS_WIDTH / 2;

    for (const enemy of enemies) {
      const g = new Graphics();
      if (enemy.stage === 0) {
        // 梯底深处
        const isVoiceActive = (enemy.mimicVoiceVisualTimerMs || 0) > 0;
        const isRetreated = enemy.mimicRetreated && !isVoiceActive;

        if (isRetreated) {
          // 缩回黑暗深处 (画面中隐去/仅留极淡暗渊)
          g.circle(cx, 565, 12);
          g.fill({ color: 0x010101, alpha: 0.6 });
        } else {
          // 露头窥探 / 发声显形
          // 梯底暗影
          g.ellipse(cx, 565, 20, 24);
          g.fill({ color: 0x100518, alpha: 0.9 });
          // 两颗幽绿发光眼睛
          g.circle(cx - 8, 558, 3.5);
          g.circle(cx + 8, 558, 3.5);
          g.fill({ color: 0x00ff88 });

          // 发声时的声波光环特效 (无论发出谁的声音都必定强制显形)
          if (isVoiceActive) {
            const waveR = 20 + (Date.now() % 400) * 0.04;
            g.circle(cx, 558, waveR);
            g.stroke({ width: 2, color: 0x00ffaa, alpha: 0.75 });
          }
        }
      } else if (enemy.stage === 1) {
        // 爬到梯子中段 (继续上爬)
        g.ellipse(cx, 480, 40, 60);
        g.fill({ color: 0x221122 });
        // 爬梯手臂
        g.rect(cx - 35, 470, 10, 18);
        g.rect(cx + 25, 470, 10, 18);
        g.fill({ color: 0x2e182e });
        // 发光绿眼
        g.circle(cx - 10, 460, 4.5);
        g.circle(cx + 10, 460, 4.5);
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

  private renderTrapCrushVfx(): void {
    this.vfxContainer.clear();
    const cx = GAME_CONFIG.CANVAS_WIDTH / 2;

    // 巨型落石/尖刺重锤碾压砸过梯道
    const progress = 1.0 - this.trapCrushTimer / 900;
    const crushY = 320 + progress * 240;

    // 巨石碾压块
    this.vfxContainer.roundRect(cx - 110, crushY, 220, 70, 8);
    this.vfxContainer.fill({ color: 0x221e1a, alpha: 0.95 });
    this.vfxContainer.stroke({ width: 5, color: 0xff3333 });

    // 碾碎血溅特效
    for (let i = 0; i < 6; i++) {
      const sx = cx + (Math.random() - 0.5) * 180;
      const sy = crushY + (Math.random() - 0.5) * 60;
      this.vfxContainer.circle(sx, sy, 14 + Math.random() * 16);
      this.vfxContainer.fill({ color: 0x990000, alpha: 0.75 });
    }
  }

  public showMuzzleFlash(): void {
    this.vfxContainer.clear();
    this.vfxContainer.circle(GAME_CONFIG.CANVAS_WIDTH / 2, GAME_CONFIG.CANVAS_HEIGHT / 2, 280);
    this.vfxContainer.fill({ color: 0xffdd88, alpha: 0.35 });
    setTimeout(() => {
      if (this.trapCrushTimer <= 0) {
        this.vfxContainer.clear();
      }
    }, 60);
  }

  public playTrapCrushAnimation(): void {
    this.trapCrushTimer = 900;
  }

  private bindEvents(): void {
    eventBus.on('FAULT_TOLERANCE_TRIGGERED', (data) => {
      if (data.sceneId === 'cellar') {
        this.playTrapCrushAnimation();
        this.renderTrapMechanism();
      }
    });

    eventBus.on('WEAPON_FIRED', (data) => {
      if (this.isCurrentActive && data.weapon === 'shotgun') {
        this.showMuzzleFlash();
      }
    });
  }
}
