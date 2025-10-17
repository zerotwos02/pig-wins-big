import { App } from '@core/app';
import { SceneManager } from '@core/scene-manager';
import { bootScene } from '@scenes/boot-scene';
import { gameScene } from '@scenes/game-scene';
(async () => {
    const app = await App.init();
    await SceneManager.start(new bootScene(), app.stage);
    await SceneManager.start(new gameScene(), app.stage);
})();
