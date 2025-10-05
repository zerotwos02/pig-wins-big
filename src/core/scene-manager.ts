import * as PIXI from 'pixi.js';

export abstract class Scene extends PIXI.Container {
  abstract init(): Promise<void> | void;
  show?(): void;
  hide?(): void;
  destroyScene?(): void; // optional hook before .destroy()
}

export class SceneManager {
  private static _current?: Scene;

  static async start(next: Scene, stage: PIXI.Container) {
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
