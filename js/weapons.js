// ============================================================================
// Quake VR & Desktop Arena - Authentic Quake (1996) Arsenal & 3D Viewmodels
// Specs grounded in Valve Developer Union Quake Entity Guide & Level Design Book:
//   1. Axe (melee, 0 ammo, 20 dmg, 64u range)
//   2. Shotgun (1 Shell, 6x4 = 24 dmg, 0.5s cooldown, max 100 Shells)
//   3. Super Shotgun (2 Shells, 14x4 = 56 dmg, 0.7s cooldown)
//   4. Nailgun (1 Nail, 9 dmg, 600 rpm / 0.1s cooldown, max 200 Nails)
//   5. Super Nailgun (2 Nails, 18 dmg, 600 rpm / 0.1s cooldown)
//   6. Grenade Launcher (1 Rocket, 120 splash dmg, 0.6s cooldown, max 100 Rockets)
//   7. Rocket Launcher (1 Rocket, 110 direct/splash dmg, 0.8s cooldown)
//   8. Thunderbolt / Lightning Gun (1 Cell, 30 dmg @ 600 rpm = 300 DPS, max 100 Cells)
// ============================================================================

window.QuakeWeapons = (function () {
  const WEAPON_DEFS = [
    {
      id: 'axe',
      slot: 1,
      name: 'Axe',
      shortName: 'AXE',
      ammoType: null,
      ammoPerShot: 0,
      damage: 20,
      pellets: 1,
      spread: 0,
      cooldown: 0.42,
      range: 4.2,
      type: 'melee',
      color: 0x9ca3af,
      description: 'Standard-issue Quake melee battle axe. Zero ammo required; 20 damage per swing.'
    },
    {
      id: 'shotgun',
      slot: 2,
      name: 'Shotgun',
      shortName: 'SG',
      ammoType: 'shells',
      ammoPerShot: 1,
      damage: 4,
      pellets: 6,
      spread: 0.045,
      cooldown: 0.5,
      range: 85,
      type: 'hitscan',
      color: 0xd97706,
      description: 'Single-barreled pump shotgun. Fires 6 pellets (24 total damage) with tight mid-range spread.'
    },
    {
      id: 'supershotgun',
      slot: 3,
      name: 'Super Shotgun',
      shortName: 'SSG',
      ammoType: 'shells',
      ammoPerShot: 2,
      damage: 4,
      pellets: 14,
      spread: 0.095,
      cooldown: 0.7,
      range: 65,
      type: 'hitscan',
      color: 0xf59e0b,
      description: 'Double-barreled workhorse. Consumes 2 Shells to unleash 14 buckshot pellets (56 damage).'
    },
    {
      id: 'nailgun',
      slot: 4,
      name: 'Nailgun',
      shortName: 'NG',
      ammoType: 'nails',
      ammoPerShot: 1,
      damage: 9,
      pellets: 1,
      spread: 0.015,
      cooldown: 0.1,
      projectileSpeed: 46,
      type: 'projectile_nail',
      color: 0x60a5fa,
      description: 'Dual-barrel oscillating flechette gun firing high-velocity steel nails at 600 RPM (9 dmg/nail).'
    },
    {
      id: 'supernailgun',
      slot: 5,
      name: 'Super Nailgun',
      shortName: 'SNG',
      ammoType: 'nails',
      ammoPerShot: 2,
      damage: 18,
      pellets: 1,
      spread: 0.01,
      cooldown: 0.1,
      projectileSpeed: 52,
      type: 'projectile_nail',
      color: 0x3b82f6,
      description: 'Rotary four-barrel Perforator. Consumes 2 Nails per shot for 18 damage at 600 RPM.'
    },
    {
      id: 'grenadelauncher',
      slot: 6,
      name: 'Grenade Launcher',
      shortName: 'GL',
      ammoType: 'rockets',
      ammoPerShot: 1,
      damage: 120,
      splashRadius: 6.5,
      cooldown: 0.6,
      projectileSpeed: 24,
      type: 'projectile_grenade',
      color: 0x22c55e,
      description: 'Launches bouncing Pineapple grenades that detonate on enemy contact or 2.5s fuse (~120 damage).'
    },
    {
      id: 'rocketlauncher',
      slot: 7,
      name: 'Rocket Launcher',
      shortName: 'RL',
      ammoType: 'rockets',
      ammoPerShot: 1,
      damage: 110,
      splashRadius: 7.0,
      cooldown: 0.8,
      projectileSpeed: 38,
      type: 'projectile_rocket',
      color: 0xef4444,
      description: 'Heavy-ordnance launcher delivering ~110 direct/splash damage and rocket-jump knockback.'
    },
    {
      id: 'thunderbolt',
      slot: 8,
      name: 'Thunderbolt',
      shortName: 'LG',
      ammoType: 'cells',
      ammoPerShot: 1,
      damage: 30,
      pellets: 1,
      spread: 0,
      cooldown: 0.1,
      range: 34,
      type: 'beam',
      color: 0x38bdf8,
      description: 'Direct-discharge Lightning Gun consuming Cells at 600 RPM for 30 damage per cell (300 DPS).'
    }
  ];

  const AMMO_LIMITS = {
    shells: 100,
    nails: 200,
    rockets: 100,
    cells: 100
  };

  function getWeaponById(id) {
    return WEAPON_DEFS.find((w) => w.id === id) || WEAPON_DEFS[1];
  }

  function getWeaponBySlot(slotNum) {
    return WEAPON_DEFS.find((w) => w.slot === slotNum) || null;
  }

  // Builds a distinctive 3D mesh for each Quake weapon (used for both first-person viewmodel & arena pickups)
  function buildWeaponMesh(weaponId) {
    const group = new THREE.Group();
    const darkMetal = new THREE.MeshStandardMaterial({ color: 0x2b2d2f, roughness: 0.45, metalness: 0.75 });
    const bronzeMat = new THREE.MeshStandardMaterial({ color: 0x925629, roughness: 0.5, metalness: 0.6 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c3419, roughness: 0.8, metalness: 0.1 });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

    if (weaponId === 'axe') {
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.55, 8), woodMat);
      handle.rotation.x = Math.PI * 0.35;
      group.add(handle);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.18), darkMetal);
      blade.position.set(0, 0.15, -0.2);
      group.add(blade);
    } else if (weaponId === 'shotgun') {
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.085, 0.36), woodMat);
      stock.position.set(0, -0.02, 0.06);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.52, 10), darkMetal);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.02, -0.18);
      group.add(stock, barrel);
    } else if (weaponId === 'supershotgun') {
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.34), woodMat);
      stock.position.set(0, -0.02, 0.06);
      const barrelL = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.5, 10), bronzeMat);
      barrelL.rotation.x = Math.PI / 2;
      barrelL.position.set(-0.028, 0.025, -0.18);
      const barrelR = barrelL.clone();
      barrelR.position.x = 0.028;
      group.add(stock, barrelL, barrelR);
    } else if (weaponId === 'nailgun') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.36), darkMetal);
      const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.44, 8), bronzeMat);
      b1.rotation.x = Math.PI / 2;
      b1.position.set(-0.03, 0.01, -0.22);
      const b2 = b1.clone();
      b2.position.x = 0.03;
      group.add(body, b1, b2);
    } else if (weaponId === 'supernailgun') {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.075, 0.38, 12), bronzeMat);
      body.rotation.x = Math.PI / 2;
      const rotor = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.46, 8), darkMetal);
        b.rotation.x = Math.PI / 2;
        b.position.set(Math.cos(a) * 0.032, Math.sin(a) * 0.032, -0.22);
        rotor.add(b);
      }
      group.add(body, rotor);
    } else if (weaponId === 'grenadelauncher') {
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.34), woodMat);
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.16, 12), bronzeMat);
      drum.rotation.x = Math.PI / 2;
      drum.position.set(0, -0.01, -0.08);
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.38, 12), darkMetal);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(0, 0.02, -0.24);
      group.add(stock, drum, pipe);
    } else if (weaponId === 'rocketlauncher') {
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.062, 0.68, 12), bronzeMat);
      tube.rotation.x = Math.PI / 2;
      tube.position.set(0, 0.02, -0.18);
      const fins = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.22), darkMetal);
      fins.position.set(0, 0.02, -0.05);
      group.add(tube, fins);
    } else if (weaponId === 'thunderbolt') {
      const core = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.44), darkMetal);
      const coil1 = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.012, 8, 16), glowMat);
      coil1.position.set(0, 0.02, -0.18);
      const coil2 = coil1.clone();
      coil2.position.z = -0.3;
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.52, 8), glowMat);
      rod.rotation.x = Math.PI / 2;
      rod.position.set(0, 0.02, -0.22);
      group.add(core, coil1, coil2, rod);
    }

    return group;
  }

  return {
    WEAPON_DEFS,
    AMMO_LIMITS,
    getWeaponById,
    getWeaponBySlot,
    buildWeaponMesh
  };
})();
