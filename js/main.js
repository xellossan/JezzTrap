// ============================================================================
// Quake VR & Desktop P2P Arena - Core Engine (Three.js + WebXR + Desktop FPS)
// Implements:
//  - Pre-Game VR vs Desktop Display Mode Selector
//  - Room Host / Join / Single Player Launcher (Default room: "Xellossan")
//  - Oculus Quest WebXR Left Thumbstick Locomotion (Forward/Back/Left/Right)
//  - Oculus Quest WebXR Right Thumbstick Character Yaw Rotation
//  - Desktop Browser WASD + Mouse PointerLock / Drag Rotation
//  - Full 8-Weapon Quake Arsenal, Projectiles, Hitscan, Splash Damage & Bots
// ============================================================================

window.QuakeGame = (function () {
  // Configuration & Selection State before game start
  const config = {
    displayMode: 'desktop', // 'desktop' | 'vr'
    vrTurnStyle: 'smooth',  // 'smooth' | 'snap'
    roomName: 'Xellossan',
    enableMic: true,
    practiceBotInP2P: true
  };

  let scene, camera, renderer, playerRig, desktopViewGun, vrRightGun, vrWristHudCanvas, vrWristHudTex;
  let arenaData = null;
  let gameRunning = false;
  let isPaused = false;
  let xrSessionActive = false;
  let snapTurnCooldown = 0;

  // Player Combat & Physics State
  const player = {
    x: -18,
    y: 0.1,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: -Math.PI / 2,
    pitch: 0,
    height: 1.65,
    radius: 0.48,
    onGround: true,
    health: 100,
    armor: 0,
    armorType: 0, // 0.3 Green, 0.6 Yellow, 0.8 Red
    armorName: 'None',
    weaponsOwned: {
      axe: true,
      shotgun: true,
      supershotgun: false,
      nailgun: false,
      supernailgun: false,
      grenadelauncher: false,
      rocketlauncher: false,
      thunderbolt: false
    },
    ammo: {
      shells: 25,
      nails: 0,
      rockets: 0,
      cells: 0
    },
    currentWeapon: 'shotgun',
    fireCooldown: 0,
    recoilOffset: 0,
    bobPhase: 0,
    quadTimer: 0,
    pentagramTimer: 0,
    megaDecayTimer: 0,
    lavaTickTimer: 0,
    frags: 0,
    deaths: 0
  };

  // Remote Peer Player State (for 2-Player P2P)
  const remotePeer = {
    active: false,
    x: 18,
    y: 0.1,
    z: 0,
    yaw: Math.PI / 2,
    health: 100,
    weaponId: 'shotgun',
    frags: 0,
    mesh: null,
    lastSeen: 0
  };

  // Active Projectiles, Beams, Particles & AI Monsters
  const projectiles = [];
  const transientEffects = [];
  const bots = [];
  const keyState = {};
  let mouseButtons = { left: false };
  let isDraggingLook = false;
  let lastMouseX = 0;
  let lastMouseY = 0;
  let lastNetworkSync = 0;
  let lastTime = performance.now();

  // Initialize Three.js Scene & Renderer
  function initThree() {
    const container = document.getElementById('game-canvas-container');
    container.innerHTML = '';

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0705);
    scene.fog = new THREE.FogExp2(0x120906, 0.022);

    camera = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.08, 140);

    // Player Rig (Dolly) holds the camera and VR controllers so moving/rotating the rig
    // moves the player in both Oculus Quest WebXR and Desktop mode!
    playerRig = new THREE.Group();
    playerRig.position.set(player.x, player.y, player.z);
    playerRig.rotation.y = player.yaw;
    camera.position.set(0, player.height, 0);
    playerRig.add(camera);
    scene.add(playerRig);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.xr.enabled = true;
    container.appendChild(renderer.domElement);

    // Ambient & Gothic Directional Lighting
    const ambient = new THREE.AmbientLight(0x6e5239, 0.72);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffb36b, 0.65);
    dirLight.position.set(14, 24, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Build Arena Level & Pickups
    arenaData = QuakeArena.buildLevel(scene);

    // Create Remote Player 3D Avatar
    remotePeer.mesh = QuakeArena.createCharacterAvatar({
      color: 0x2563eb,
      visorColor: 0x38bdf8,
      weaponId: 'rocketlauncher'
    });
    remotePeer.mesh.visible = false;
    scene.add(remotePeer.mesh);

    // Setup Desktop First-Person Viewmodel Gun attached to Camera
    desktopViewGun = new THREE.Group();
    desktopViewGun.position.set(0.24, -0.22, -0.42);
    camera.add(desktopViewGun);

    // Setup WebXR Controllers (Left = Locomotion + Wrist HUD, Right = Rotation + Aim/Shoot)
    setupWebXRControllers();

    rebuildEquippedGunModel();

    window.addEventListener('resize', onWindowResize);
    setupDesktopInputListeners();

    // Start unified render loop (supports both WebXR headset framerate and Desktop rAF)
    renderer.setAnimationLoop(renderLoop);
  }

  function setupWebXRControllers() {
    const controller0 = renderer.xr.getController(0);
    const controller1 = renderer.xr.getController(1);
    playerRig.add(controller0);
    playerRig.add(controller1);

    // Diegetic VR Wrist HUD Canvas on Left Controller
    vrWristHudCanvas = document.createElement('canvas');
    vrWristHudCanvas.width = 256;
    vrWristHudCanvas.height = 128;
    vrWristHudTex = new THREE.CanvasTexture(vrWristHudCanvas);
    const wristMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.11),
      new THREE.MeshBasicMaterial({ map: vrWristHudTex, side: THREE.DoubleSide })
    );
    wristMesh.position.set(0, 0.06, -0.05);
    wristMesh.rotation.x = -Math.PI / 3;

    // Right-hand VR Weapon Mount
    vrRightGun = new THREE.Group();

    function bindController(ctrl) {
      ctrl.addEventListener('connected', (event) => {
        const src = event.data;
        if (!src) return;
        if (src.handedness === 'left') {
          ctrl.add(wristMesh);
        } else if (src.handedness === 'right') {
          ctrl.add(vrRightGun);
        }
      });
      ctrl.addEventListener('selectstart', (event) => {
        const src = event.data;
        if (!src || src.handedness === 'right') {
          mouseButtons.left = true;
        } else if (src.handedness === 'left') {
          tryJump();
        }
      });
      ctrl.addEventListener('selectend', (event) => {
        const src = event.data;
        if (!src || src.handedness === 'right') {
          mouseButtons.left = false;
        }
      });
      ctrl.addEventListener('squeezestart', () => {
        cycleWeapon(1);
      });
    }

    bindController(controller0);
    bindController(controller1);

    renderer.xr.addEventListener('sessionstart', () => {
      xrSessionActive = true;
      camera.position.set(0, 0, 0); // Headset tracking handles eye height in local-floor space
      desktopViewGun.visible = false;
      vrRightGun.visible = true;
      showToast('Oculus Quest WebXR Session Active — Left Stick: Move | Right Stick: Rotate');
    });

    renderer.xr.addEventListener('sessionend', () => {
      xrSessionActive = false;
      camera.position.set(0, player.height, 0);
      desktopViewGun.visible = true;
      vrRightGun.visible = false;
    });
  }

  function updateVRWristHud() {
    if (!vrWristHudCanvas || !vrWristHudTex) return;
    const ctx = vrWristHudCanvas.getContext('2d');
    ctx.fillStyle = '#140e0a';
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 252, 124);

    const wDef = QuakeWeapons.getWeaponById(player.currentWeapon);
    const ammoVal = wDef.ammoType ? player.ammo[wDef.ammoType] : 'INF';

    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`HP: ${Math.ceil(player.health)}  AP: ${Math.ceil(player.armor)}`, 14, 30);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`WPN: ${wDef.shortName} (${ammoVal})`, 14, 60);
    ctx.fillStyle = '#f87171';
    ctx.fillText(`FRAGS: ${player.frags} | ${config.roomName}`, 14, 90);
    ctx.fillStyle = '#22c55e';
    ctx.font = '14px monospace';
    ctx.fillText(QuakeNetwork.isMicMuted() ? 'VOICE: MUTED' : 'VOICE: P2P LIVE', 14, 114);
    vrWristHudTex.needsUpdate = true;
  }

  function rebuildEquippedGunModel() {
    if (!desktopViewGun) return;
    while (desktopViewGun.children.length > 0) {
      desktopViewGun.remove(desktopViewGun.children[0]);
    }
    const mesh1 = QuakeWeapons.buildWeaponMesh(player.currentWeapon);
    desktopViewGun.add(mesh1);

    if (vrRightGun) {
      while (vrRightGun.children.length > 0) {
        vrRightGun.remove(vrRightGun.children[0]);
      }
      const mesh2 = QuakeWeapons.buildWeaponMesh(player.currentWeapon);
      vrRightGun.add(mesh2);
    }
    updateWeaponBarUI();
  }

  function selectWeapon(weaponId) {
    if (!player.weaponsOwned[weaponId]) return false;
    const def = QuakeWeapons.getWeaponById(weaponId);
    if (def.ammoType && player.ammo[def.ammoType] < def.ammoPerShot) {
      showToast(`Out of ${def.ammoType.toUpperCase()} for ${def.name}!`);
      return false;
    }
    player.currentWeapon = weaponId;
    rebuildEquippedGunModel();
    return true;
  }

  function cycleWeapon(dir = 1) {
    const order = QuakeWeapons.WEAPON_DEFS.map((w) => w.id);
    let idx = order.indexOf(player.currentWeapon);
    for (let i = 0; i < order.length; i++) {
      idx = (idx + dir + order.length) % order.length;
      const cand = order[idx];
      const def = QuakeWeapons.getWeaponById(cand);
      if (player.weaponsOwned[cand] && (!def.ammoType || player.ammo[def.ammoType] >= def.ammoPerShot)) {
        selectWeapon(cand);
        return;
      }
    }
  }

  function setupDesktopInputListeners() {
    window.addEventListener('keydown', (e) => {
      // Do not hijack typing when an input field is focused
      if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        return;
      }
      keyState[e.code] = true;

      if (e.code === 'Space' && gameRunning && !isPaused) {
        e.preventDefault();
        tryJump();
      }
      if (e.code.startsWith('Digit')) {
        const slot = parseInt(e.code.replace('Digit', ''), 10);
        const w = QuakeWeapons.getWeaponBySlot(slot);
        if (w) selectWeapon(w.id);
      }
      if (e.code === 'KeyM') {
        toggleVoiceMicUI();
      }
      if (e.code === 'KeyV') {
        toggleSfxMuteUI();
      }
      if (e.code === 'KeyB' && gameRunning) {
        spawnOrToggleBot();
      }
      if (e.code === 'KeyH' || e.code === 'Tab') {
        if (gameRunning) {
          e.preventDefault();
          toggleCodexModal();
        }
      }
      if (e.code === 'KeyP') {
        if (gameRunning) togglePauseMenu();
      }
    });

    window.addEventListener('keyup', (e) => {
      keyState[e.code] = false;
    });

    const canvas = renderer.domElement;
    canvas.addEventListener('mousedown', (e) => {
      if (!gameRunning || isPaused) return;
      QuakeSound.ensureContext();
      if (e.button === 0) {
        mouseButtons.left = true;
        if (document.pointerLockElement !== canvas && config.displayMode === 'desktop') {
          try {
            canvas.requestPointerLock();
          } catch (err) {}
        }
      }
      isDraggingLook = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) mouseButtons.left = false;
      isDraggingLook = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (!gameRunning || isPaused) return;
      const sensitivity = 0.0024;
      if (document.pointerLockElement === canvas) {
        player.yaw -= e.movementX * sensitivity;
        player.pitch = Math.max(-1.35, Math.min(1.35, player.pitch - e.movementY * sensitivity));
      } else if (isDraggingLook) {
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        player.yaw -= dx * sensitivity * 1.4;
        player.pitch = Math.max(-1.35, Math.min(1.35, player.pitch - dy * sensitivity * 1.4));
      }
    });

    window.addEventListener('wheel', (e) => {
      if (!gameRunning || isPaused) return;
      cycleWeapon(e.deltaY > 0 ? 1 : -1);
    });
  }

  function tryJump() {
    if (player.onGround) {
      player.vy = 7.8;
      player.onGround = false;
      QuakeSound.playJump();
    }
  }

  // Poll Oculus Quest WebXR Thumbsticks (Left Stick = Move Forward/Back/Left/Right, Right Stick = Rotate Yaw)
  function pollWebXRThumbsticks(dt) {
    const session = renderer.xr.getSession();
    let moveForward = 0;
    let moveStrafe = 0;

    if (session && session.inputSources) {
      for (const source of session.inputSources) {
        if (!source.gamepad) continue;
        const gp = source.gamepad;
        const axes = gp.axes || [];
        // WebXR standard mapping puts primary thumbstick on axes[2], axes[3], with fallback to axes[0], axes[1]
        const stickX = Math.abs(axes[2] || 0) > 0.08 ? axes[2] : (axes[0] || 0);
        const stickY = Math.abs(axes[3] || 0) > 0.08 ? axes[3] : (axes[1] || 0);
        const deadzone = 0.14;

        if (source.handedness === 'left') {
          if (Math.abs(stickX) > deadzone) moveStrafe += stickX;
          if (Math.abs(stickY) > deadzone) moveForward += -stickY; // Pushing stick forward is negative Y
          // Left trigger or X/Y button jump
          if ((gp.buttons[4] && gp.buttons[4].pressed) || (gp.buttons[5] && gp.buttons[5].pressed)) {
            tryJump();
          }
        } else if (source.handedness === 'right') {
          if (Math.abs(stickX) > deadzone) {
            if (config.vrTurnStyle === 'snap') {
              if (snapTurnCooldown <= 0 && Math.abs(stickX) > 0.6) {
                player.yaw -= Math.sign(stickX) * (Math.PI / 4);
                snapTurnCooldown = 0.28;
              }
            } else {
              // Smooth rotation via Right Thumbstick
              player.yaw -= stickX * 2.4 * dt;
            }
          }
          // Right trigger fire
          if (gp.buttons[0] && gp.buttons[0].pressed) {
            mouseButtons.left = true;
          } else if (gp.buttons[0] && !gp.buttons[0].pressed && xrSessionActive) {
            mouseButtons.left = false;
          }
          // A button jump
          if (gp.buttons[4] && gp.buttons[4].pressed) {
            tryJump();
          }
        }
      }
    }

    if (snapTurnCooldown > 0) snapTurnCooldown -= dt;
    return { moveForward, moveStrafe };
  }

  // Handle Player Movement, Gravity, Stair Stepping, Lava & Teleporters
  function updatePlayerPhysics(dt) {
    const xrInput = pollWebXRThumbsticks(dt);
    let forwardInput = xrInput.moveForward;
    let strafeInput = xrInput.moveStrafe;

    // Keyboard WASD + Arrow Keys
    if (keyState['KeyW'] || keyState['ArrowUp']) forwardInput += 1;
    if (keyState['KeyS'] || keyState['ArrowDown']) forwardInput -= 1;
    if (keyState['KeyD']) strafeInput += 1;
    if (keyState['KeyA']) strafeInput -= 1;
    if (keyState['ArrowLeft']) player.yaw += 2.1 * dt;
    if (keyState['ArrowRight']) player.yaw -= 2.1 * dt;

    // Normalize input vector
    const len = Math.hypot(forwardInput, strafeInput);
    if (len > 1) {
      forwardInput /= len;
      strafeInput /= len;
    }

    // Quake fast run speed (10.5 m/s)
    const moveSpeed = (keyState['ShiftLeft'] || keyState['ShiftRight']) ? 13.0 : 10.2;
    const sinY = Math.sin(player.yaw);
    const cosY = Math.cos(player.yaw);

    // Forward in Three.js camera space is (-sin(yaw), 0, -cos(yaw)); Right is (cos(yaw), 0, -sin(yaw))
    const wishVx = (-sinY * forwardInput + cosY * strafeInput) * moveSpeed;
    const wishVz = (-cosY * forwardInput - sinY * strafeInput) * moveSpeed;

    // Smooth Quake air/ground acceleration
    const accel = player.onGround ? 14.0 : 4.5;
    player.vx += (wishVx - player.vx) * Math.min(1, accel * dt);
    player.vz += (wishVz - player.vz) * Math.min(1, accel * dt);

    // Gravity
    player.vy -= 20.0 * dt;

    // Proposed new position
    let nextX = player.x + player.vx * dt;
    let nextZ = player.z + player.vz * dt;
    let nextY = player.y + player.vy * dt;

    // Resolve Horizontal Collisions & Stair Stepping (step height up to 0.52m)
    const stepHeight = 0.52;
    let floorHeight = 0.0;
    let touchingLava = false;

    for (const box of arenaData.colliders) {
      if (box.isLava) {
        if (nextX > box.minX && nextX < box.maxX && nextZ > box.minZ && nextZ < box.maxZ && nextY <= box.maxY + 0.25) {
          touchingLava = true;
        }
        continue;
      }

      const overlapX = nextX + player.radius > box.minX && nextX - player.radius < box.maxX;
      const overlapZ = nextZ + player.radius > box.minZ && nextZ - player.radius < box.maxZ;

      if (overlapX && overlapZ) {
        // Check if player is above or stepping onto this surface
        if (player.y >= box.maxY - stepHeight && nextY <= box.maxY + 0.08 && player.vy <= 0) {
          floorHeight = Math.max(floorHeight, box.maxY);
        } else if (nextY + player.height > box.minY && nextY < box.maxY - 0.05) {
          // Solid wall collision pushback
          const prevOverlapX = player.x + player.radius > box.minX && player.x - player.radius < box.maxX;
          const prevOverlapZ = player.z + player.radius > box.minZ && player.z - player.radius < box.maxZ;
          if (!prevOverlapX) {
            nextX = player.x;
            player.vx = 0;
          }
          if (!prevOverlapZ) {
            nextZ = player.z;
            player.vz = 0;
          }
        }
      }
    }

    if (nextY <= floorHeight) {
      nextY = floorHeight;
      player.vy = 0;
      player.onGround = true;
    } else {
      player.onGround = false;
    }

    // Clamp to Arena Bounds
    player.x = Math.max(-26.5, Math.min(26.5, nextX));
    player.z = Math.max(-26.5, Math.min(26.5, nextZ));
    player.y = nextY;

    // Lava Burn Damage
    if (touchingLava) {
      player.lavaTickTimer -= dt;
      if (player.lavaTickTimer <= 0) {
        player.lavaTickTimer = 0.5;
        applyDamageToPlayer(12, 'Molten Lava');
      }
    }

    // Check Slipgate Teleporters
    for (const tp of arenaData.teleporters) {
      const dist = Math.hypot(player.x - tp.x, player.z - tp.z);
      if (dist < tp.radius && Math.abs(player.y - (tp.y - 1.2)) < 1.5) {
        player.x = tp.destX;
        player.y = tp.destY;
        player.z = tp.destZ;
        player.yaw = tp.destYaw;
        QuakeSound.playTeleport();
        flashOverlay('rgba(251, 191, 36, 0.55)');
        showToast('Slipgate Teleported to Upper Gallery!');
        break;
      }
    }

    // Update Player Rig & Camera Transform
    playerRig.position.set(player.x, player.y, player.z);
    playerRig.rotation.y = player.yaw;
    if (!xrSessionActive) {
      camera.rotation.x = player.pitch;
      // Quake Viewmodel Bobbing & Recoil
      const speed = Math.hypot(player.vx, player.vz);
      if (speed > 0.5 && player.onGround) {
        player.bobPhase += dt * speed * 1.1;
      }
      player.recoilOffset = Math.max(0, player.recoilOffset - dt * 4.5);
      const bobX = Math.cos(player.bobPhase) * 0.014;
      const bobY = Math.abs(Math.sin(player.bobPhase)) * 0.016;
      camera.position.set(0, player.height + bobY, 0);
      desktopViewGun.position.set(0.24 + bobX, -0.22 - bobY * 0.6, -0.42 + player.recoilOffset * 0.09);
    }
  }

  // Handle Pickups (Weapons, Ammo, Health, Armor, Powerups) using Authentic Quake Rules
  function updatePickups(dt, nowSec) {
    for (const item of arenaData.pickups) {
      if (!item.active) {
        item.respawnTimer -= dt;
        if (item.respawnTimer <= 0) {
          item.active = true;
          item.mesh.visible = true;
        }
        continue;
      }

      // Rotate and float item mesh
      item.mesh.rotation.y += dt * 1.8;
      item.mesh.position.y = item.baseY + Math.sin(nowSec * 3.0 + item.index) * 0.12;

      const dist = Math.hypot(player.x - item.x, (player.y + 0.9) - item.y, player.z - item.z);
      if (dist > 1.45) continue;

      let picked = false;
      if (item.type === 'weapon') {
        player.weaponsOwned[item.id] = true;
        const wDef = QuakeWeapons.getWeaponById(item.id);
        if (wDef.ammoType) {
          const bonus = wDef.ammoType === 'shells' ? 15 : wDef.ammoType === 'nails' ? 30 : 5;
          player.ammo[wDef.ammoType] = Math.min(
            QuakeWeapons.AMMO_LIMITS[wDef.ammoType],
            player.ammo[wDef.ammoType] + bonus
          );
        }
        selectWeapon(item.id);
        QuakeSound.playPickup('weapon');
        showToast(`Picked up ${item.name}!`);
        picked = true;
      } else if (item.type === 'ammo') {
        const cap = QuakeWeapons.AMMO_LIMITS[item.ammoType];
        if (player.ammo[item.ammoType] < cap) {
          player.ammo[item.ammoType] = Math.min(cap, player.ammo[item.ammoType] + item.amount);
          QuakeSound.playPickup('ammo');
          showToast(`Picked up ${item.name}`);
          picked = true;
        }
      } else if (item.type === 'health') {
        if (item.isMega || player.health < item.max) {
          player.health = Math.min(item.max, player.health + item.amount);
          QuakeSound.playPickup('health');
          showToast(`Picked up ${item.name}`);
          picked = true;
        }
      } else if (item.type === 'armor') {
        // Authentic QuakeC armor restore value formula: (other.armortype * other.armorvalue < type * value)
        const currentRestore = player.armorType * player.armor;
        const pickupRestore = item.armorType * item.armorValue;
        if (currentRestore < pickupRestore) {
          player.armor = item.armorValue;
          player.armorType = item.armorType;
          player.armorName = item.name.split(' ')[0];
          QuakeSound.playPickup('armor');
          showToast(`Equipped ${item.name}`);
          picked = true;
        }
      } else if (item.type === 'powerup') {
        if (item.powerup === 'quad') {
          player.quadTimer = item.duration;
          QuakeSound.playPickup('quad');
          showToast('QUAD DAMAGE ACTIVATED (4x Damage for 30s)!');
        } else if (item.powerup === 'pentagram') {
          player.pentagramTimer = item.duration;
          QuakeSound.playPickup('pentagram');
          showToast('PENTAGRAM OF PROTECTION (30s Invulnerability)!');
        }
        picked = true;
      }

      if (picked) {
        item.active = false;
        item.mesh.visible = false;
        item.respawnTimer = item.respawn;
        flashOverlay('rgba(250, 204, 21, 0.22)');
        QuakeNetwork.send({ type: 'pickup', index: item.index });
        updateHUD();
      }
    }
  }

  // Firing Logic for All 8 Quake Weapons
  function attemptFireWeapon() {
    if (player.fireCooldown > 0) return;
    const wDef = QuakeWeapons.getWeaponById(player.currentWeapon);

    if (wDef.ammoType && player.ammo[wDef.ammoType] < wDef.ammoPerShot) {
      cycleWeapon(-1);
      return;
    }

    if (wDef.ammoType) {
      player.ammo[wDef.ammoType] -= wDef.ammoPerShot;
    }

    player.fireCooldown = wDef.cooldown;
    player.recoilOffset = 1.0;
    const hasQuad = player.quadTimer > 0;
    const damageMult = hasQuad ? 4 : 1;

    QuakeSound.playWeaponFire(wDef.id, hasQuad);

    // Compute world firing origin & direction from Camera (or VR Right Controller when in WebXR)
    const origin = new THREE.Vector3();
    const dir = new THREE.Vector3(0, 0, -1);

    if (xrSessionActive && vrRightGun && vrRightGun.parent) {
      vrRightGun.parent.getWorldPosition(origin);
      const quat = new THREE.Quaternion();
      vrRightGun.parent.getWorldQuaternion(quat);
      dir.applyQuaternion(quat).normalize();
    } else {
      camera.getWorldPosition(origin);
      const quat = new THREE.Quaternion();
      camera.getWorldQuaternion(quat);
      dir.applyQuaternion(quat).normalize();
    }

    if (wDef.type === 'melee' || wDef.type === 'hitscan' || wDef.type === 'beam') {
      for (let p = 0; p < (wDef.pellets || 1); p++) {
        const shotDir = dir.clone();
        if (wDef.spread > 0) {
          shotDir.x += (Math.random() - 0.5) * wDef.spread * 2;
          shotDir.y += (Math.random() - 0.5) * wDef.spread * 2;
          shotDir.z += (Math.random() - 0.5) * wDef.spread * 2;
          shotDir.normalize();
        }
        performHitscan(origin, shotDir, wDef.range, wDef.damage * damageMult, wDef.type === 'beam' ? 0x38bdf8 : (hasQuad ? 0x60a5fa : 0xfbbf24));
      }
    } else if (wDef.type === 'projectile_nail') {
      spawnProjectile({
        kind: 'nail',
        origin: origin.clone().addScaledVector(dir, 0.6),
        velocity: dir.clone().multiplyScalar(wDef.projectileSpeed),
        damage: wDef.damage * damageMult,
        splashRadius: 0,
        gravity: 0,
        bounces: 0,
        ttl: 2.5,
        color: hasQuad ? 0x38bdf8 : wDef.color,
        owner: 'local'
      });
    } else if (wDef.type === 'projectile_grenade') {
      const vel = dir.clone().multiplyScalar(wDef.projectileSpeed);
      vel.y += 4.2;
      spawnProjectile({
        kind: 'grenade',
        origin: origin.clone().addScaledVector(dir, 0.6),
        velocity: vel,
        damage: wDef.damage * damageMult,
        splashRadius: wDef.splashRadius,
        gravity: 18.0,
        bounces: 4,
        ttl: 2.5,
        color: 0x22c55e,
        owner: 'local'
      });
    } else if (wDef.type === 'projectile_rocket') {
      spawnProjectile({
        kind: 'rocket',
        origin: origin.clone().addScaledVector(dir, 0.7),
        velocity: dir.clone().multiplyScalar(wDef.projectileSpeed),
        damage: wDef.damage * damageMult,
        splashRadius: wDef.splashRadius,
        gravity: 0,
        bounces: 0,
        ttl: 4.0,
        color: 0xef4444,
        owner: 'local'
      });
    }

    QuakeNetwork.send({
      type: 'shoot',
      weaponId: wDef.id,
      ox: origin.x, oy: origin.y, oz: origin.z,
      dx: dir.x, dy: dir.y, dz: dir.z,
      quad: hasQuad
    });

    updateHUD();
  }

  function performHitscan(origin, dir, maxRange, damage, tracerColor) {
    let bestDist = maxRange;
    let hitTarget = null;
    let hitPoint = origin.clone().addScaledVector(dir, maxRange);

    // Check intersection with Arena Walls
    const steps = 36;
    const stepLen = maxRange / steps;
    for (let i = 1; i <= steps; i++) {
      const pt = origin.clone().addScaledVector(dir, i * stepLen);
      if (pt.y <= 0 || pt.y >= 14) {
        bestDist = i * stepLen;
        hitPoint.copy(pt);
        break;
      }
      let hitWall = false;
      for (const box of arenaData.colliders) {
        if (box.isLava) continue;
        if (pt.x >= box.minX && pt.x <= box.maxX && pt.y >= box.minY && pt.y <= box.maxY && pt.z >= box.minZ && pt.z <= box.maxZ) {
          bestDist = i * stepLen;
          hitPoint.copy(pt);
          hitWall = true;
          break;
        }
      }
      if (hitWall) break;
    }

    // Check Bots
    for (const bot of bots) {
      if (bot.dead) continue;
      const botCenter = new THREE.Vector3(bot.x, bot.y + 1.0, bot.z);
      const toBot = botCenter.clone().sub(origin);
      const proj = toBot.dot(dir);
      if (proj > 0 && proj < bestDist) {
        const closest = origin.clone().addScaledVector(dir, proj);
        if (closest.distanceTo(botCenter) < 0.78) {
          bestDist = proj;
          hitPoint.copy(closest);
          hitTarget = { type: 'bot', bot };
        }
      }
    }

    // Check Remote Peer Player
    if (remotePeer.active) {
      const peerCenter = new THREE.Vector3(remotePeer.x, remotePeer.y + 1.0, remotePeer.z);
      const toPeer = peerCenter.clone().sub(origin);
      const proj = toPeer.dot(dir);
      if (proj > 0 && proj < bestDist) {
        const closest = origin.clone().addScaledVector(dir, proj);
        if (closest.distanceTo(peerCenter) < 0.78) {
          bestDist = proj;
          hitPoint.copy(closest);
          hitTarget = { type: 'peer' };
        }
      }
    }

    // Draw Tracer / Lightning Beam
    const geom = new THREE.BufferGeometry().setFromPoints([
      origin.clone().add(new THREE.Vector3(0.08, -0.08, 0)),
      hitPoint
    ]);
    const line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: tracerColor }));
    scene.add(line);
    transientEffects.push({ mesh: line, ttl: 0.08 });

    // Impact Spark
    const spark = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 6, 6),
      new THREE.MeshBasicMaterial({ color: tracerColor })
    );
    spark.position.copy(hitPoint);
    scene.add(spark);
    transientEffects.push({ mesh: spark, ttl: 0.14 });

    if (hitTarget) {
      if (hitTarget.type === 'bot') {
        damageBot(hitTarget.bot, damage);
      } else if (hitTarget.type === 'peer') {
        QuakeNetwork.send({ type: 'hit', damage, weaponId: player.currentWeapon });
        showHitMarker();
      }
    }
  }

  function spawnProjectile(opts) {
    let geom;
    if (opts.kind === 'rocket') {
      geom = new THREE.CylinderGeometry(0.06, 0.08, 0.45, 8);
      geom.rotateX(Math.PI / 2);
    } else if (opts.kind === 'grenade') {
      geom = new THREE.DodecahedronGeometry(0.14, 0);
    } else {
      geom = new THREE.CylinderGeometry(0.025, 0.025, 0.32, 6);
      geom.rotateX(Math.PI / 2);
    }

    const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ color: opts.color }));
    mesh.position.copy(opts.origin);
    mesh.lookAt(opts.origin.clone().add(opts.velocity));
    scene.add(mesh);

    projectiles.push({
      ...opts,
      mesh
    });
  }

  function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.ttl -= dt;
      if (p.gravity) p.velocity.y -= p.gravity * dt;

      const nextPos = p.mesh.position.clone().addScaledVector(p.velocity, dt);
      let collided = false;

      // Floor / Ceiling
      if (nextPos.y <= 0.12) {
        if (p.bounces > 0) {
          p.bounces--;
          nextPos.y = 0.15;
          p.velocity.y = Math.abs(p.velocity.y) * 0.58;
          p.velocity.x *= 0.78;
          p.velocity.z *= 0.78;
          QuakeSound.playGrenadeBounce();
        } else {
          collided = true;
        }
      }

      // Arena Box Colliders
      if (!collided) {
        for (const box of arenaData.colliders) {
          if (box.isLava) continue;
          if (nextPos.x >= box.minX && nextPos.x <= box.maxX && nextPos.y >= box.minY && nextPos.y <= box.maxY && nextPos.z >= box.minZ && nextPos.z <= box.maxZ) {
            if (p.bounces > 0) {
              p.bounces--;
              p.velocity.negate().multiplyScalar(0.55);
              QuakeSound.playGrenadeBounce();
            } else {
              collided = true;
            }
            break;
          }
        }
      }

      // Direct Hit on Bots
      if (!collided && p.owner === 'local') {
        for (const bot of bots) {
          if (bot.dead) continue;
          if (Math.hypot(nextPos.x - bot.x, nextPos.y - (bot.y + 1.0), nextPos.z - bot.z) < 0.85) {
            collided = true;
            if (!p.splashRadius) damageBot(bot, p.damage);
            break;
          }
        }
      }

      // Direct Hit on Remote Peer
      if (!collided && p.owner === 'local' && remotePeer.active) {
        if (Math.hypot(nextPos.x - remotePeer.x, nextPos.y - (remotePeer.y + 1.0), nextPos.z - remotePeer.z) < 0.85) {
          collided = true;
          if (!p.splashRadius) {
            QuakeNetwork.send({ type: 'hit', damage: p.damage, weaponId: player.currentWeapon });
            showHitMarker();
          }
        }
      }

      // Direct Hit on Local Player from Bot or Peer
      if (!collided && p.owner !== 'local') {
        if (Math.hypot(nextPos.x - player.x, nextPos.y - (player.y + 1.0), nextPos.z - player.z) < 0.85) {
          collided = true;
          if (!p.splashRadius) applyDamageToPlayer(p.damage, p.ownerName || 'Enemy Nail');
        }
      }

      if (collided || p.ttl <= 0) {
        if (p.splashRadius > 0) {
          triggerExplosion(nextPos, p.damage, p.splashRadius, p.owner);
        }
        scene.remove(p.mesh);
        projectiles.splice(i, 1);
      } else {
        p.mesh.position.copy(nextPos);
      }
    }
  }

  function triggerExplosion(pos, maxDamage, radius, owner) {
    QuakeSound.playExplosion();
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 0.42, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.75 })
    );
    sphere.position.copy(pos);
    scene.add(sphere);
    transientEffects.push({ mesh: sphere, ttl: 0.24, scaleUp: true });

    // Splash Damage & Rocket Jump Impulse on Local Player
    const distToPlayer = Math.hypot(player.x - pos.x, (player.y + 0.9) - pos.y, player.z - pos.z);
    if (distToPlayer < radius) {
      const falloff = 1 - distToPlayer / radius;
      const selfDmg = Math.round(maxDamage * falloff * (owner === 'local' ? 0.45 : 0.85));
      if (selfDmg > 0) applyDamageToPlayer(selfDmg, 'Explosion');
      // Quake Rocket Jump Impulse!
      const pushDir = new THREE.Vector3(player.x - pos.x, (player.y + 1.1) - pos.y, player.z - pos.z).normalize();
      player.vx += pushDir.x * 11 * falloff;
      player.vy += Math.max(4.5, pushDir.y * 12.5 * falloff);
      player.vz += pushDir.z * 11 * falloff;
      player.onGround = false;
    }

    // Splash Damage on Bots
    for (const bot of bots) {
      if (bot.dead) continue;
      const d = Math.hypot(bot.x - pos.x, (bot.y + 1.0) - pos.y, bot.z - pos.z);
      if (d < radius) {
        damageBot(bot, Math.round(maxDamage * (1 - d / radius)));
      }
    }

    // Splash Damage on Remote Peer
    if (owner === 'local' && remotePeer.active) {
      const dPeer = Math.hypot(remotePeer.x - pos.x, (remotePeer.y + 1.0) - pos.y, remotePeer.z - pos.z);
      if (dPeer < radius) {
        const dmg = Math.round(maxDamage * (1 - dPeer / radius));
        QuakeNetwork.send({ type: 'hit', damage: dmg, weaponId: player.currentWeapon });
        showHitMarker();
      }
    }
  }

  function applyDamageToPlayer(rawDamage, sourceLabel) {
    if (player.pentagramTimer > 0) {
      flashOverlay('rgba(250, 204, 21, 0.25)');
      return;
    }
    // Authentic Quake Armor Absorption calculation
    const save = Math.min(player.armor, Math.ceil(rawDamage * player.armorType));
    player.armor = Math.max(0, player.armor - save);
    if (player.armor === 0) {
      player.armorType = 0;
      player.armorName = 'None';
    }
    const take = Math.ceil(rawDamage - save);
    player.health -= take;
    QuakeSound.playPain();
    flashOverlay('rgba(220, 38, 38, 0.52)');

    if (player.health <= 0) {
      player.deaths++;
      showToast(`Fragged by ${sourceLabel}! Respawning at Slipgate...`);
      QuakeNetwork.send({ type: 'fragged' });
      respawnLocalPlayer();
    }
    updateHUD();
  }

  function respawnLocalPlayer() {
    const sp = arenaData.spawnPoints[Math.floor(Math.random() * arenaData.spawnPoints.length)];
    player.x = sp.x;
    player.y = sp.y;
    player.z = sp.z;
    player.vx = 0;
    player.vy = 0;
    player.vz = 0;
    player.yaw = sp.yaw;
    player.health = 100;
    player.armor = 0;
    player.armorType = 0;
    player.armorName = 'None';
    player.ammo.shells = Math.max(25, player.ammo.shells);
    player.quadTimer = 0;
    player.pentagramTimer = 0;
    selectWeapon('shotgun');
    QuakeSound.playTeleport();
    updateHUD();
  }

  // Single-Player & Practice Quake Monsters (Grunt, Death Knight, Ogre, Shambler)
  function spawnBots(count = 4) {
    bots.forEach((b) => scene.remove(b.mesh));
    bots.length = 0;

    const archetypes = [
      { name: 'Quake Grunt', hp: 60, speed: 5.5, color: 0x78350f, visor: 0xfbbf24, weapon: 'shotgun', dmg: 10 },
      { name: 'Death Knight', hp: 110, speed: 6.4, color: 0x7f1d1d, visor: 0xef4444, weapon: 'nailgun', dmg: 12 },
      { name: 'Quake Ogre', hp: 140, speed: 5.0, color: 0x365314, visor: 0xa3e635, weapon: 'grenadelauncher', dmg: 18 },
      { name: 'Shambler Fiend', hp: 200, speed: 5.8, color: 0xd6d3d1, visor: 0x38bdf8, weapon: 'thunderbolt', dmg: 22 }
    ];

    for (let i = 0; i < count; i++) {
      const arch = archetypes[i % archetypes.length];
      const sp = arenaData.spawnPoints[(i + 1) % arenaData.spawnPoints.length];
      const mesh = QuakeArena.createCharacterAvatar({
        color: arch.color,
        visorColor: arch.visor,
        weaponId: arch.weapon,
        scale: arch.name.includes('Shambler') ? 1.22 : 1.0
      });
      mesh.position.set(sp.x, sp.y, sp.z);
      scene.add(mesh);

      bots.push({
        ...arch,
        maxHp: arch.hp,
        x: sp.x,
        y: sp.y,
        z: sp.z,
        yaw: sp.yaw,
        attackCooldown: 1.5 + Math.random(),
        strafeDir: i % 2 === 0 ? 1 : -1,
        strafeTimer: 2.0,
        dead: false,
        respawnTimer: 0,
        mesh
      });
    }
  }

  function spawnOrToggleBot() {
    if (bots.length > 0) {
      bots.forEach((b) => scene.remove(b.mesh));
      bots.length = 0;
      showToast('Arena Bots Cleared');
    } else {
      spawnBots(3);
      showToast('Spawned 3 Quake Monsters in Arena!');
    }
  }

  function damageBot(bot, amount) {
    bot.hp -= amount;
    showHitMarker();
    if (bot.hp <= 0) {
      bot.dead = true;
      bot.mesh.visible = false;
      bot.respawnTimer = 6.0;
      player.frags++;
      QuakeSound.playExplosion();
      showToast(`Fragged ${bot.name}! (+1 Frag)`);
      // Bonus ammo backpack drop
      player.ammo.shells = Math.min(100, player.ammo.shells + 5);
      player.ammo.nails = Math.min(200, player.ammo.nails + 10);
      player.ammo.rockets = Math.min(100, player.ammo.rockets + 2);
      updateHUD();
    }
  }

  function updateBots(dt, nowSec) {
    for (const bot of bots) {
      if (bot.dead) {
        bot.respawnTimer -= dt;
        if (bot.respawnTimer <= 0) {
          const sp = arenaData.spawnPoints[Math.floor(Math.random() * arenaData.spawnPoints.length)];
          bot.x = sp.x;
          bot.y = sp.y;
          bot.z = sp.z;
          bot.hp = bot.maxHp;
          bot.dead = false;
          bot.mesh.visible = true;
          bot.mesh.position.set(bot.x, bot.y, bot.z);
        }
        continue;
      }

      const dx = player.x - bot.x;
      const dz = player.z - bot.z;
      const dist = Math.hypot(dx, dz);
      bot.yaw = Math.atan2(-dx, -dz);
      bot.mesh.rotation.y = bot.yaw;

      bot.strafeTimer -= dt;
      if (bot.strafeTimer <= 0) {
        bot.strafeDir *= -1;
        bot.strafeTimer = 1.5 + Math.random() * 1.8;
      }

      const dirX = dx / (dist || 1);
      const dirZ = dz / (dist || 1);
      const perpX = -dirZ * bot.strafeDir;
      const perpZ = dirX * bot.strafeDir;

      const moveFactor = dist > 9 ? 0.85 : (dist < 4.5 ? -0.5 : 0.2);
      const nx = bot.x + (dirX * moveFactor + perpX * 0.65) * bot.speed * dt;
      const nz = bot.z + (dirZ * moveFactor + perpZ * 0.65) * bot.speed * dt;

      // Avoid lava pit in center
      if (Math.abs(nx) > 7.4 || Math.abs(nz) > 7.4) {
        bot.x = Math.max(-25, Math.min(25, nx));
        bot.z = Math.max(-25, Math.min(25, nz));
      }
      bot.mesh.position.set(bot.x, bot.y, bot.z);

      // Animate legs
      if (bot.mesh.userData.legL) {
        bot.mesh.userData.legL.rotation.x = Math.sin(nowSec * 8) * 0.45;
        bot.mesh.userData.legR.rotation.x = -Math.sin(nowSec * 8) * 0.45;
      }

      // Bot Firing at Player
      bot.attackCooldown -= dt;
      if (bot.attackCooldown <= 0 && dist < 28) {
        bot.attackCooldown = 1.4 + Math.random() * 1.1;
        const origin = new THREE.Vector3(bot.x, bot.y + 1.25, bot.z);
        const target = new THREE.Vector3(player.x, player.y + 1.0, player.z);
        const fireDir = target.sub(origin).normalize();
        spawnProjectile({
          kind: 'nail',
          origin,
          velocity: fireDir.multiplyScalar(24),
          damage: bot.dmg,
          splashRadius: 0,
          gravity: 0,
          bounces: 0,
          ttl: 2.2,
          color: 0xf97316,
          owner: 'bot',
          ownerName: bot.name
        });
      }
    }
  }

  // Handle Incoming P2P Messages from Player 2 / Host
  function onNetworkMessage(msg) {
    if (!msg) return;
    if (msg.type === 'state') {
      remotePeer.active = true;
      remotePeer.x = msg.x;
      remotePeer.y = msg.y;
      remotePeer.z = msg.z;
      remotePeer.yaw = msg.yaw;
      remotePeer.health = msg.health;
      remotePeer.frags = msg.frags || 0;
      remotePeer.lastSeen = performance.now();
      if (remotePeer.mesh) {
        remotePeer.mesh.visible = true;
        remotePeer.mesh.position.set(remotePeer.x, remotePeer.y, remotePeer.z);
        remotePeer.mesh.rotation.y = remotePeer.yaw;
      }
      updateScoreboardUI();
    } else if (msg.type === 'shoot') {
      QuakeSound.playWeaponFire(msg.weaponId || 'shotgun', !!msg.quad);
      const origin = new THREE.Vector3(msg.ox, msg.oy, msg.oz);
      const dir = new THREE.Vector3(msg.dx, msg.dy, msg.dz);
      if (msg.weaponId === 'rocketlauncher' || msg.weaponId === 'grenadelauncher') {
        spawnProjectile({
          kind: msg.weaponId === 'rocketlauncher' ? 'rocket' : 'grenade',
          origin,
          velocity: dir.multiplyScalar(34),
          damage: 0,
          splashRadius: 5.5,
          gravity: msg.weaponId === 'grenadelauncher' ? 16 : 0,
          bounces: msg.weaponId === 'grenadelauncher' ? 3 : 0,
          ttl: 2.5,
          color: 0x38bdf8,
          owner: 'peer'
        });
      } else {
        const end = origin.clone().addScaledVector(dir, 30);
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([origin, end]),
          new THREE.LineBasicMaterial({ color: 0x38bdf8 })
        );
        scene.add(line);
        transientEffects.push({ mesh: line, ttl: 0.08 });
      }
    } else if (msg.type === 'hit') {
      applyDamageToPlayer(msg.damage || 15, `Peer (${config.roomName})`);
    } else if (msg.type === 'fragged') {
      player.frags++;
      showToast(`You fragged your Peer in Room "${config.roomName}"! (+1 Frag)`);
      updateHUD();
    } else if (msg.type === 'pickup') {
      const item = arenaData.pickups[msg.index];
      if (item && item.active) {
        item.active = false;
        item.mesh.visible = false;
        item.respawnTimer = item.respawn;
      }
    }
  }

  function renderLoop(timestamp) {
    const now = timestamp || performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;
    const nowSec = now / 1000;

    // Animate Lava & Slipgate Portals even while in Lobby background
    if (arenaData) {
      for (const anim of arenaData.animatedMeshes) {
        if (anim.type === 'lava' && anim.tex) {
          anim.tex.offset.x = (nowSec * 0.12) % 1;
          anim.tex.offset.y = Math.sin(nowSec * 0.4) * 0.15;
        } else if (anim.type === 'portal' && anim.mesh) {
          anim.mesh.rotation.z = nowSec * 1.4;
        }
      }
    }

    if (gameRunning && !isPaused) {
      if (player.fireCooldown > 0) player.fireCooldown -= dt;
      if (player.quadTimer > 0) {
        player.quadTimer = Math.max(0, player.quadTimer - dt);
      }
      if (player.pentagramTimer > 0) {
        player.pentagramTimer = Math.max(0, player.pentagramTimer - dt);
      }
      // Megahealth Decay above 100 HP (1 HP per 5 seconds per Quake specs)
      if (player.health > 100) {
        player.megaDecayTimer += dt;
        if (player.megaDecayTimer >= 5.0) {
          player.megaDecayTimer = 0;
          player.health = Math.max(100, player.health - 1);
          updateHUD();
        }
      }

      updatePlayerPhysics(dt);
      updatePickups(dt, nowSec);
      if (mouseButtons.left) attemptFireWeapon();
      updateProjectiles(dt);
      updateBots(dt, nowSec);

      // Update Transient Visual Effects
      for (let i = transientEffects.length - 1; i >= 0; i--) {
        const fx = transientEffects[i];
        fx.ttl -= dt;
        if (fx.scaleUp) fx.mesh.scale.multiplyScalar(1 + dt * 6);
        if (fx.ttl <= 0) {
          scene.remove(fx.mesh);
          transientEffects.splice(i, 1);
        }
      }

      // Broadcast P2P State at ~25Hz
      if (now - lastNetworkSync > 40 && QuakeNetwork.getRole() !== 'single') {
        lastNetworkSync = now;
        QuakeNetwork.send({
          type: 'state',
          x: player.x,
          y: player.y,
          z: player.z,
          yaw: player.yaw,
          health: player.health,
          frags: player.frags
        });
      }

      // Update Voice Meter & VR Wrist HUD
      const voiceMeterBar = document.getElementById('hud-voice-bar');
      if (voiceMeterBar) {
        voiceMeterBar.style.width = `${QuakeNetwork.getVoiceActivityLevel()}%`;
      }
      if (xrSessionActive) updateVRWristHud();
    } else if (!gameRunning && camera && playerRig) {
      // Gently orbit camera around the Slipgate Arena while on the Start Screen
      playerRig.position.set(Math.sin(nowSec * 0.22) * 16, 4.2, Math.cos(nowSec * 0.22) * 16);
      playerRig.rotation.y = nowSec * 0.22 + Math.PI;
    }

    renderer.render(scene, camera);
  }

  // UI & HUD Synchronization
  function updateHUD() {
    const hpEl = document.getElementById('hud-health');
    const apEl = document.getElementById('hud-armor');
    const apTypeEl = document.getElementById('hud-armor-label');
    const ammoEl = document.getElementById('hud-ammo');
    const wpnNameEl = document.getElementById('hud-weapon-name');
    const powerupBadge = document.getElementById('hud-powerup-badge');

    if (hpEl) hpEl.textContent = Math.max(0, Math.ceil(player.health));
    if (apEl) apEl.textContent = Math.max(0, Math.ceil(player.armor));
    if (apTypeEl) apTypeEl.textContent = `ARMOR (${player.armorName.toUpperCase()})`;

    const wDef = QuakeWeapons.getWeaponById(player.currentWeapon);
    if (ammoEl) ammoEl.textContent = wDef.ammoType ? player.ammo[wDef.ammoType] : '∞';
    if (wpnNameEl) wpnNameEl.textContent = wDef.name.toUpperCase();

    if (powerupBadge) {
      if (player.quadTimer > 0) {
        powerupBadge.classList.remove('hidden');
        powerupBadge.textContent = `QUAD DAMAGE 4X (${Math.ceil(player.quadTimer)}s)`;
      } else if (player.pentagramTimer > 0) {
        powerupBadge.classList.remove('hidden');
        powerupBadge.textContent = `INVULNERABLE (${Math.ceil(player.pentagramTimer)}s)`;
      } else {
        powerupBadge.classList.add('hidden');
      }
    }

    updateWeaponBarUI();
    updateScoreboardUI();
  }

  function updateWeaponBarUI() {
    const bar = document.getElementById('hud-weapon-bar');
    if (!bar) return;
    bar.innerHTML = QuakeWeapons.WEAPON_DEFS.map((w) => {
      const owned = !!player.weaponsOwned[w.id];
      const active = player.currentWeapon === w.id;
      const count = w.ammoType ? player.ammo[w.ammoType] : '∞';
      return `<button type="button" onclick="QuakeGame.selectWeapon('${w.id}')" class="weapon-slot px-2.5 py-1 rounded text-xs font-mono-tech flex items-center gap-1.5 ${owned ? 'owned' : 'opacity-40'} ${active ? 'active' : ''}">
        <span class="text-amber-400 font-bold">[${w.slot}]</span>
        <span>${w.shortName}</span>
        <span class="text-[10px] opacity-80">${count}</span>
      </button>`;
    }).join('');
  }

  function updateScoreboardUI() {
    const fragEl = document.getElementById('hud-frags');
    const peerFragEl = document.getElementById('hud-peer-frags');
    if (fragEl) fragEl.textContent = player.frags;
    if (peerFragEl) {
      peerFragEl.textContent = QuakeNetwork.getRole() === 'single'
        ? `BOTS (${bots.filter((b) => !b.dead).length} ALIVE)`
        : `PEER: ${remotePeer.frags}`;
    }
  }

  function flashOverlay(colorCss) {
    const overlay = document.getElementById('damage-overlay');
    if (!overlay) return;
    overlay.style.background = `radial-gradient(circle, transparent 35%, ${colorCss} 100%)`;
    overlay.style.opacity = '1';
    setTimeout(() => {
      overlay.style.opacity = '0';
    }, 140);
  }

  function showHitMarker() {
    const ch = document.getElementById('crosshair');
    if (!ch) return;
    ch.style.transform = 'translate(-50%, -50%) scale(1.45)';
    setTimeout(() => {
      ch.style.transform = 'translate(-50%, -50%) scale(1)';
    }, 100);
  }

  function showToast(msg) {
    const feed = document.getElementById('hud-killfeed');
    if (!feed) return;
    const item = document.createElement('div');
    item.className = 'bg-black/80 border-l-2 border-amber-500 px-3 py-1 text-xs font-mono-tech text-amber-200 rounded shadow transition-opacity duration-300';
    item.textContent = msg;
    feed.appendChild(item);
    while (feed.children.length > 4) {
      feed.removeChild(feed.firstChild);
    }
    setTimeout(() => {
      item.style.opacity = '0';
      setTimeout(() => item.remove(), 300);
    }, 3200);
  }

  // Pre-Game Mode Selectors
  function setDisplayMode(mode) {
    config.displayMode = mode === 'vr' ? 'vr' : 'desktop';
    const btnDesktop = document.getElementById('mode-btn-desktop');
    const btnVr = document.getElementById('mode-btn-vr');
    const badge = document.getElementById('selected-mode-summary');

    if (btnDesktop && btnVr) {
      btnDesktop.classList.toggle('active', config.displayMode === 'desktop');
      btnVr.classList.toggle('active', config.displayMode === 'vr');
    }
    if (badge) {
      badge.textContent = config.displayMode === 'vr'
        ? 'OCULUS QUEST VR MODE SELECTED (Left Thumbstick: Move | Right Thumbstick: Rotate)'
        : 'DESKTOP BROWSER MODE SELECTED (WASD: Move | Mouse: Rotate & Aim)';
    }
  }

  function setVrTurnStyle(style) {
    config.vrTurnStyle = style === 'snap' ? 'snap' : 'smooth';
  }

  // Launch Game (Host Room / Join Room / Single Player)
  async function launchMatch(role) {
    QuakeSound.ensureContext();
    QuakeSound.toggleAmbientDrone(true);

    const roomInput = document.getElementById('room-name-input');
    const micCheck = document.getElementById('mic-auto-checkbox');
    const botCheck = document.getElementById('bot-assist-checkbox');

    config.roomName = (roomInput && roomInput.value.trim()) ? roomInput.value.trim() : 'Xellossan';
    if (roomInput) roomInput.value = config.roomName;
    config.enableMic = micCheck ? micCheck.checked : true;
    config.practiceBotInP2P = botCheck ? botCheck.checked : true;

    // Reset Player & Spawn
    player.frags = 0;
    player.deaths = 0;
    player.weaponsOwned = {
      axe: true, shotgun: true, supershotgun: false, nailgun: false,
      supernailgun: false, grenadelauncher: false, rocketlauncher: false, thunderbolt: false
    };
    player.ammo = { shells: 25, nails: 0, rockets: 0, cells: 0 };
    respawnLocalPlayer();

    // Hide Lobby, Show In-Game HUD
    document.getElementById('start-screen-modal').classList.add('hidden');
    document.getElementById('ingame-hud').classList.remove('hidden');
    document.getElementById('hud-room-badge').textContent = role === 'single'
      ? 'MODE: SINGLE PLAYER ARENA'
      : `${role.toUpperCase()} ROOM: ${config.roomName}`;
    document.getElementById('hud-display-badge').textContent = config.displayMode === 'vr'
      ? 'VR (QUEST THUMBSTICKS)'
      : 'DESKTOP (WASD + MOUSE)';

    gameRunning = true;
    isPaused = false;

    // Start Bots in Single Player (or if practice bots enabled in P2P)
    if (role === 'single') {
      spawnBots(4);
    } else if (config.practiceBotInP2P) {
      spawnBots(2);
    } else {
      spawnBots(0);
    }

    // Start P2P Networking & Direct Voice Audio
    await QuakeNetwork.startSession({
      role,
      roomName: config.roomName,
      enableMic: config.enableMic,
      callbacks: {
        onStatus: (text, isOk) => {
          const netEl = document.getElementById('hud-net-status');
          if (netEl) {
            netEl.textContent = text;
            netEl.className = `text-xs font-mono-tech ${isOk ? 'text-emerald-400' : 'text-amber-300'}`;
          }
          showToast(text);
        },
        onVoiceStatus: (text, isLive) => {
          const vEl = document.getElementById('hud-voice-status');
          if (vEl) {
            vEl.textContent = text;
            vEl.className = `text-xs font-mono-tech ${isLive ? 'text-emerald-400' : 'text-amber-400'}`;
          }
        },
        onMessage: onNetworkMessage
      }
    });

    // If VR Mode was chosen before starting/joining, enter WebXR immersive-vr session (with Stereo VR fallback)
    if (config.displayMode === 'vr') {
      await enterVRSession();
    } else {
      try {
        renderer.domElement.requestPointerLock();
      } catch (e) {}
    }

    updateHUD();
  }

  async function enterVRSession() {
    if (navigator.xr && navigator.xr.isSessionSupported) {
      try {
        const supported = await navigator.xr.isSessionSupported('immersive-vr');
        if (supported) {
          const session = await navigator.xr.requestSession('immersive-vr', {
            optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking']
          });
          await renderer.xr.setSession(session);
          return;
        }
      } catch (err) {}
    }
    showToast('VR Mode Active (Quest WebXR Controller Polling + On-Screen Dual Thumbsticks Enabled)');
    const touchSticks = document.getElementById('vr-sim-thumbsticks');
    if (touchSticks) touchSticks.classList.remove('hidden');
  }

  function returnToLobby() {
    gameRunning = false;
    isPaused = false;
    QuakeNetwork.cleanup();
    if (document.pointerLockElement) {
      try { document.exitPointerLock(); } catch (e) {}
    }
    const session = renderer.xr.getSession();
    if (session) {
      session.end().catch(() => {});
    }
    document.getElementById('ingame-hud').classList.add('hidden');
    document.getElementById('pause-modal').classList.add('hidden');
    document.getElementById('codex-modal').classList.add('hidden');
    document.getElementById('start-screen-modal').classList.remove('hidden');
  }

  function togglePauseMenu() {
    isPaused = !isPaused;
    const modal = document.getElementById('pause-modal');
    if (modal) modal.classList.toggle('hidden', !isPaused);
    if (isPaused && document.pointerLockElement) {
      try { document.exitPointerLock(); } catch (e) {}
    }
  }

  function toggleCodexModal() {
    const modal = document.getElementById('codex-modal');
    if (!modal) return;
    const nextHidden = !modal.classList.contains('hidden');
    modal.classList.toggle('hidden', nextHidden);
  }

  function toggleVoiceMicUI() {
    const muted = QuakeNetwork.toggleMicMute();
    const btn = document.getElementById('btn-toggle-mic');
    if (btn) btn.textContent = muted ? 'MIC: MUTED (M)' : 'MIC: LIVE (M)';
  }

  function toggleSfxMuteUI() {
    const muted = QuakeSound.setMuted(!QuakeSound.isMuted());
    const btn = document.getElementById('btn-toggle-sfx');
    if (btn) btn.textContent = muted ? 'SFX: OFF (V)' : 'SFX: ON (V)';
  }

  // On-Screen Dual Thumbstick Simulator (for testing Quest Thumbstick locomotion on Desktop/Touch)
  function setupOnScreenThumbsticks() {
    function bindStick(padId, knobId, onMove) {
      const pad = document.getElementById(padId);
      const knob = document.getElementById(knobId);
      if (!pad || !knob) return;
      let active = false;

      function updatePos(clientX, clientY) {
        const rect = pad.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const maxR = rect.width * 0.38;
        let dx = clientX - cx;
        let dy = clientY - cy;
        const dist = Math.hypot(dx, dy);
        if (dist > maxR) {
          dx = (dx / dist) * maxR;
          dy = (dy / dist) * maxR;
        }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        onMove(dx / maxR, dy / maxR);
      }

      function reset() {
        active = false;
        knob.style.transform = 'translate(0px, 0px)';
        onMove(0, 0);
      }

      pad.addEventListener('pointerdown', (e) => {
        active = true;
        pad.setPointerCapture(e.pointerId);
        updatePos(e.clientX, e.clientY);
      });
      pad.addEventListener('pointermove', (e) => {
        if (active) updatePos(e.clientX, e.clientY);
      });
      pad.addEventListener('pointerup', reset);
      pad.addEventListener('pointercancel', reset);
    }

    bindStick('left-stick-pad', 'left-stick-knob', (nx, ny) => {
      keyState['KeyW'] = ny < -0.25;
      keyState['KeyS'] = ny > 0.25;
      keyState['KeyA'] = nx < -0.25;
      keyState['KeyD'] = nx > 0.25;
    });

    bindStick('right-stick-pad', 'right-stick-knob', (nx) => {
      keyState['ArrowLeft'] = nx < -0.25;
      keyState['ArrowRight'] = nx > 0.25;
    });
  }

  function onWindowResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function init() {
    initThree();
    setupOnScreenThumbsticks();
    setDisplayMode('desktop');
  }

  return {
    init,
    setDisplayMode,
    setVrTurnStyle,
    launchMatch,
    returnToLobby,
    selectWeapon,
    cycleWeapon,
    tryJump,
    attemptFireWeapon,
    togglePauseMenu,
    toggleCodexModal,
    toggleVoiceMicUI,
    toggleSfxMuteUI,
    spawnOrToggleBot
  };
})();

window.addEventListener('load', () => {
  QuakeGame.init();
});
