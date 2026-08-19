import { EnemyManager } from '@/systems/EnemyManager';
import { audioManager } from '@/audio/AudioManager';

export class CCTVModal {
  private container: HTMLElement | null = null;
  private isOpen: boolean = false;
  private enemyManager: EnemyManager;
  private animationFrameId: number | null = null;

  constructor(enemyManager: EnemyManager) {
    this.enemyManager = enemyManager;
    this.createDom();
    this.bindKeyboard();
  }

  private createDom(): void {
    const el = document.createElement('div');
    el.id = 'cctv-modal';
    el.className = 'interactive';
    el.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 10, 2, 0.95);
      z-index: 50;
      display: none;
      flex-direction: column;
      padding: 24px 36px;
      font-family: 'Courier New', Courier, monospace;
      color: #00ff66;
      box-shadow: inset 0 0 100px rgba(0, 255, 100, 0.2);
    `;

    el.innerHTML = `
      <!-- 监控头信息与扫描线 -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #00aa44; padding-bottom: 12px; margin-bottom: 16px;">
        <div style="font-size: 22px; font-weight: bold; display: flex; align-items: center; gap: 12px;">
          <span style="display: inline-block; width: 14px; height: 14px; background: #ff2222; border-radius: 50%; animation: blink 1s infinite;"></span>
          SECURITY SYSTEM // 3-CAM SURVEILLANCE FEED
        </div>
        <div style="display: flex; gap: 24px; font-size: 16px; align-items: center;">
          <div id="cctv-timestamp">TIME: 00:00:00</div>
          <button id="btn-close-cctv" style="background: #003311; border: 1px solid #00ff66; color: #00ff66; padding: 6px 16px; font-size: 14px; font-weight: bold; cursor: pointer;">[关闭 / SPACE]</button>
        </div>
      </div>

      <!-- 3 路分屏 -->
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; flex: 1;">
        <!-- CAM 1 -->
        <div style="border: 2px solid #00aa44; background: #021206; padding: 12px; display: flex; flex-direction: column; position: relative; overflow: hidden;">
          <div style="font-weight: bold; font-size: 16px; margin-bottom: 8px;">CAM 01: 正门走廊 (CORRIDOR)</div>
          <div id="cam1-content" style="flex: 1; border: 1px dashed #006622; display: flex; flex-direction: column; justify-content: center; align-items: center; font-size: 15px;">
            [ 无动静 - 状态安全 ]
          </div>
          <div style="font-size: 12px; color: #008833; margin-top: 8px;">TARGET: WALKER 路线</div>
        </div>

        <!-- CAM 2 -->
        <div style="border: 2px solid #00aa44; background: #021206; padding: 12px; display: flex; flex-direction: column; position: relative; overflow: hidden;">
          <div style="font-weight: bold; font-size: 16px; margin-bottom: 8px;">CAM 02: 窗外草坪 (YARD)</div>
          <div id="cam2-content" style="flex: 1; border: 1px dashed #006622; display: flex; flex-direction: column; justify-content: center; align-items: center; font-size: 15px;">
            [ 无动静 - 状态安全 ]
          </div>
          <div style="font-size: 12px; color: #008833; margin-top: 8px;">TARGET: LAUGHER 路线</div>
        </div>

        <!-- CAM 3 -->
        <div style="border: 2px solid #00aa44; background: #021206; padding: 12px; display: flex; flex-direction: column; position: relative; overflow: hidden;">
          <div style="font-weight: bold; font-size: 16px; margin-bottom: 8px;">CAM 03: 地窖梯底 (CELLAR)</div>
          <div id="cam3-content" style="flex: 1; border: 1px dashed #006622; display: flex; flex-direction: column; justify-content: center; align-items: center; font-size: 15px;">
            [ 无动静 - 状态安全 ]
          </div>
          <div style="font-size: 12px; color: #008833; margin-top: 8px;">TARGET: MIMIC 路线</div>
        </div>
      </div>

      <div style="font-size: 13px; color: #008833; margin-top: 14px; text-align: center;">
        * 提示：利用监控画面核实声音真伪。若听到窗户笑声但 CAM 02 无人，说明是 CAM 03 地窖 Mimic 的拟态诱骗！
      </div>

      <style>
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
      </style>
    `;

    document.body.appendChild(el);
    this.container = el;

    document.getElementById('btn-close-cctv')?.addEventListener('click', () => {
      this.close();
    });
  }

  public toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  public open(): void {
    if (!this.container) return;
    this.isOpen = true;
    this.container.style.display = 'flex';
    audioManager.playSceneSwitch();
    this.startLiveFeedLoop();
  }

  public close(): void {
    if (!this.container) return;
    this.isOpen = false;
    this.container.style.display = 'none';
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public isVisible(): boolean {
    return this.isOpen;
  }

  private startLiveFeedLoop(): void {
    const updateFeed = () => {
      if (!this.isOpen) return;

      // 更新时间戳
      const now = new Date();
      const timeStr = `TIME: ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${Math.floor(now.getMilliseconds() / 100)}`;
      const timeEl = document.getElementById('cctv-timestamp');
      if (timeEl) timeEl.innerText = timeStr;

      // 更新 3 路相机画面
      this.updateCam('door', 'cam1-content');
      this.updateCam('window', 'cam2-content');
      this.updateCam('cellar', 'cam3-content');

      this.animationFrameId = requestAnimationFrame(updateFeed);
    };

    this.animationFrameId = requestAnimationFrame(updateFeed);
  }

  private updateCam(sceneId: 'door' | 'window' | 'cellar', elementId: string): void {
    const el = document.getElementById(elementId);
    if (!el) return;

    const enemies = this.enemyManager.getEnemiesForScene(sceneId);
    if (enemies.length === 0) {
      el.innerHTML = `<span style="color: #00aa44;">[ ● 无生物活动 / 安全 ]</span>`;
      el.style.background = 'transparent';
      return;
    }

    const enemy = enemies[0];
    let stageText = '远处 (FAR)';
    let alertColor = '#ffaa00';
    if (enemy.stage === 1) {
      stageText = '逼近中 (MID-RANGE)';
      alertColor = '#ff6600';
    } else if (enemy.stage >= enemy.maxStage) {
      stageText = '⚠️ 正在破防 (AT DOOR/WINDOW)';
      alertColor = '#ff2222';
    }

    el.innerHTML = `
      <div style="text-align: center; color: ${alertColor};">
        <div style="font-size: 26px; font-weight: bold; margin-bottom: 8px;">⚠️ 发现目标 [${enemy.type.toUpperCase()}]</div>
        <div style="font-size: 16px;">距离状态: <strong>${stageText}</strong></div>
        <div style="font-size: 13px; color: #88ffaa; margin-top: 6px;">生命值: ${enemy.health} / ${enemy.maxHealth}</div>
      </div>
    `;
    el.style.background = 'rgba(255, 50, 50, 0.12)';
  }

  private bindKeyboard(): void {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this.toggle();
      }
    });
  }
}
