import { Container } from 'pixi.js';
import { BaseScene } from './BaseScene';
import { DoorScene } from './DoorScene';
import { WindowScene } from './WindowScene';
import { CellarScene } from './CellarScene';
import { GAME_CONFIG, SceneType } from '@/config/GameConfig';
import { eventBus } from '@/core/EventBus';
import { EnemyManager } from '@/systems/EnemyManager';
import { audioManager } from '@/audio/AudioManager';

export class SceneManager {
  private container: Container;
  private scenes: Map<SceneType, BaseScene> = new Map();
  private currentSceneId: SceneType = GAME_CONFIG.SCENES.DOOR;
  private sceneList: SceneType[] = [
    GAME_CONFIG.SCENES.DOOR,
    GAME_CONFIG.SCENES.WINDOW,
    GAME_CONFIG.SCENES.CELLAR,
  ];
  private enemyManager: EnemyManager;
  private onCCTVClickCallback: () => void;

  // 手势触摸跟踪
  private touchStartX: number = 0;
  private touchStartY: number = 0;
  private touchStartTime: number = 0;

  constructor(rootContainer: Container, enemyManager: EnemyManager, onCCTVClick: () => void) {
    this.container = new Container();
    rootContainer.addChild(this.container);
    this.enemyManager = enemyManager;
    this.onCCTVClickCallback = onCCTVClick;
  }

  public async init(): Promise<void> {
    const door = new DoorScene(this.enemyManager, this.onCCTVClickCallback);
    const windowScene = new WindowScene(this.enemyManager);
    const cellar = new CellarScene(this.enemyManager);

    await Promise.all([door.init(), windowScene.init(), cellar.init()]);

    this.scenes.set(GAME_CONFIG.SCENES.DOOR, door);
    this.scenes.set(GAME_CONFIG.SCENES.WINDOW, windowScene);
    this.scenes.set(GAME_CONFIG.SCENES.CELLAR, cellar);

    this.container.addChild(door, windowScene, cellar);

    this.switchTo(GAME_CONFIG.SCENES.DOOR);
    this.bindControls();
  }

  public switchTo(sceneId: SceneType): void {
    if (!this.scenes.has(sceneId)) return;
    if (this.currentSceneId === sceneId && this.scenes.get(sceneId)?.visible) return;

    // 离开上一场景
    const currentScene = this.scenes.get(this.currentSceneId);
    if (currentScene) {
      currentScene.onLeave();
    }

    // 进入新场景
    this.currentSceneId = sceneId;
    const targetScene = this.scenes.get(sceneId)!;
    targetScene.onEnter();
    audioManager.playSceneSwitch();

    eventBus.emit('SCENE_CHANGED', sceneId);
  }

  public nextScene(): void {
    const currentIndex = this.sceneList.indexOf(this.currentSceneId);
    const nextIndex = (currentIndex + 1) % this.sceneList.length;
    this.switchTo(this.sceneList[nextIndex]);
  }

  public prevScene(): void {
    const currentIndex = this.sceneList.indexOf(this.currentSceneId);
    const prevIndex = (currentIndex - 1 + this.sceneList.length) % this.sceneList.length;
    this.switchTo(this.sceneList[prevIndex]);
  }

  public getCurrentScene(): BaseScene | undefined {
    return this.scenes.get(this.currentSceneId);
  }

  public getCurrentSceneId(): SceneType {
    return this.currentSceneId;
  }

  public update(deltaMs: number): void {
    const current = this.getCurrentScene();
    if (current) {
      current.update(deltaMs);
    }
  }

  private bindControls(): void {
    // 键盘监听 (PC 端)
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      if (key === 'a' || key === 'arrowleft') {
        this.prevScene();
      } else if (key === 'd' || key === 'arrowright') {
        this.nextScene();
      } else if (key === '1') {
        this.switchTo(GAME_CONFIG.SCENES.DOOR);
      } else if (key === '2') {
        this.switchTo(GAME_CONFIG.SCENES.WINDOW);
      } else if (key === '3') {
        this.switchTo(GAME_CONFIG.SCENES.CELLAR);
      }
    });

    // 触摸滑动与手势识别 (移动端)
    window.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length === 1) {
          const target = e.target as HTMLElement;
          if (target.closest('.interactive') || target.tagName === 'BUTTON') return;

          this.touchStartX = e.touches[0].clientX;
          this.touchStartY = e.touches[0].clientY;
          this.touchStartTime = Date.now();
        }
      },
      { passive: true }
    );

    window.addEventListener(
      'touchend',
      (e) => {
        if (e.changedTouches.length === 1) {
          const target = e.target as HTMLElement;
          if (target.closest('.interactive') || target.tagName === 'BUTTON') return;

          const touchEndX = e.changedTouches[0].clientX;
          const touchEndY = e.changedTouches[0].clientY;
          const dx = touchEndX - this.touchStartX;
          const dy = touchEndY - this.touchStartY;
          const dt = Date.now() - this.touchStartTime;

          // 1. 水平滑动切换视角 (左右划屏)
          if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy)) {
            if (dx < 0) {
              this.nextScene();
            } else {
              this.prevScene();
            }
          }
          // 2. 向下滑动快速装弹 (下拉划屏)
          else if (dy > 45 && Math.abs(dy) > Math.abs(dx)) {
            eventBus.emit('TRIGGER_RELOAD');
          }
          // 3. 原地轻点开火 (Tap 攻击)
          else if (Math.abs(dx) < 18 && Math.abs(dy) < 18 && dt < 350) {
            eventBus.emit('TRIGGER_ATTACK');
          }
        }
      },
      { passive: true }
    );
  }
}
