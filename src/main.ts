import { GameApp } from './core/GameApp';

window.addEventListener('DOMContentLoaded', async () => {
  try {
    const game = new GameApp();
    await game.init();
  } catch (error) {
    console.error('游戏启动失败:', error);
  }
});
