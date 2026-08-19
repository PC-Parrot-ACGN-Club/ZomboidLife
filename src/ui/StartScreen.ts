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
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #fff;
    `;

    el.innerHTML = `
      <div style="text-align: center; max-width: 600px; padding: 20px;">
        <h1 style="color: #ff3333; font-size: 54px; font-weight: 900; letter-spacing: 4px; margin-bottom: 8px; text-shadow: 0 0 20px rgba(255, 50, 50, 0.6);">
          ZOMBOID DEFENSE
        </h1>
        <div style="color: #aaa; font-size: 18px; margin-bottom: 36px; letter-spacing: 1px;">
          第一人称微操生存恐怖防守
        </div>

        <!-- 玩法操作指南 -->
        <div style="background: rgba(0,0,0,0.6); border: 1px solid #442222; border-radius: 8px; padding: 20px; text-align: left; font-size: 14px; line-height: 1.8; margin-bottom: 36px;">
          <div style="color: #ff8888; font-weight: bold; margin-bottom: 6px;">🎮 核心操作说明：</div>
          <div>• <strong>A / D 键 或 [1][2][3]</strong>：快速轮换 3 个防御视角（正门 / 窗户 / 活板门）。</div>
          <div>• <strong>鼠标右键</strong>：切换武器（霰弹枪 ⇄ 战术刀）。</div>
          <div>• <strong>鼠标左键</strong>：攻击目标。</div>
          <div>• <strong>鼠标移到底部 / R 键</strong>：霰弹枪装弹。</div>
          <div>• <strong>Space 空格键</strong>：在正门呼出 3 分屏 CCTV 监控。</div>
          <div style="color: #ffaa00; margin-top: 8px;">
            ⚠️ <strong>关键机制</strong>：开枪会发出巨大噪音，导致怪物疯狂加速涌来；使用小刀近战则完全静音！
          </div>
        </div>

        <button id="btn-start-game" style="
          background: #cc2222;
          color: #fff;
          border: none;
          padding: 16px 56px;
          font-size: 22px;
          font-weight: bold;
          border-radius: 6px;
          cursor: pointer;
          box-shadow: 0 0 30px rgba(204, 34, 34, 0.6);
          transition: transform 0.15s, background 0.2s;
        ">进入黑夜 (START GAME)</button>
      </div>
    `;

    document.body.appendChild(el);
    this.container = el;

    document.getElementById('btn-start-game')?.addEventListener('click', () => {
      audioManager.init();
      audioManager.resume();
      this.hide();
      this.onStartCallback();
    });
  }

  public hide(): void {
    if (this.container) {
      this.container.style.display = 'none';
    }
  }
}
