import { Peer } from 'peerjs';
import type { DataConnection } from 'peerjs';
import type { NetworkMessage, NetworkUserProfile } from '../types';

export type NetworkRole = 'host' | 'guest' | 'none';
export type ConnectionStatus = 'disconnected' | 'creating' | 'waiting' | 'joining' | 'connected';

export class LanNetworkManager {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private role: NetworkRole = 'none';
  private status: ConnectionStatus = 'disconnected';
  private roomCode: string = '';
  private myProfile: NetworkUserProfile | null = null;
  private peerProfile: NetworkUserProfile | null = null;

  private pingTimer: number | null = null;
  private lastPongTime: number = 0;

  // Callbacks
  public onStatusChange?: (status: ConnectionStatus, message?: string) => void;
  public onPeerConnected?: (peerProfile: NetworkUserProfile) => void;
  public onPeerDisconnected?: (reason: string) => void;
  public onMessageReceived?: (msg: NetworkMessage) => void;
  public onErrorOccurred?: (errText: string) => void;

  constructor() {}

  public getRole(): NetworkRole {
    return this.role;
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public getRoomCode(): string {
    return this.roomCode;
  }

  public getPeerProfile(): NetworkUserProfile | null {
    return this.peerProfile;
  }

  public isHost(): boolean {
    return this.role === 'host';
  }

  public isConnected(): boolean {
    return this.status === 'connected' && this.conn !== null && this.conn.open;
  }

  private setStatus(newStatus: ConnectionStatus, msg?: string) {
    this.status = newStatus;
    if (this.onStatusChange) {
      this.onStatusChange(newStatus, msg);
    }
  }

  /**
   * Host creates a room with a 4-digit code.
   */
  public async createRoom(profile: NetworkUserProfile): Promise<string> {
    this.disconnect();
    this.role = 'host';
    this.myProfile = profile;
    this.setStatus('creating', '正在注册局域网对决房间...');

    // Generate 4-digit room code (1000 - 9999)
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    this.roomCode = code;
    const fullPeerId = `spectro-lan-${code}`;

    return new Promise((resolve, reject) => {
      let resolved = false;

      try {
        this.peer = new Peer(fullPeerId, {
          debug: 1,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
            ],
          },
        });

        this.peer.on('open', () => {
          this.setStatus('waiting', `房间已创建 [${this.roomCode}]，等待对手加入...`);
          if (!resolved) {
            resolved = true;
            resolve(this.roomCode);
          }
        });

        this.peer.on('connection', (connection) => {
          // If already connected, close extra connections
          if (this.conn && this.conn.open) {
            connection.close();
            return;
          }
          this.conn = connection;
          this.setupConnectionEvents(connection);
        });

        this.peer.on('error', (err) => {
          console.error('[LanNetworkManager] Host peer error:', err);
          const errMsg = err.type === 'unavailable-id'
            ? '房间号已被占用，请重试'
            : (err.message || '网络连接失败');
          if (this.onErrorOccurred) this.onErrorOccurred(errMsg);
          if (!resolved) {
            resolved = true;
            reject(new Error(errMsg));
          }
          this.disconnect();
        });

      } catch (err: any) {
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      }
    });
  }

  /**
   * Guest joins an existing room with a 4-digit code.
   */
  public async joinRoom(code: string, profile: NetworkUserProfile): Promise<void> {
    this.disconnect();
    this.role = 'guest';
    this.myProfile = profile;
    this.roomCode = code.trim();
    this.setStatus('joining', `正在连接房间 [${this.roomCode}]...`);

    const targetPeerId = `spectro-lan-${this.roomCode}`;

    return new Promise((resolve, reject) => {
      let resolved = false;
      const timeoutId = window.setTimeout(() => {
        if (!resolved) {
          resolved = true;
          const msg = '连接超时，请确认房间码是否正确或房主是否在线';
          if (this.onErrorOccurred) this.onErrorOccurred(msg);
          this.disconnect();
          reject(new Error(msg));
        }
      }, 10000);

      try {
        this.peer = new Peer({
          debug: 1,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
            ],
          },
        });

        this.peer.on('open', () => {
          if (!this.peer) return;
          const connection = this.peer.connect(targetPeerId, {
            reliable: true,
          });
          this.conn = connection;
          this.setupConnectionEvents(connection);

          connection.on('open', () => {
            window.clearTimeout(timeoutId);
            if (!resolved) {
              resolved = true;
              resolve();
            }
          });
        });

        this.peer.on('error', (err) => {
          console.error('[LanNetworkManager] Guest peer error:', err);
          window.clearTimeout(timeoutId);
          const errMsg = err.type === 'peer-unavailable'
            ? '房间不存在或房主已离开'
            : (err.message || '网络连接失败');
          if (this.onErrorOccurred) this.onErrorOccurred(errMsg);
          if (!resolved) {
            resolved = true;
            reject(new Error(errMsg));
          }
          this.disconnect();
        });

      } catch (err: any) {
        window.clearTimeout(timeoutId);
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      }
    });
  }

  private setupConnectionEvents(connection: DataConnection) {
    connection.on('open', () => {
      this.setStatus('connected', '局域网 P2P 通道已建立');
      this.startHeartbeat();

      // Handshake: send own profile
      if (this.myProfile) {
        this.sendMessage({
          type: this.role === 'host' ? 'ROOM_ACCEPT' : 'ROOM_JOIN',
          payload: this.myProfile,
        });
      }
    });

    connection.on('data', (data: any) => {
      this.handleIncomingData(data);
    });

    connection.on('close', () => {
      console.log('[LanNetworkManager] Connection closed by peer');
      this.stopHeartbeat();
      this.setStatus('disconnected', '对手已断开连接');
      if (this.onPeerDisconnected) {
        this.onPeerDisconnected('对手已退出或网络中断');
      }
    });

    connection.on('error', (err) => {
      console.error('[LanNetworkManager] Connection error:', err);
      if (this.onErrorOccurred) {
        this.onErrorOccurred(err.message || '数据通道异常');
      }
    });
  }

  private handleIncomingData(data: any) {
    if (!data || typeof data !== 'object') return;
    const msg = data as NetworkMessage;

    // Internal system messages
    if (msg.type === 'PING') {
      this.sendMessage({ type: 'PONG' });
      return;
    }
    if (msg.type === 'PONG') {
      this.lastPongTime = Date.now();
      return;
    }

    if (msg.type === 'ROOM_JOIN' || msg.type === 'ROOM_ACCEPT') {
      this.peerProfile = msg.payload as NetworkUserProfile;
      if (this.role === 'host' && msg.type === 'ROOM_JOIN' && this.myProfile) {
        // Host replies with acceptance and its profile
        this.sendMessage({
          type: 'ROOM_ACCEPT',
          payload: this.myProfile,
        });
      }
      if (this.onPeerConnected && this.peerProfile) {
        this.onPeerConnected(this.peerProfile);
      }
      return;
    }

    // Forward game messages to listener
    if (this.onMessageReceived) {
      this.onMessageReceived(msg);
    }
  }

  public sendMessage(msg: NetworkMessage) {
    if (this.conn && this.conn.open) {
      try {
        this.conn.send(msg);
      } catch (err) {
        console.error('[LanNetworkManager] Send error:', err);
      }
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.lastPongTime = Date.now();
    this.pingTimer = window.setInterval(() => {
      if (this.isConnected()) {
        this.sendMessage({ type: 'PING' });
        if (Date.now() - this.lastPongTime > 15000) {
          console.warn('[LanNetworkManager] Heartbeat timeout');
          if (this.onPeerDisconnected) {
            this.onPeerDisconnected('网络延迟过高或连接中断');
          }
          this.disconnect();
        }
      }
    }, 4000);
  }

  private stopHeartbeat() {
    if (this.pingTimer !== null) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  public disconnect() {
    this.stopHeartbeat();
    if (this.conn) {
      try {
        this.conn.close();
      } catch (e) {}
      this.conn = null;
    }
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch (e) {}
      this.peer = null;
    }
    this.role = 'none';
    this.roomCode = '';
    this.peerProfile = null;
    this.setStatus('disconnected', '已断开连接');
  }
}

export const lanNetwork = new LanNetworkManager();
