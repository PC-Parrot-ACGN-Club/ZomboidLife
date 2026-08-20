import { audioManager } from '@/audio/AudioManager';

export class StartScreen {
  private container: HTMLElement | null = null;
  private onStartCallback: (options?: { aiMode?: boolean }) => void;

  constructor(onStart: (options?: { aiMode?: boolean }) => void) {
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
        <div style="color: #aaa; font-size: clamp(13px, 3.5vw, 17px); margin-bottom: 20px;">
          第一人称微操生存恐怖防守
        </div>

        <!-- 玩法操作指南 (兼容 PC 与移动端) -->
        <div style="background: rgba(0,0,0,0.65); border: 1px solid #552222; border-radius: 8px; padding: 16px; text-align: left; font-size: clamp(12px, 3.2vw, 14px); line-height: 1.8; margin-bottom: 20px;">
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
            🤖 <strong>AI 自动游玩模式</strong>：内置战术 AI 全权接管防守决策、转场、压弹与射击，玩家只需观战或随时介入！
          </div>
        </div>

        <!-- 模式启动按钮组 -->
        <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
          <button id="btn-start-game" style="
            background: #cc2222;
            color: #fff;
            border: none;
            padding: 14px 28px;
            min-height: 52px;
            font-size: clamp(15px, 4vw, 18px);
            font-weight: bold;
            border-radius: 6px;
            cursor: pointer;
            box-shadow: 0 0 25px rgba(204, 34, 34, 0.6);
            touch-action: manipulation;
            flex: 1;
            min-width: 200px;
          ">⚔️ 手动游玩 (START)</button>

          <button id="btn-start-ai" style="
            background: linear-gradient(135deg, #0e7490 0%, #0369a1 100%);
            color: #e0f2fe;
            border: 2px solid #38bdf8;
            padding: 14px 28px;
            min-height: 52px;
            font-size: clamp(15px, 4vw, 18px);
            font-weight: bold;
            border-radius: 6px;
            cursor: pointer;
            box-shadow: 0 0 25px rgba(56, 189, 248, 0.6);
            touch-action: manipulation;
            flex: 1;
            min-width: 200px;
          ">🤖 AI 自动游玩 (观战)</button>
        </div>
      </div>
    `;

    document.body.appendChild(el);
    this.container = el;

    const startManualHandler = () => {
      audioManager.init();
      audioManager.resume();
      this.hide();
      this.onStartCallback({ aiMode: false });
    };

    const startAiHandler = () => {
      audioManager.init();
      audioManager.resume();
      this.hide();
      this.onStartCallback({ aiMode: true });
    };

    document.getElementById('btn-start-game')?.addEventListener('click', startManualHandler);
    document.getElementById('btn-start-game')?.addEventListener('touchend', (e) => {
      e.preventDefault();
      startManualHandler();
    });

    document.getElementById('btn-start-ai')?.addEventListener('click', startAiHandler);
    document.getElementById('btn-start-ai')?.addEventListener('touchend', (e) => {
      e.preventDefault();
      startAiHandler();
    });
  }

  public hide(): void {
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  public show(): void {
    if (this.container) {
      this.container.style.display = 'flex';
    }
  }
}
