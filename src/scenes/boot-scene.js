// src/scenes/boot-scene.ts
import { Container } from 'pixi.js';
import { loadBoot } from '@core/assets';
import { SFX } from '@/audio/sound-manager';
export class bootScene extends Container {
    async init() {
        // 1) load your textures/atlases/bundles
        await loadBoot();
        // If you use Assets bundles directly, e.g.:
        // Assets.addBundle('core', { bg: '/assets/bg.png', panel: '/assets/panel.png' });
        // await Assets.loadBundle('core');
        // 2) load & init audio BEFORE switching to the game scene
        await SFX.load(); // registers all sound aliases
        SFX.init(0.8); // restore mute state, set volume, attach unlock handlers
        console.log('[SFX] loaded & init done');
    }
}
