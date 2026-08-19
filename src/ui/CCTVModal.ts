import { EnemyManager } from '@/systems/EnemyManager';
import { audioManager } from '@/audio/AudioManager';
import { eventBus } from '@/core/EventBus';

export class CCTVModal {
  private container: HTMLElement | null = null;
  private isOpen: boolean = false;
  private enemyManager: EnemyManager;
  private animationFrameId: number | null = null;

  constructor(enemyManager: EnemyManager) {
    this.enemyManager = enemyManager;
    this.createDom();
    this.bindControls();
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
      background: rgba(0, 10, 2, 0.96);
      z-index: 50;
      display: none;
      flex-direction: column;
      padding: max(12px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
      font-family: 'Courier New', Courier, monospace;
      color: #00ff66;
      box-shadow: inset 0 0 80px rgba(0, 255, 100, 0.2);
      overflow-y: auto;
    `;

    el.innerHTML = `
      <!-- 监控头信息与扫描线 -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #00aa44; padding-bottom: 8px; margin-bottom: 12px; gap: 8px;">
        <div style="font-size: 16px; font-weight: bold; display: flex; align-items: center; gap: 8px;">
          <span style="display: inline-block; width: 12px; height: 12px; background: #ff2222; border-radius: 50%; animation: blink 1s infinite;"></span>
          <span>SECURITY // 3-CAM FEED</span>
        </div>
        <div style="display: flex; gap: 12px; font-size: 13px; align-items: center;">
          <div id="cctv-timestamp" style="display: none;">TIME: 00:00:00</div>
          <button id="btn-close-cctv" style="
            background: #003311;
            border: 2px solid #00ff66;
            color: #00ff66;
            padding: 8px 16px;
            font-size: 14px;
            font-weight: bold;
            border-radius: 4px;
            cursor: pointer;
            min-height: 40px;
          ">[✖ 关闭 / SPACE]</button>
        </div>
      </div>

      <!-- 3 路分屏 -->
      <div class="cctv-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; flex: 1;">
        <!-- CAM 1 -->
        <div style="border: 2px solid #00aa44; background: #021206; padding: 10px; display: flex; flex-direction: column; position: relative; min-height: 120px;">
          <div style="font-weight: bold; font-size: 14px; margin-bottom: 6px;">CAM 01: 正门走廊</div>
          <div id="cam1-content" style="flex: 1; border: 1px dashed #006622; display: flex; flex-direction: column; justify-content: center; align-items: center; font-size: 13px; padding: 8px;">
            [ 无动静 - 状态安全 ]
          </div>
          <div style="font-size: 11px; color: #008833; margin-top: 6px;">TARGET: WALKER 路线</div>
        </div>

        <!-- CAM 2 -->
        <div style="border: 2px solid #00aa44; background: #021206; padding: 10px; display: flex; flex-direction: column; position: relative; min-height: 120px;">
          <div style="font-weight: bold; font-size: 14px; margin-bottom: 6px;">CAM 02: 窗外草坪</div>
          <div id="cam2-content" style="flex: 1; border: 1px dashed #006622; display: flex; flex-direction: column; justify-content: center; align-items: center; font-size: 13px; padding: 8px;">
            [ 无动静 - 状态安全 ]
          </div>
          <div style="font-size: 11px; color: #008833; margin-top: 6px;">TARGET: LAUGHER 路线</div>
        </div>

        <!-- CAM 3 -->
        <div style="border: 2px solid #00aa44; background: #021206; padding: 10px; display: flex; flex-direction: column; position: relative; min-height: 120px;">
          <div style="font-weight: bold; font-size: 14px; margin-bottom: 6px;">CAM 03: 地窖梯底</div>
          <div id="cam3-content" style="flex: 1; border: 1px dashed #006622; display: flex; flex-direction: column; justify-content: center; align-items: center; font-size: 13px; padding: 8px;">
            [ 无动静 - 状态安全 ]
          </div>
          <div style="font-size: 11px; color: #008833; margin-top: 6px;">TARGET: MIMIC 路线</div>
        </div>
      </div>

      <div style="font-size: 12px; color: #00aa44; margin-top: 10px; text-align: center;">
        * 提示：利用监控核查声音真伪。若听到窗户笑声但 CAM 02 无人，说明是地窖 Mimic 的拟态诱骗！
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

      const now = new Date();
      const timeStr = `TIME: ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${Math.floor(now.getMilliseconds() / 100)}`;
      const timeEl = document.getElementById('cctv-timestamp');
      if (timeEl) timeEl.innerText = timeStr;

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
    let defenseSubText = '';
    if (sceneId === 'door') {
      const b = this.enemyManager.getDoorBoards();
      const t = this.enemyManager.isDoorTurretAvailable();
      defenseSubText = `<div style="font-size: 11px; margin-top: 4px; color: ${b > 0 ? '#ffaa00' : '#ff3333'};">木板: ${b}/3 | 室内机枪: ${t ? '✅就绪' : '❌已耗尽'}</div>`;
    } else if (sceneId === 'cellar') {
      const h = this.enemyManager.getCellarHealth();
      const tr = this.enemyManager.isCellarTrapAvailable();
      defenseSubText = `<div style="font-size: 11px; margin-top: 4px; color: ${h > 0 ? '#00ff88' : '#ff3333'};">活板门: ${h}% | 机关陷阱: ${tr ? '✅就绪' : '❌已消耗'}</div>`;
    }

    if (enemies.length === 0) {
      el.innerHTML = `
        <span style="color: #00aa44;">[ ● 无生物活动 / 安全 ]</span>
        ${defenseSubText}
      `;
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
      stageText = '⚠️ 正在破防 (ATTACKING)';
      alertColor = '#ff2222';
    }

    el.innerHTML = `
      <div style="text-align: center; color: ${alertColor};">
        <div style="font-size: 20px; font-weight: bold; margin-bottom: 4px;">⚠️ [${enemy.type.toUpperCase()}]</div>
        <div style="font-size: 14px;">状态: <strong>${stageText}</strong></div>
        <div style="font-size: 12px; color: #88ffaa; margin-top: 4px;">HP: ${enemy.health} / ${enemy.maxHealth}</div>
        ${defenseSubText}
      </div>
    `;
    el.style.background = 'rgba(255, 50, 50, 0.12)';
  }

  private bindControls(): void {
    // 键盘空格键呼出
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this.toggle();
      }
    });

    // 移动端按钮或事件呼出
    eventBus.on('TRIGGER_CCTV_TOGGLE', () => {
      this.toggle();
    });
  }
}
