import { audioManager } from '@/audio/AudioManager';

export class StartScreen {
  private container: HTMLElement | null = null;
  private onStartCallback: () => void;

  constructor(onStart: () => void) {
    this.onStartCallback = onStart;
    this.createDom();
  }

  private createDom(): void {
    const el = document.createElement('div');
    el.id = 'start-screen';
    el.className = 'interactive';
    el.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: radial-gradient(circle, #1a0808 0%, #050202 100%);
      z-index: 200;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #fff;
      padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
      overflow-y: auto;
    `;

    el.innerHTML = `
      <div style="text-align: center; max-width: 580px; width: 100%; padding: 10px;">
        <h1 style="color: #ff3333; font-size: clamp(32px, 8vw, 52px); font-weight: 900; letter-spacing: 3px; margin-bottom: 6px; text-shadow: 0 0 20px rgba(255, 50, 50, 0.6);">
          ZOMBOID DEFENSE
        </h1>
        <div style="color: #aaa; font-size: clamp(13px, 3.5vw, 17px); margin-bottom: 24px;">
          第一人称微操生存恐怖防守
        </div>

        <!-- 玩法操作指南 (兼容 PC 与移动端) -->
        <div style="background: rgba(0,0,0,0.65); border: 1px solid #552222; border-radius: 8px; padding: 16px; text-align: left; font-size: clamp(12px, 3.2vw, 14px); line-height: 1.8; margin-bottom: 24px;">
          <div style="color: #ff8888; font-weight: bold; margin-bottom: 6px; font-size: 15px;">🎮 双端操作与核心机制说明：</div>
          <div>📱 <strong>触屏手势</strong>：左右划屏切视角 | 点击屏幕开火 | 下滑屏幕或点按钮装弹 | 点击【🔄切枪】切换武器。</div>
          <div>💻 <strong>键鼠操作</strong>：A/D 或 [1][2][3] 切视角 | 鼠标左键开火 | 鼠标右键切枪 | R 键或移到底部逐发压弹 (支持随时打断开火) | 空格呼出 CCTV。</div>
          <div style="color: #44ddff; margin-top: 6px;">
            🔫 <strong>泵动式霰弹枪</strong>：8 发弹容，支持逐发压弹装填，装弹中可随时开火打断！
          </div>
          <div style="color: #00ff88; margin-top: 4px;">
            🛡️ <strong>应急容错机制</strong>：正门木板初次攻破时自动机枪全歼门外僵尸；活板门初次攻破时落石陷阱砸碎梯上所有怪！
          </div>
          <div style="color: #ffaa00; margin-top: 8px; padding-top: 6px; border-top: 1px dashed #442222;">
            ⚠️ <strong>声音与博弈</strong>：霰弹枪开火产生巨大噪音引爆怪潮狂暴涌出；战术刀近战完全静音！
          </div>
        </div>

        <button id="btn-start-game" style="
          background: #cc2222;
          color: #fff;
          border: none;
          padding: 14px 44px;
          min-height: 52px;
          font-size: clamp(17px, 4.5vw, 22px);
          font-weight: bold;
          border-radius: 6px;
          cursor: pointer;
          box-shadow: 0 0 30px rgba(204, 34, 34, 0.6);
          touch-action: manipulation;
        ">进入黑夜 (START GAME)</button>
      </div>
    `;

    document.body.appendChild(el);
    this.container = el;

    const startHandler = () => {
      audioManager.init();
      audioManager.resume();
      this.hide();
      this.onStartCallback();
    };

    document.getElementById('btn-start-game')?.addEventListener('click', startHandler);
    document.getElementById('btn-start-game')?.addEventListener('touchend', (e) => {
      e.preventDefault();
      startHandler();
    });
  }

  public hide(): void {
    if (this.container) {
      this.container.style.display = 'none';
    }
  }
}
