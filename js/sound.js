// ============================================================================
// Quake VR & Desktop Arena - Web Audio API Procedural Sound Synthesizer
// Generates authentic Quake 1 industrial weaponry, explosions, footsteps,
// Ranger jump grunts, pickups, and Quad Damage chords with zero external MP3s.
// ============================================================================

window.QuakeSound = (function () {
  let ctx = null;
  let sfxMuted = false;
  let ambientNode = null;
  let ambientGain = null;
  let ambientActive = false;

  function ensureContext() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) ctx = new AudioCtx();
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function createNoiseBuffer(durationSec) {
    const audio = ensureContext();
    if (!audio) return null;
    const sampleRate = audio.sampleRate;
    const length = Math.floor(sampleRate * durationSec);
    const buffer = audio.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  function playNoiseBurst(duration, filterFreq, filterType, gainAmount, decayPower = 2) {
    if (sfxMuted) return;
    const audio = ensureContext();
    if (!audio) return;
    const now = audio.currentTime;
    const noise = audio.createBufferSource();
    noise.buffer = createNoiseBuffer(duration);

    const filter = audio.createBiquadFilter();
    filter.type = filterType || 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, filterFreq * 0.15), now + duration);

    const gain = audio.createGain();
    gain.gain.setValueAtTime(gainAmount, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audio.destination);
    noise.start(now);
    noise.stop(now + duration);
  }

  function playTone(freqStart, freqEnd, duration, waveType, gainAmount) {
    if (sfxMuted) return;
    const audio = ensureContext();
    if (!audio) return;
    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = waveType || 'sawtooth';
    osc.frequency.setValueAtTime(freqStart, now);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(25, freqEnd), now + duration);
    }
    gain.gain.setValueAtTime(gainAmount, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  function playWeaponFire(weaponId, hasQuad) {
    if (sfxMuted) return;
    if (hasQuad) {
      // Iconic Quad Damage metallic reverb ping layered on every shot
      playTone(587.33, 880, 0.28, 'triangle', 0.22);
      playTone(293.66, 440, 0.32, 'sine', 0.18);
    }

    switch (weaponId) {
      case 'axe':
        playNoiseBurst(0.14, 900, 'bandpass', 0.28);
        playTone(190, 75, 0.12, 'triangle', 0.22);
        break;
      case 'shotgun':
        playNoiseBurst(0.26, 1400, 'lowpass', 0.48);
        playTone(150, 42, 0.22, 'sawtooth', 0.35);
        break;
      case 'supershotgun':
        playNoiseBurst(0.38, 1800, 'lowpass', 0.65);
        playTone(130, 35, 0.34, 'sawtooth', 0.48);
        setTimeout(() => playTone(260, 180, 0.09, 'square', 0.14), 240);
        break;
      case 'nailgun':
        playNoiseBurst(0.08, 2400, 'bandpass', 0.26);
        playTone(420, 140, 0.08, 'square', 0.24);
        break;
      case 'supernailgun':
        playNoiseBurst(0.11, 2800, 'bandpass', 0.38);
        playTone(520, 110, 0.1, 'sawtooth', 0.34);
        break;
      case 'grenadelauncher':
        playNoiseBurst(0.22, 850, 'lowpass', 0.42);
        playTone(185, 58, 0.24, 'triangle', 0.42);
        break;
      case 'rocketlauncher':
        playNoiseBurst(0.45, 1100, 'lowpass', 0.55);
        playTone(140, 45, 0.42, 'sawtooth', 0.44);
        break;
      case 'thunderbolt':
        playNoiseBurst(0.09, 4200, 'highpass', 0.28);
        playTone(780 + Math.random() * 320, 220, 0.08, 'sawtooth', 0.22);
        break;
    }
  }

  function playExplosion() {
    if (sfxMuted) return;
    playNoiseBurst(0.65, 650, 'lowpass', 0.72);
    playTone(95, 28, 0.58, 'sawtooth', 0.55);
  }

  function playGrenadeBounce() {
    if (sfxMuted) return;
    playTone(460, 240, 0.07, 'triangle', 0.22);
  }

  function playJump() {
    if (sfxMuted) return;
    // Classic Quake Ranger "HUH!" jump grunt
    playTone(135, 195, 0.13, 'sawtooth', 0.25);
    playNoiseBurst(0.1, 700, 'bandpass', 0.16);
  }

  function playPain() {
    if (sfxMuted) return;
    playTone(240, 95, 0.22, 'sawtooth', 0.34);
    playNoiseBurst(0.18, 1200, 'bandpass', 0.25);
  }

  function playPickup(category) {
    if (sfxMuted) return;
    if (category === 'quad' || category === 'pentagram') {
      playTone(220, 440, 0.55, 'sawtooth', 0.32);
      playTone(330, 660, 0.55, 'triangle', 0.28);
      return;
    }
    if (category === 'weapon') {
      playTone(280, 560, 0.18, 'square', 0.26);
      setTimeout(() => playTone(420, 680, 0.15, 'square', 0.22), 80);
      return;
    }
    if (category === 'armor') {
      playTone(340, 510, 0.22, 'triangle', 0.28);
      return;
    }
    playTone(520, 780, 0.14, 'sine', 0.24);
  }

  function playTeleport() {
    if (sfxMuted) return;
    playNoiseBurst(0.45, 2200, 'bandpass', 0.45);
    playTone(180, 880, 0.4, 'sawtooth', 0.32);
  }

  function toggleAmbientDrone(forceState) {
    const audio = ensureContext();
    if (!audio) return false;
    const nextState = typeof forceState === 'boolean' ? forceState : !ambientActive;
    if (nextState && !ambientNode) {
      ambientNode = audio.createOscillator();
      const osc2 = audio.createOscillator();
      const filter = audio.createBiquadFilter();
      ambientGain = audio.createGain();

      ambientNode.type = 'sawtooth';
      ambientNode.frequency.value = 55; // Dark A1 industrial drone
      osc2.type = 'triangle';
      osc2.frequency.value = 82.41; // E2 fifth

      filter.type = 'lowpass';
      filter.frequency.value = 160;
      ambientGain.gain.value = sfxMuted ? 0 : 0.07;

      ambientNode.connect(filter);
      osc2.connect(filter);
      filter.connect(ambientGain);
      ambientGain.connect(audio.destination);
      ambientNode.start();
      osc2.start();
      ambientNode._osc2 = osc2;
      ambientActive = true;
    } else if (!nextState && ambientNode) {
      try {
        ambientNode.stop();
        if (ambientNode._osc2) ambientNode._osc2.stop();
      } catch (e) {}
      ambientNode = null;
      ambientGain = null;
      ambientActive = false;
    }
    return ambientActive;
  }

  function setMuted(muted) {
    sfxMuted = !!muted;
    if (ambientGain && ctx) {
      ambientGain.gain.setValueAtTime(sfxMuted ? 0 : 0.07, ctx.currentTime);
    }
    return sfxMuted;
  }

  function isMuted() {
    return sfxMuted;
  }

  return {
    ensureContext,
    playWeaponFire,
    playExplosion,
    playGrenadeBounce,
    playJump,
    playPain,
    playPickup,
    playTeleport,
    toggleAmbientDrone,
    setMuted,
    isMuted
  };
})();
