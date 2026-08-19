import { BaseScene } from './BaseScene';
import { GAME_CONFIG, SceneType } from '@/config/GameConfig';
import { Graphics, Text, TextStyle, Container } from 'pixi.js';
import { EnemyManager } from '@/systems/EnemyManager';
import { eventBus } from '@/core/EventBus';

export class DoorScene extends BaseScene {
  public readonly sceneId: SceneType = GAME_CONFIG.SCENES.DOOR;
  private boardsContainer!: Graphics;
  private enemyVisualContainer!: Container;
  private vfxContainer!: Graphics;
  private enemyManager: EnemyManager;
  private onCCTVClickCallback?: () => void;

  private turretContainer!: Graphics;
  private turretFxTimer: number = 0;

  constructor(enemyManager: EnemyManager, onCCTVClick?: () => void) {
    super();
    this.enemyManager = enemyManager;
    this.onCCTVClickCallback = onCCTVClick;
  }

  protected createPlaceholderVisuals(): void {
    // 1. 绘制房间深色背景与走廊透视
    const bg = new Graphics();
    bg.rect(0, 0, GAME_CONFIG.CANVAS_WIDTH, GAME_CONFIG.CANVAS_HEIGHT);
    bg.fill({ color: 0x14110f });
    // 地板与墙壁阴影
    bg.moveTo(0, GAME_CONFIG.CANVAS_HEIGHT);
    bg.lineTo(340, 520);
    bg.lineTo(GAME_CONFIG.CANVAS_WIDTH - 340, 520);
    bg.lineTo(GAME_CONFIG.CANVAS_WIDTH, GAME_CONFIG.CANVAS_HEIGHT);
    bg.fill({ color: 0x0a0807 });
    this.addChild(bg);

    this.createDebugBanner('[SCENE 1: 正门走廊 / 监控台]', 0x442211);

    // 2. 绘制正门框架与门外漆黑通道
    const doorFrame = new Graphics();
    doorFrame.rect(GAME_CONFIG.CANVAS_WIDTH / 2 - 170, 150, 340, 470);
    doorFrame.fill({ color: 0x050404 });
    doorFrame.stroke({ width: 8, color: 0x4a3628 });
    this.addChild(doorFrame);

    // 3. 怪物渲染容器 (在门洞内，木板后面)
    this.enemyVisualContainer = new Container();
    this.addChild(this.enemyVisualContainer);

    // 4. 木板防御容器
    this.boardsContainer = new Graphics();
    this.addChild(this.boardsContainer);
    this.renderBoards(GAME_CONFIG.BARRICADES.DOOR_MAX_BOARDS);

    // 5. 室内自动机枪装置 (挂在门头上方)
    this.turretContainer = new Graphics();
    this.addChild(this.turretContainer);
    this.renderTurret();

    // 6. 监控台与屏幕
    const desk = new Graphics();
    desk.rect(GAME_CONFIG.CANVAS_WIDTH - 340, GAME_CONFIG.CANVAS_HEIGHT - 210, 340, 210);
    desk.fill({ color: 0x1c1917 });
    desk.stroke({ width: 3, color: 0x332a22 });
    this.addChild(desk);

    const cctvScreen = new Graphics();
    cctvScreen.roundRect(GAME_CONFIG.CANVAS_WIDTH - 300, GAME_CONFIG.CANVAS_HEIGHT - 190, 260, 160, 8);
    cctvScreen.fill({ color: 0x041a0b });
    cctvScreen.stroke({ width: 4, color: 0x00ff66 });
    cctvScreen.eventMode = 'static';
    cctvScreen.cursor = 'pointer';
    cctvScreen.on('pointerdown', () => {
      if (this.onCCTVClickCallback) this.onCCTVClickCallback();
    });
    this.addChild(cctvScreen);

    const cctvLabel = new Text({
      text: '📹 3-CAM MONITOR\n[点击或按空格放大]',
      style: new TextStyle({
        fontFamily: 'Courier New',
        fontSize: 15,
        fontWeight: 'bold',
        fill: '#00ff66',
        align: 'center',
      }),
    });
    cctvLabel.anchor.set(0.5);
    cctvLabel.position.set(GAME_CONFIG.CANVAS_WIDTH - 170, GAME_CONFIG.CANVAS_HEIGHT - 110);
    this.addChild(cctvLabel);

    // 7. 特效图层 (枪火、机枪连射、血迹、挥刀)
    this.vfxContainer = new Graphics();
    this.addChild(this.vfxContainer);

    this.bindBarricadeEvents();
  }

  public renderTurret(): void {
    this.turretContainer.clear();
    const cx = GAME_CONFIG.CANVAS_WIDTH / 2;
    const cy = 135;
    const isReady = this.enemyManager.isDoorTurretAvailable();

    // 机枪固定底座与支架
    this.turretContainer.rect(cx - 38, cy - 14, 76, 18);
    this.turretContainer.fill({ color: 0x222222 });
    this.turretContainer.stroke({ width: 2, color: 0x444444 });

    // 机枪双管枪身
    this.turretContainer.rect(cx - 16, cy + 4, 10, 24);
    this.turretContainer.rect(cx + 6, cy + 4, 10, 24);
    this.turretContainer.fill({ color: 0x111111 });
    this.turretContainer.stroke({ width: 1, color: isReady ? 0x00ff88 : 0x555555 });

    // 状态指示灯
    this.turretContainer.circle(cx, cy - 5, 4);
    this.turretContainer.fill({ color: isReady ? 0x00ff66 : 0xff2222 });
  }

  public renderBoards(count: number): void {
    this.boardsContainer.clear();
    const centerX = GAME_CONFIG.CANVAS_WIDTH / 2;
    const startY = 240;

    if (count <= 0) {
      // 木板全部被毁，绘制残破的木桩与断裂木茬
      for (let i = 0; i < 3; i++) {
        // 左残桩
        this.boardsContainer.roundRect(centerX - 180, startY + i * 105, 45, 38, 2);
        this.boardsContainer.fill({ color: 0x4a2e15 });
        // 右残桩
        this.boardsContainer.roundRect(centerX + 135, startY + i * 105, 45, 38, 2);
        this.boardsContainer.fill({ color: 0x4a2e15 });
      }
      return;
    }

    for (let i = 0; i < count; i++) {
      // 木板主体
      this.boardsContainer.roundRect(centerX - 180, startY + i * 105, 360, 42, 3);
      this.boardsContainer.fill({ color: 0x8b5a2b });
      this.boardsContainer.stroke({ width: 3, color: 0x4a2e15 });

      // 木板钉子
      this.boardsContainer.circle(centerX - 165, startY + i * 105 + 21, 4);
      this.boardsContainer.circle(centerX + 165, startY + i * 105 + 21, 4);
      this.boardsContainer.fill({ color: 0x222222 });
    }
  }

  public override update(deltaMs: number): void {
    if (!this.isCurrentActive) return;

    // 刷新木板与机枪状态
    const boards = this.enemyManager.getDoorBoards();
    this.renderBoards(Math.max(0, boards));
    this.renderTurret();

    // 更新机枪连射扫射动画
    if (this.turretFxTimer > 0) {
      this.turretFxTimer -= deltaMs;
      this.renderTurretBarrage();
      if (this.turretFxTimer <= 0) {
        this.vfxContainer.clear();
      }
    }

    // 渲染正门怪物步进
    this.enemyVisualContainer.removeChildren();
    const enemies = this.enemyManager.getEnemiesForScene('door');
    const centerX = GAME_CONFIG.CANVAS_WIDTH / 2;

    for (const enemy of enemies) {
      const g = new Graphics();
      if (enemy.stage === 0) {
        // 远端小黑影
        g.ellipse(centerX, 330, 24, 60);
        g.fill({ color: 0x111111, alpha: 0.8 });
        // 猩红双眼
        g.circle(centerX - 5, 305, 2);
        g.circle(centerX + 5, 305, 2);
        g.fill({ color: 0xff0000 });
      } else if (enemy.stage === 1) {
        // 中距离逼近
        g.ellipse(centerX, 380, 55, 130);
        g.fill({ color: 0x221a1a });
        g.circle(centerX - 12, 320, 4);
        g.circle(centerX + 12, 320, 4);
        g.fill({ color: 0xff2222 });
      } else {
        // 贴门撕扯木板 (巨大恐怖阴影)
        g.ellipse(centerX, 420, 110, 210);
        g.fill({ color: 0x331111 });
        // 狰狞面孔与血口
        g.circle(centerX - 24, 300, 7);
        g.circle(centerX + 24, 300, 7);
        g.fill({ color: 0xff0000 });
        g.arc(centerX, 330, 18, 0, Math.PI);
        g.fill({ color: 0x990000 });
      }
      this.enemyVisualContainer.addChild(g);
    }
  }

  private renderTurretBarrage(): void {
    this.vfxContainer.clear();
    const cx = GAME_CONFIG.CANVAS_WIDTH / 2;
    const cy = 160;

    // 绘制机枪狂暴枪口火舌
    this.vfxContainer.circle(cx - 11, cy, 22 + Math.random() * 16);
    this.vfxContainer.circle(cx + 11, cy, 22 + Math.random() * 16);
    this.vfxContainer.fill({ color: 0xffaa00, alpha: 0.8 });

    // 绘制下倾连发弹道轨迹 (Tracers)
    for (let i = 0; i < 4; i++) {
      const offsetX = (Math.random() - 0.5) * 120;
      const targetY = 300 + Math.random() * 250;
      this.vfxContainer.moveTo(cx + (Math.random() > 0.5 ? 11 : -11), cy);
      this.vfxContainer.lineTo(cx + offsetX, targetY);
      this.vfxContainer.stroke({ width: 3, color: 0xffeedd, alpha: 0.9 });

      // 击中血花爆破
      this.vfxContainer.circle(cx + offsetX, targetY, 18 + Math.random() * 14);
      this.vfxContainer.fill({ color: 0xcc1111, alpha: 0.65 });
    }
  }

  public showMuzzleFlash(): void {
    this.vfxContainer.clear();
    this.vfxContainer.circle(GAME_CONFIG.CANVAS_WIDTH / 2, GAME_CONFIG.CANVAS_HEIGHT / 2, 280);
    this.vfxContainer.fill({ color: 0xffdd88, alpha: 0.35 });
    setTimeout(() => {
      if (this.turretFxTimer <= 0) {
        this.vfxContainer.clear();
      }
    }, 60);
  }

  public playTurretBarrageVfx(): void {
    this.turretFxTimer = 900; // 900ms 机枪狂暴射击特效
  }

  private bindBarricadeEvents(): void {
    eventBus.on('BARRICADE_DAMAGED', (data) => {
      if (data.sceneId === 'door') {
        this.renderBoards(data.currentHealth);
      }
    });

    eventBus.on('FAULT_TOLERANCE_TRIGGERED', (data) => {
      if (data.sceneId === 'door') {
        this.playTurretBarrageVfx();
        this.renderTurret();
      }
    });

    eventBus.on('WEAPON_FIRED', (data) => {
      if (this.isCurrentActive && data.weapon === 'shotgun') {
        this.showMuzzleFlash();
      }
    });
  }
}
