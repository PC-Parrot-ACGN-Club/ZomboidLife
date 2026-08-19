import { eventBus } from '@/core/EventBus';

export class GameOverModal {
  private container: HTMLElement | null = null;

  constructor() {
    this.createDom();
    this.bindEvents();
  }

  private createDom(): void {
    const el = document.createElement('div');
    el.id = 'game-over-modal';
    el.className = 'interactive';
    el.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(15, 0, 0, 0.94);
      z-index: 100;
      display: none;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #fff;
      padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
      overflow-y: auto;
    `;

    el.innerHTML = `
      <div style="background: rgba(30, 10, 10, 0.95); border: 2px solid #ff3333; border-radius: 8px; padding: clamp(20px, 5vw, 36px); text-align: center; max-width: 480px; width: 100%; box-shadow: 0 0 50px rgba(255, 0, 0, 0.4);">
        <h1 style="color: #ff2222; font-size: clamp(28px, 7vw, 42px); margin-bottom: 6px; letter-spacing: 2px;">GAME OVER</h1>
        <p style="color: #aaa; font-size: clamp(13px, 3.5vw, 15px); margin-bottom: 20px;">防御已被突破，你未能挺过这一夜...</p>

        <!-- 本局战绩 -->
        <div style="background: rgba(0,0,0,0.5); padding: 14px 18px; border-radius: 6px; margin-bottom: 20px; text-align: left; font-size: clamp(13px, 3.5vw, 15px); line-height: 1.8;">
          <div>坚持波次：<span id="go-wave" style="color: #ffaa00; font-weight: bold;">第 1 波</span></div>
          <div>存活时间：<span id="go-time" style="color: #00ff88; font-weight: bold;">00:00</span></div>
          <div>击杀数量：<span id="go-kills" style="color: #44ddff; font-weight: bold;">0 只</span></div>
          <hr style="border: 0; border-top: 1px solid #333; margin: 8px 0;">
          <div style="font-size: 12px; color: #888;">历史最高波次：<span id="go-best-wave" style="color: #fff;">1</span></div>
        </div>

        <button id="btn-restart" style="
          background: #cc2222;
          color: #fff;
          border: none;
          padding: 12px 36px;
          min-height: 48px;
          font-size: clamp(16px, 4vw, 18px);
          font-weight: bold;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.2s;
          touch-action: manipulation;
          width: 100%;
        ">重新开始 (RESTART)</button>
      </div>
    `;

    document.body.appendChild(el);
    this.container = el;

    const restartHandler = () => {
      this.hide();
      eventBus.emit('GAME_RESTART');
    };

    document.getElementById('btn-restart')?.addEventListener('click', restartHandler);
    document.getElementById('btn-restart')?.addEventListener('touchend', (e) => {
      e.preventDefault();
      restartHandler();
    });
  }

  public show(stats: { survivalTime: number; kills: number; waves: number }): void {
    if (!this.container) return;

    // 读取并更新历史最高纪录
    const bestWave = Math.max(stats.waves, parseInt(localStorage.getItem('zomboid_best_wave') || '1', 10));
    localStorage.setItem('zomboid_best_wave', bestWave.toString());

    const mins = String(Math.floor(stats.survivalTime / 60)).padStart(2, '0');
    const secs = String(stats.survivalTime % 60).padStart(2, '0');

    const waveEl = document.getElementById('go-wave');
    const timeEl = document.getElementById('go-time');
    const killsEl = document.getElementById('go-kills');
    const bestEl = document.getElementById('go-best-wave');

    if (waveEl) waveEl.innerText = `第 ${stats.waves} 波`;
    if (timeEl) timeEl.innerText = `${mins}:${secs}`;
    if (killsEl) killsEl.innerText = `${stats.kills} 只`;
    if (bestEl) bestEl.innerText = `第 ${bestWave} 波`;

    this.container.style.display = 'flex';
  }

  public hide(): void {
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  private bindEvents(): void {
    eventBus.on('GAME_OVER', (stats) => {
      this.show(stats);
    });
  }
}
