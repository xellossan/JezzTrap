// ============================================================================
// Quake VR & Desktop Arena - Gothic Slipgate Level, Pickups & Monster/Bot AI
// Builds an authentic multi-tiered Quake deathmatch arena ("The Slipgate Crucible")
// with platforms, ramps, bridge over molten lava, teleporters, all 8 weapons,
// armor/health/ammo/Quad Damage pickups, and Single-Player Quake monsters.
// ============================================================================

window.QuakeArena = (function () {
  function buildLevel(scene) {
    const colliders = []; // AABB boxes { minX, maxX, minY, maxY, minZ, maxZ, isLava, isTeleporter, target }
    const pickups = [];
    const teleporters = [];
    const animatedMeshes = [];

    const brickMat = new THREE.MeshStandardMaterial({
      map: QuakeTextures.getGothicBrick(8, 3),
      roughness: 0.85,
      metalness: 0.15
    });
    const floorMat = new THREE.MeshStandardMaterial({
      map: QuakeTextures.getRunicFloor(14, 14),
      roughness: 0.8,
      metalness: 0.2
    });
    const metalMat = new THREE.MeshStandardMaterial({
      map: QuakeTextures.getRivetedMetal(2, 2),
      roughness: 0.55,
      metalness: 0.65
    });
    const lavaTex = QuakeTextures.getLavaTexture();
    const lavaMat = new THREE.MeshBasicMaterial({ map: lavaTex });
    const slipgateTex = QuakeTextures.getSlipgateTexture();
    const slipgateMat = new THREE.MeshBasicMaterial({ map: slipgateTex, side: THREE.DoubleSide });

    function addBox(x, y, z, w, h, d, mat, opts = {}) {
      const geom = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = !opts.noShadow;
      mesh.receiveShadow = true;
      scene.add(mesh);

      if (!opts.noCollide) {
        colliders.push({
          minX: x - w / 2,
          maxX: x + w / 2,
          minY: y - h / 2,
          maxY: y + h / 2,
          minZ: z - d / 2,
          maxZ: z + d / 2,
          isLava: !!opts.isLava
        });
      }
      return mesh;
    }

    // 1. Main Ground Floor (56m x 56m) & Ceiling Sky Vault
    addBox(0, -0.5, 0, 56, 1, 56, floorMat);
    // High Gothic Vaulted Ceiling beams
    addBox(0, 14.5, 0, 56, 1, 56, brickMat);

    // 2. Outer Perimeter Fortress Walls
    addBox(0, 7, -28, 56, 14, 1.5, brickMat);
    addBox(0, 7, 28, 56, 14, 1.5, brickMat);
    addBox(-28, 7, 0, 1.5, 14, 56, brickMat);
    addBox(28, 7, 0, 1.5, 14, 56, brickMat);

    // 3. Central Molten Lava Trench & Elevated Catwalk Bridge (DM4 / E1M1 homage)
    const lavaMesh = addBox(0, 0.06, 0, 14, 0.15, 14, lavaMat, { noCollide: true, noShadow: true });
    animatedMeshes.push({ type: 'lava', tex: lavaTex, mesh: lavaMesh });
    // Lava hazard zone
    colliders.push({ minX: -6.8, maxX: 6.8, minY: -0.2, maxY: 0.45, minZ: -6.8, maxZ: 6.8, isLava: true });

    // Bronze Bridge spanning North-South across the Lava Pit
    addBox(0, 0.55, 0, 4.2, 0.4, 15.2, metalMat);

    // 4. Four Gothic Corner Bastions & Elevated Sniper Decks (Height = 2.6m)
    // North-West Deck
    addBox(-16, 1.3, -16, 12, 2.6, 12, brickMat);
    // North-East Deck
    addBox(16, 1.3, -16, 12, 2.6, 12, brickMat);
    // South-West Deck
    addBox(-16, 1.3, 16, 12, 2.6, 12, brickMat);
    // South-East Deck
    addBox(16, 1.3, 16, 12, 2.6, 12, brickMat);

    // Connecting Upper Catwalks (East and West high galleries at Y = 2.4m)
    addBox(-18, 2.4, 0, 5, 0.4, 20, metalMat);
    addBox(18, 2.4, 0, 5, 0.4, 20, metalMat);

    // Stepped Ramps leading up to the Corner Decks (walkable without jumping!)
    const steps = 6;
    for (let s = 0; s < steps; s++) {
      const h = (s + 1) * (2.6 / steps);
      // North-West stairs (approaching from East)
      addBox(-9.5 + (steps - s) * 0.65, h / 2, -16, 0.7, h, 4.2, metalMat);
      // South-East stairs (approaching from West)
      addBox(9.5 - (steps - s) * 0.65, h / 2, 16, 0.7, h, 4.2, metalMat);
      // South-West stairs (approaching from North)
      addBox(-16, h / 2, 9.5 - (steps - s) * 0.65, 4.2, h, 0.7, metalMat);
      // North-East stairs (approaching from South)
      addBox(16, h / 2, -9.5 + (steps - s) * 0.65, 4.2, h, 0.7, metalMat);
    }

    // 5. Gothic Pillars & Cover Columns with Torch Point Lights
    const pillarCoords = [
      [-8, -8], [8, -8], [-8, 8], [8, 8],
      [-18, -8], [18, -8], [-18, 8], [18, 8],
      [0, -18], [0, 18]
    ];
    pillarCoords.forEach(([px, pz], idx) => {
      addBox(px, 6.5, pz, 2.2, 13, 2.2, brickMat);
      // Torch sconce
      const sconce = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.6, 0.4),
        new THREE.MeshBasicMaterial({ color: 0xf59e0b })
      );
      sconce.position.set(px, 3.8, pz + (pz < 0 ? 1.25 : -1.25));
      scene.add(sconce);
      if (idx % 2 === 0) {
        const light = new THREE.PointLight(0xff7b29, 1.35, 22, 1.6);
        light.position.set(px, 4.2, pz + (pz < 0 ? 1.6 : -1.6));
        scene.add(light);
      }
    });

    // Central Lava Glow Light
    const lavaLight = new THREE.PointLight(0xff3b1f, 2.2, 28, 1.4);
    lavaLight.position.set(0, 2.8, 0);
    scene.add(lavaLight);

    // 6. Two Slipgate Teleporters (North & South alcoves)
    function createSlipgate(x, y, z, destX, destY, destZ, destYaw) {
      addBox(x, y + 0.15, z, 3.2, 0.3, 3.2, metalMat);
      const portal = new THREE.Mesh(new THREE.CircleGeometry(1.25, 24), slipgateMat);
      portal.position.set(x, y + 1.6, z);
      scene.add(portal);
      animatedMeshes.push({ type: 'portal', mesh: portal });
      teleporters.push({
        x, y: y + 1.2, z, radius: 1.4,
        destX, destY, destZ, destYaw
      });
    }

    // North Slipgate teleports player onto the high East Gallery
    createSlipgate(0, 0, -24.5, 18, 3.2, 0, Math.PI / 2);
    // South Slipgate teleports player onto the high West Gallery
    createSlipgate(0, 0, 24.5, -18, 3.2, 0, -Math.PI / 2);

    // 7. Pickups: All 6 Pickup Weapons + Health + Armor + Ammo + Quad Damage
    const pickupDefinitions = [
      // Weapons
      { type: 'weapon', id: 'supershotgun', name: 'Super Shotgun', x: 0, y: 1.2, z: -11, respawn: 15 },
      { type: 'weapon', id: 'nailgun', name: 'Nailgun', x: -11, y: 0.7, z: 0, respawn: 15 },
      { type: 'weapon', id: 'supernailgun', name: 'Super Nailgun', x: -16, y: 3.3, z: -16, respawn: 20 },
      { type: 'weapon', id: 'grenadelauncher', name: 'Grenade Launcher', x: 16, y: 3.3, z: -16, respawn: 20 },
      { type: 'weapon', id: 'rocketlauncher', name: 'Rocket Launcher', x: -16, y: 3.3, z: 16, respawn: 25 },
      { type: 'weapon', id: 'thunderbolt', name: 'Thunderbolt', x: 16, y: 3.3, z: 16, respawn: 25 },

      // Armor (Quake 1 Green 100/30%, Yellow 150/60%, Red 200/80% - 20s respawn)
      { type: 'armor', id: 'green_armor', name: 'Green Armor (100 AP / 30%)', armorValue: 100, armorType: 0.3, color: 0x22c55e, x: 11, y: 0.7, z: 0, respawn: 20 },
      { type: 'armor', id: 'yellow_armor', name: 'Yellow Armor (150 AP / 60%)', armorValue: 150, armorType: 0.6, color: 0xeab308, x: -18, y: 3.3, z: 0, respawn: 20 },
      { type: 'armor', id: 'red_armor', name: 'Red Armor (200 AP / 80%)', armorValue: 200, armorType: 0.8, color: 0xef4444, x: 18, y: 3.3, z: 0, respawn: 20 },

      // Health (Rotten +15, Medkit +25, Megahealth +100 up to 250)
      { type: 'health', id: 'medkit_1', name: 'Medkit (+25 HP)', amount: 25, max: 100, x: -6, y: 0.6, z: -14, respawn: 20 },
      { type: 'health', id: 'medkit_2', name: 'Medkit (+25 HP)', amount: 25, max: 100, x: 6, y: 0.6, z: 14, respawn: 20 },
      { type: 'health', id: 'rotten_hp', name: 'Rotten Health (+15 HP)', amount: 15, max: 100, x: -14, y: 0.6, z: 6, respawn: 18 },
      { type: 'health', id: 'megahealth', name: 'Megahealth (+100 HP)', amount: 100, max: 250, isMega: true, x: 0, y: 1.35, z: 11, respawn: 35 },

      // Ammo Boxes (Small & Large Shells, Nails, Rockets, Cells)
      { type: 'ammo', id: 'shells_lg', name: 'Large Shells (+40)', ammoType: 'shells', amount: 40, x: -5, y: 0.6, z: 14, respawn: 15 },
      { type: 'ammo', id: 'nails_lg', name: 'Large Nails (+50)', ammoType: 'nails', amount: 50, x: 5, y: 0.6, z: -14, respawn: 15 },
      { type: 'ammo', id: 'rockets_lg', name: 'Large Rockets (+10)', ammoType: 'rockets', amount: 10, x: -22, y: 0.6, z: -6, respawn: 18 },
      { type: 'ammo', id: 'cells_lg', name: 'Large Cells (+12)', ammoType: 'cells', amount: 12, x: 22, y: 0.6, z: 6, respawn: 18 },

      // Powerups: Quad Damage (Bridge Center) & Pentagram of Protection
      { type: 'powerup', id: 'quad_damage', name: 'Quad Damage (4x Damage)', powerup: 'quad', duration: 30, x: 0, y: 1.5, z: 0, respawn: 60 },
      { type: 'powerup', id: 'pentagram', name: 'Pentagram of Protection', powerup: 'pentagram', duration: 30, x: 0, y: 0.8, z: -19, respawn: 60 }
    ];

    pickupDefinitions.forEach((def, index) => {
      const group = new THREE.Group();
      group.position.set(def.x, def.y, def.z);

      if (def.type === 'weapon') {
        const wMesh = QuakeWeapons.buildWeaponMesh(def.id);
        wMesh.scale.set(1.65, 1.65, 1.65);
        group.add(wMesh);
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.45, 0.58, 20),
          new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = -0.35;
        group.add(ring);
      } else if (def.type === 'armor') {
        const vest = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.48, 1),
          new THREE.MeshStandardMaterial({ color: def.color, emissive: def.color, emissiveIntensity: 0.35, metalness: 0.7, roughness: 0.25 })
        );
        group.add(vest);
      } else if (def.type === 'health') {
        const boxColor = def.isMega ? '#1d4ed8' : '#e5e7eb';
        const label = def.isMega ? '+100' : `+${def.amount}`;
        const mat = new THREE.MeshStandardMaterial({
          map: QuakeTextures.getAmmoCrateTexture(boxColor, label),
          roughness: 0.4
        });
        group.add(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.55), mat));
      } else if (def.type === 'ammo') {
        const colorMap = { shells: '#92400e', nails: '#1e3a8a', rockets: '#3f6212', cells: '#0e7490' };
        const labelMap = { shells: 'SHL', nails: 'NAIL', rockets: 'RCK', cells: 'CELL' };
        const mat = new THREE.MeshStandardMaterial({
          map: QuakeTextures.getAmmoCrateTexture(colorMap[def.ammoType], labelMap[def.ammoType]),
          roughness: 0.5
        });
        group.add(new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.42, 0.56), mat));
      } else if (def.type === 'powerup') {
        const col = def.powerup === 'quad' ? 0x38bdf8 : 0xef4444;
        const orb = new THREE.Mesh(
          new THREE.TorusKnotGeometry(0.36, 0.11, 48, 12),
          new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.7, metalness: 0.8, roughness: 0.15 })
        );
        group.add(orb);
      }

      scene.add(group);
      pickups.push({
        ...def,
        index,
        mesh: group,
        baseY: def.y,
        active: true,
        respawnTimer: 0
      });
    });

    const spawnPoints = [
      { x: -20, y: 0.1, z: -2, yaw: -Math.PI / 2 },
      { x: 20, y: 0.1, z: 2, yaw: Math.PI / 2 },
      { x: -16, y: 2.7, z: -16, yaw: -Math.PI * 0.75 },
      { x: 16, y: 2.7, z: 16, yaw: Math.PI * 0.25 },
      { x: 0, y: 0.1, z: -15, yaw: Math.PI },
      { x: 0, y: 0.1, z: 15, yaw: 0 }
    ];

    return {
      colliders,
      pickups,
      teleporters,
      animatedMeshes,
      spawnPoints
    };
  }

  // Creates a 3D Quake Ranger / Monster Avatar Mesh (used for Remote Peer & AI Monsters)
  function createCharacterAvatar(opts = {}) {
    const group = new THREE.Group();
    const armorColor = opts.color || 0xb45309;
    const visorColor = opts.visorColor || 0xef4444;
    const scale = opts.scale || 1.0;

    const armorMat = new THREE.MeshStandardMaterial({ color: armorColor, roughness: 0.45, metalness: 0.55 });
    const limbMat = new THREE.MeshStandardMaterial({ color: 0x3f2e21, roughness: 0.75 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xd6b496, roughness: 0.6 });
    const visorMat = new THREE.MeshBasicMaterial({ color: visorColor });

    // Legs
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.75, 0.24), limbMat);
    legL.position.set(-0.16, 0.375, 0);
    const legR = legL.clone();
    legR.position.x = 0.16;

    // Torso (Quake Ranger bulky chestplate)
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.74, 0.38), armorMat);
    torso.position.set(0, 1.1, 0);

    // Shoulder pads
    const padL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.42), armorMat);
    padL.position.set(-0.42, 1.34, 0);
    const padR = padL.clone();
    padR.position.x = 0.42;

    // Head & Visor
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), headMat);
    head.position.set(0, 1.68, 0);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.06), visorMat);
    visor.position.set(0, 1.7, -0.18);

    // Held Weapon
    const gun = QuakeWeapons.buildWeaponMesh(opts.weaponId || 'rocketlauncher');
    gun.position.set(0.36, 1.12, -0.28);

    group.add(legL, legR, torso, padL, padR, head, visor, gun);
    group.scale.set(scale, scale, scale);
    group.userData = { legL, legR, torso, head, gun };
    return group;
  }

  return {
    buildLevel,
    createCharacterAvatar
  };
})();
