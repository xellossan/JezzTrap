# EntrapBall VR: Oculus Quest (WebXR) & Browser Co-Op Arena

A first-person 3D multiplayer and single-player arena game inspired by **Moraff's Entrap** and **JezzBall**, playable in both the **Meta Quest Browser (WebXR)** and any **Desktop Web Browser**.

## Included Files
- `index.html` — Main entry point containing the Start Screen (VR vs. Desktop selector, customizable Starting Balls and Player Lives, Room Name input defaulting to `Xellossan`, Single Player / Host / Join options) and in-game HUD.
- `standalone_singlefile.html` — All-in-one single-file build with CSS and JS inlined.
- `css/style.css` — Responsive HUD, lobby, reticle, and tactical minimap styling.
- `js/config.js` — Tunable game balance parameters (build cooldowns, ball clearance margins, configurable ball/life limits, and capture thresholds).
- `js/audio.js` — Procedural Web Audio API 3D sound synthesizer + WebRTC Direct Voice Chat microphone & remote audio stream handler.
- `js/network.js` — Peer-to-Peer 2-player networking powered by WebRTC (`PeerJS`) for real-time state sync and direct voice chat.
- `js/game.js` — Three.js 3D engine, WebXR controller thumbstick locomotion & rotation, dual-trigger block placement and single-block deletion, 3D in-world VR Restart button, desktop WASD + Mouse controls, anti-stuck Circle-vs-AABB ball physics, and flood-fill enclosure/trapping logic.

## Controls
### Oculus Quest VR Mode (WebXR)
- **Left Thumbstick**: Move Forward / Backward / Strafe Left / Strafe Right
- **Right Thumbstick**: Rotate Character (Yaw)
- **Right Trigger**: Place single 3D Wall Block at target cell (blocked if a ball is occupying/entering the cell)
- **Left Trigger (or Grip / A Button)**: Delete a single player-built Wall Block in front of you so you can never get trapped
- **When You Die in VR**: A floating 3D **CLICK / TRIGGER TO RESTART** button appears directly in front of your headset inside the 3D arena—aim at it and pull either trigger to restart immediately.

### Desktop Browser Mode
- **W / A / S / D** (or Arrow Keys): Move Forward / Strafe Left / Move Backward / Strafe Right (`Shift` to sprint)
- **Mouse** (or **Q / E**): Rotate Character View
- **Left Click** or **Spacebar**: Place single 3D Wall Block
- **Right Click** or **F / X / Backspace**: Delete single player-built Wall Block
- **Mouse Wheel** or **R**: Adjust block placement distance ahead (`2m` to `10m`)
- **M**: Toggle Microphone Mute/Unmute for P2P Voice Chat

## Web Server Deployment Note
1. Extract all files into any static web server directory (e.g., Nginx, Apache, GitHub Pages, Cloudflare Pages, Vercel, or `npx serve .`).
2. **HTTPS Requirement for WebXR & Microphone**: Modern browsers (including the Meta Quest Browser) require **HTTPS** (or `http://localhost` during local testing) to enable `navigator.xr` (WebXR VR sessions) and `navigator.mediaDevices.getUserMedia` (WebRTC Direct Audio Chat).
