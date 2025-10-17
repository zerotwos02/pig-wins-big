import { Application } from 'pixi.js';
export class App {
    static async init() {
        const app = new Application();
        await app.init({
            resizeTo: window,
            backgroundAlpha: 0,
            // crisp rendering:
            resolution: Math.min(2, window.devicePixelRatio || 1),
            antialias: false,
            roundPixels: true,
            powerPreference: 'high-performance',
        });
        document.getElementById('app').appendChild(app.canvas);
        this.pixi = app;
        return app;
    }
}
