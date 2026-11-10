// EntrapBall VR — Synthesized 3D Sound Effects & WebRTC Direct Audio Chat Manager
class SoundAndVoiceManager {
  constructor() {
    this.ctx = null;
    this.sfxMuted = false;
    this.micMuted = false;
    this.localStream = null;
    this.remoteAudioEl = null;
    this.micAnalyser = null;
    this.micDataArray = null;
    this.voiceConnected = false;
    this.voiceStatusText = 'Mic Standby';
  }

  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  toggleSfxMute() {
    this.sfxMuted = !this.sfxMuted;
    return this.sfxMuted;
  }

  // Request microphone for Direct P2P Audio Chat
  async enableMicrophone() {
    this.initContext();
    if (this.localStream) {
      return this.localStream;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.updateVoiceUI('Mic API Unavailable (HTTPS required)', false);
      return null;
    }
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      if (this.ctx) {
        const source = this.ctx.createMediaStreamSource(this.localStream);
        this.micAnalyser = this.ctx.createAnalyser();
        this.micAnalyser.fftSize = 64;
        source.connect(this.micAnalyser);
        this.micDataArray = new Uint8Array(this.micAnalyser.frequencyBinCount);
      }

      this.setMicMuted(false);
      this.updateVoiceUI('Mic Ready (P2P Audio Active)', true);
      return this.localStream;
    } catch (err) {
      this.updateVoiceUI('Mic Permission Denied / No Mic', false);
      return null;
    }
  }

  setMicMuted(muted) {
    this.micMuted = muted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !this.micMuted;
      });
    }
    const btn = document.getElementById('btn-toggle-mic');
    const label = document.getElementById('mic-btn-label');
    if (btn && label) {
      label.textContent = this.micMuted ? 'Mic Muted' : 'Mic Live';
      btn.className = this.micMuted
        ? 'px-3 py-1.5 rounded-lg bg-rose-500/20 border border-rose-400/50 text-rose-200 text-xs font-semibold flex items-center gap-1.5 hover:bg-rose-500/30 transition'
        : 'px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 text-xs font-semibold flex items-center gap-1.5 hover:bg-emerald-500/30 transition';
    }
  }

  toggleMicMute() {
    if (!this.localStream) {
      this.enableMicrophone().then(stream => {
        if (stream && window.networkManager) {
          window.networkManager.attachOrCallAudioStream(stream);
        }
      });
      return false;
    }
    this.setMicMuted(!this.micMuted);
    return this.micMuted;
  }

  attachRemoteStream(remoteStream) {
    if (!this.remoteAudioEl) {
      this.remoteAudioEl = document.getElementById('remote-peer-audio');
      if (!this.remoteAudioEl) {
        this.remoteAudioEl = document.createElement('audio');
        this.remoteAudioEl.id = 'remote-peer-audio';
        this.remoteAudioEl.autoplay = true;
        this.remoteAudioEl.playsInline = true;
        document.body.appendChild(this.remoteAudioEl);
      }
    }
    this.remoteAudioEl.srcObject = remoteStream;
    this.remoteAudioEl.play().catch(() => {});
    this.voiceConnected = true;
    this.updateVoiceUI('Direct P2P Voice Connected', true);
  }

  setRemoteVolume(val) {
    if (this.remoteAudioEl) {
      this.remoteAudioEl.volume = Math.max(0, Math.min(1, parseFloat(val)));
    }
  }

  getMicLevel() {
    if (!this.micAnalyser || !this.micDataArray || this.micMuted) return 0;
    this.micAnalyser.getByteFrequencyData(this.micDataArray);
    let sum = 0;
    for (let i = 0; i < this.micDataArray.length; i++) {
      sum += this.micDataArray[i];
    }
    return Math.min(100, Math.round((sum / this.micDataArray.length / 140) * 100));
  }

  updateVoiceUI(statusText, isGood) {
    this.voiceStatusText = statusText;
    const statusEl = document.getElementById('voice-status-text');
    const dotEl = document.getElementById('voice-status-dot');
    if (statusEl) statusEl.textContent = statusText;
    if (dotEl) {
      dotEl.className = isGood
        ? 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse'
        : 'w-2 h-2 rounded-full bg-amber-400';
    }
  }

  // Procedural Web Audio API Sound Effects
  playBlockPlace() {
    if (this.sfxMuted) return;
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.09);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  playBlockRemove() {
    if (this.sfxMuted) return;
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(130, now + 0.10);
    gain.gain.setValueAtTime(0.20, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  playInvalidAction() {
    if (this.sfxMuted) return;
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.setValueAtTime(85, now + 0.05);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  playBallBounce(distance = 10) {
    if (this.sfxMuted) return;
    this.initContext();
    if (!this.ctx) return;
    const vol = Math.max(0.02, Math.min(0.28, (1 - distance / 50) * 0.28));
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(115, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.14);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  playCaptureZone() {
    if (this.sfxMuted) return;
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [330, 440, 554.37, 659.25];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.055);
      gain.gain.setValueAtTime(0.18, now + idx * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.055 + 0.22);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.055);
      osc.stop(now + idx * 0.055 + 0.24);
    });
  }

  playBallTrapped() {
    if (this.sfxMuted) return;
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const chord = [261.63, 329.63, 392.00, 523.25, 659.25];
    chord.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      gain.gain.setValueAtTime(0.22, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.38);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.40);
    });
  }

  playPlayerHit() {
    if (this.sfxMuted) return;
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.linearRampToValueAtTime(45, now + 0.35);
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.40);
  }
}

window.soundManager = new SoundAndVoiceManager();
