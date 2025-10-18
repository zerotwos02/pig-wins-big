# 🐷 Pig Wins Big

> A 2D browser-based slot-machine game built with **PixiJS v8**, **TypeScript**, and **Vite** — featuring polished casino visuals, sound design, and a fully modular architecture.

---

## 🎮 Overview

**Pig Wins Big** is a light-weight and responsive slot-machine experience inspired by the Original pig win game.  
It combines playful art direction (golden pigs, coins, hammers, and shiny reels) with solid engineering principles — modular code, asset bundles, and sound-effect management.

<p align="center">
  <img src="./public/assets/images/pig.png" alt="Pig Wins Big Logo" width="120" />
</p>

---

## ✨ Features

- 🎰 **Dynamic Reel System** – modular spinning reels with customizable symbols.  
- 🔨 **Hammer Bonus Feature** – instant-collect logic for special combinations.  
- 🐖 **Lock & Win Mode** – progressive feature with animated transitions.  
- 💰 **Win Toast & Coin Fountain** – visual feedback for every win tier.  
- 🔊 **Audio System** – handled through a custom `SFX` manager using `@pixi/sound`.  
- ⚡ **Optimized for Web** – runs on desktop and mobile browsers via WebGL 2.  
- 🧩 **Type-Safe Architecture** – fully written in TypeScript with path aliases.  

---

## 🏗️ Tech Stack

| Layer | Technology |
|:------|:------------|
| Rendering | [PixiJS v8](https://pixijs.com/) |
| Build Tool | [Vite v7](https://vitejs.dev/) |
| Language | TypeScript |
| Audio | `@pixi/sound` |
| Data / RPC | `@bufbuild/protobuf`, `@connectrpc/connect` |
| Deployment | [Vercel](https://vercel.com/) |

---

## 📂 Project Structure
pig-wins/
│
├── public/
│ └── assets/
│ └── images/ ← sprites, backgrounds, icons
│
├── src/
│ ├── boot/ ← asset loader (loadBoot)
│ ├── core/ ← App init & renderer setup
│ ├── game/ ← reels, features, logic
│ ├── net/ ← mock server, data schemas
│ ├── scenes/ ← HUD, modals, etc.
│ ├── ui/ ← UI layouts (buttons, panels)
│ ├── audio/ ← sound manager (SFX)
│ └── main.ts ← entry point
│
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json


---

## 🚀 Getting Started

### 1️⃣ Clone and Install
```bash
git clone https://github.com/yourusername/pig-wins-big.git
cd pig-wins-big
npm install
```
### 2️⃣ Run Development Server
```bash
npm run dev
```

Then open http://localhost:5173
 in your browser.

### 3️⃣ Build for Production
```bash
npm run build
```

Outputs static files to dist/.

### 4️⃣ Preview Local Build
```bash
npm run preview
```


### 💡 Why I Should Keep Improving

There’s still huge potential to improve and expand. Here’s why continuing to enhance this project matters:

1. **🧩 Feature Expansion**  
   - Add progressive jackpots or “Lock & Win” bonus variations  
   - Introduce daily rewards or bonus spin events  
   - Add a leaderboard system or seasonal competitions  

2. **👤 Player Profiles & Secure Payments**  
   - Implement player login and persistent profiles (with session data and stored stats)  
   - Integrate a **payment system** for in-game tokens or virtual currency  
   - Optionally link a **crypto wallet (e.g. MetaMask)** for blockchain-based rewards, skins, or NFTs  
   - Allow each profile to track wins, level progress, and transaction history  

3. **🚀 Professional Portfolio Value**  
   Every new feature — from UI polish to payment integration — evolves this into a professional-grade project that demonstrates expertise in **PixiJS**, **TypeScript**, **web architecture**, and even **Web3 integration**.

---






### 🌍 Deployment ( Vercel )

Push to a GitHub repository.

In Vercel, create a new project from that repo.

Set:

Framework Preset: Vite

Build Command: npm run build

Output Directory: dist

Node.js Version: 20.x

```bash

{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```
