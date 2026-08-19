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

    // 5. 监控台与屏幕
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

    // 6. 特效图层 (枪火、血迹、挥刀)
    this.vfxContainer = new Graphics();
    this.addChild(this.vfxContainer);

    this.bindBarricadeEvents();
  }

  public renderBoards(count: number): void {
    this.boardsContainer.clear();
    const centerX = GAME_CONFIG.CANVAS_WIDTH / 2;
    const startY = 240;

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

  public override update(_deltaMs: number): void {
    if (!this.isCurrentActive) return;

    // 刷新木板状态
    const boards = this.enemyManager.getDoorBoards();
    this.renderBoards(Math.max(0, boards));

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

  public showMuzzleFlash(): void {
    this.vfxContainer.clear();
    this.vfxContainer.circle(GAME_CONFIG.CANVAS_WIDTH / 2, GAME_CONFIG.CANVAS_HEIGHT / 2, 280);
    this.vfxContainer.fill({ color: 0xffdd88, alpha: 0.35 });
    setTimeout(() => {
      this.vfxContainer.clear();
    }, 60);
  }

  private bindBarricadeEvents(): void {
    eventBus.on('BARRICADE_DAMAGED', (data) => {
      if (data.sceneId === 'door') {
        this.renderBoards(data.currentHealth);
      }
    });

    eventBus.on('WEAPON_FIRED', (data) => {
      if (this.isCurrentActive && data.weapon === 'shotgun') {
        this.showMuzzleFlash();
      }
    });
  }
}
