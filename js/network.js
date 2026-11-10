// EntrapBall VR — Peer-to-Peer Multiplayer & Direct Voice Chat Networking (PeerJS + WebRTC)
class P2PNetworkManager {
  constructor() {
    this.peer = null;
    this.conn = null;
    this.mediaCall = null;
    this.role = 'single'; // 'single' | 'host' | 'client'
    this.roomName = window.GAME_CONFIG.DEFAULT_ROOM_NAME;
    this.isConnected = false;
    this.remotePeerId = null;
    this.onMessageCallback = null;
    this.onStatusChangeCallback = null;
  }

  sanitizeRoomName(rawName) {
    const clean = (rawName || window.GAME_CONFIG.DEFAULT_ROOM_NAME)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-');
    return clean || 'xellossan';
  }

  getHostPeerId(roomName) {
    return window.GAME_CONFIG.PEER_PREFIX + this.sanitizeRoomName(roomName) + '-host';
  }

  updateStatus(text, connected = false) {
    this.isConnected = connected;
    const badge = document.getElementById('hud-net-status');
    const lobbyStatus = document.getElementById('lobby-net-status');
    if (badge) {
      badge.textContent = text;
      badge.className = connected
        ? 'px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
        : 'px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/20 text-sky-300 border border-sky-400/40';
    }
    if (lobbyStatus) {
      lobbyStatus.textContent = text;
    }
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback(text, connected);
    }
  }

  disconnect() {
    if (this.mediaCall) {
      try { this.mediaCall.close(); } catch (e) {}
      this.mediaCall = null;
    }
    if (this.conn) {
      try { this.conn.close(); } catch (e) {}
      this.conn = null;
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch (e) {}
      this.peer = null;
    }
    this.isConnected = false;
  }

  // Host a 2-player P2P Room (Default: Xellossan)
  async hostRoom(roomName, onMessage) {
    this.disconnect();
    this.role = 'host';
    this.roomName = roomName || window.GAME_CONFIG.DEFAULT_ROOM_NAME;
    this.onMessageCallback = onMessage;

    const hostPeerId = this.getHostPeerId(this.roomName);
    this.updateStatus(`Hosting Room "${this.roomName}" — Waiting for P2...`, false);

    // Request mic stream for direct voice chat
    const localStream = await window.soundManager.enableMicrophone();

    if (typeof Peer === 'undefined') {
      this.updateStatus(`Room "${this.roomName}" Active (Local/Offline Mode)`, false);
      return;
    }

    try {
      this.peer = new Peer(hostPeerId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });

      this.peer.on('open', (id) => {
        this.updateStatus(`Hosting "${this.roomName}" (Waiting for Partner)`, false);
      });

      this.peer.on('connection', (connection) => {
        this.conn = connection;
        this.remotePeerId = connection.peer;
        this.setupDataConnection(connection);
        // Also initiate voice call if we have a local audio stream
        if (localStream) {
          this.callRemoteAudio(connection.peer, localStream);
        }
      });

      this.peer.on('call', (call) => {
        this.mediaCall = call;
        call.answer(localStream || undefined);
        call.on('stream', (remoteStream) => {
          window.soundManager.attachRemoteStream(remoteStream);
        });
      });

      this.peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
          this.updateStatus(`Room "${this.roomName}" already hosted! Click Join Room instead.`, false);
        } else {
          this.updateStatus(`P2P Standby (${err.type || 'Ready'})`, false);
        }
      });
    } catch (e) {
      this.updateStatus(`Host Active ("${this.roomName}")`, false);
    }
  }

  // Join an existing 2-player P2P Room (Default: Xellossan)
  async joinRoom(roomName, onMessage) {
    this.disconnect();
    this.role = 'client';
    this.roomName = roomName || window.GAME_CONFIG.DEFAULT_ROOM_NAME;
    this.onMessageCallback = onMessage;

    const hostPeerId = this.getHostPeerId(this.roomName);
    this.updateStatus(`Joining Room "${this.roomName}"...`, false);

    const localStream = await window.soundManager.enableMicrophone();

    if (typeof Peer === 'undefined') {
      this.updateStatus(`PeerJS CDN Offline — Playing Local Arena`, false);
      return;
    }

    try {
      const clientRandomId = window.GAME_CONFIG.PEER_PREFIX + this.sanitizeRoomName(this.roomName) + '-p2-' + Math.floor(1000 + Math.random() * 9000);
      this.peer = new Peer(clientRandomId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });

      this.peer.on('open', () => {
        const connection = this.peer.connect(hostPeerId, { reliable: true });
        this.conn = connection;
        this.remotePeerId = hostPeerId;
        this.setupDataConnection(connection);

        if (localStream) {
          this.callRemoteAudio(hostPeerId, localStream);
        }
      });

      this.peer.on('call', (call) => {
        this.mediaCall = call;
        call.answer(localStream || undefined);
        call.on('stream', (remoteStream) => {
          window.soundManager.attachRemoteStream(remoteStream);
        });
      });

      this.peer.on('error', (err) => {
        this.updateStatus(`Room "${this.roomName}" Host Not Found Yet — Retrying / Co-Op Ready`, false);
      });
    } catch (e) {
      this.updateStatus(`Client Active ("${this.roomName}")`, false);
    }
  }

  setupDataConnection(connection) {
    connection.on('open', () => {
      this.updateStatus(`Connected: Room "${this.roomName}" (2P Co-Op Live)`, true);
      this.send({ type: 'HELLO', role: this.role, room: this.roomName });
    });

    connection.on('data', (data) => {
      if (this.onMessageCallback) {
        this.onMessageCallback(data);
      }
    });

    connection.on('close', () => {
      this.updateStatus(`Partner Disconnected ("${this.roomName}")`, false);
    });
  }

  callRemoteAudio(targetPeerId, stream) {
    if (!this.peer || !stream || !targetPeerId) return;
    try {
      const call = this.peer.call(targetPeerId, stream);
      if (call) {
        this.mediaCall = call;
        call.on('stream', (remoteStream) => {
          window.soundManager.attachRemoteStream(remoteStream);
        });
      }
    } catch (e) {}
  }

  attachOrCallAudioStream(stream) {
    if (this.remotePeerId && stream) {
      this.callRemoteAudio(this.remotePeerId, stream);
    }
  }

  send(payload) {
    if (this.conn && this.conn.open) {
      try {
        this.conn.send(payload);
      } catch (e) {}
    }
  }
}

window.networkManager = new P2PNetworkManager();
