import * as PIXI from 'pixi.js';
export class Scene extends PIXI.Container {
}
export class SceneManager {
    static async start(next, stage) {
        if (this._current) {
            this._current.hide?.();
            this._current.destroyScene?.();
            this._current.destroy({ children: true });
            stage.removeChild(this._current);
        }
        this._current = next;
        stage.addChild(next);
        await next.init();
        next.show?.();
    }
}
