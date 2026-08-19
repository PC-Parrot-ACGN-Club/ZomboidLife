import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { GAME_CONFIG, SceneType } from '@/config/GameConfig';

export abstract class BaseScene extends Container {
  public abstract readonly sceneId: SceneType;
  protected isCurrentActive: boolean = false;

  constructor() {
    super();
    this.visible = false;
  }

  public async init(): Promise<void> {
    this.createPlaceholderVisuals();
  }

  public onEnter(): void {
    this.isCurrentActive = true;
    this.visible = true;
  }

  public onLeave(): void {
    this.isCurrentActive = false;
    this.visible = false;
  }

  public update(_deltaMs: number): void {
    // 子类实现具体的逐帧更新逻辑
  }

  /**
   * 创建占位视觉内容，保证在美术素材就绪前具备完整可玩性
   */
  protected abstract createPlaceholderVisuals(): void;

  protected createDebugBanner(title: string, color: number): void {
    const bg = new Graphics();
    bg.rect(0, 0, GAME_CONFIG.CANVAS_WIDTH, GAME_CONFIG.CANVAS_HEIGHT);
    bg.fill({ color, alpha: 0.15 });
    this.addChild(bg);

    const style = new TextStyle({
      fontFamily: 'Arial',
      fontSize: 28,
      fontWeight: 'bold',
      fill: '#ffffff',
      dropShadow: {
        alpha: 0.5,
        angle: Math.PI / 6,
        blur: 4,
        color: '#000000',
        distance: 3,
      },
    });

    const text = new Text({ text: title, style });
    text.anchor.set(0.5, 0);
    text.position.set(GAME_CONFIG.CANVAS_WIDTH / 2, 40);
    this.addChild(text);
  }
}
