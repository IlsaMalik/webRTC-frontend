import { Client } from './client';
import { SessionClient, ConnectionState, SessionStats, QualityProfile } from '../../core/types';

export class NekoClient implements SessionClient {
  private client: Client | null = null;
  private videoCallbacks: Array<(stream: MediaStream) => void> = [];
  private stateCallbacks: Array<(state: ConnectionState, err?: any) => void> = [];
  private statsCallbacks: Array<(stats: SessionStats) => void> = [];
  private statsInterval: any = null;

  async connect(params: {
    baseUrl: string;
    wsPath?: string;
    username?: string;
    password?: string;
    backend: 'neko';
  }): Promise<void> {
    const wsPath = params.wsPath || '/api/ws';
    const url = `ws://${params.baseUrl}${wsPath}`;

    this.client = new Client();

    this.client.on('connected', () => {
      this.emitState('connected');
    });

    this.client.on('disconnected', (reason?: Error) => {
      this.emitState('disconnected', reason);
    });

    this.client.on('stream', (stream: MediaStream) => {
      this.videoCallbacks.forEach((cb) => cb(stream));
    });

    // Connect using the base class method (synchronous)
    this.client.connect(url, params.password || '', params.username || 'user');
  }

  disconnect(): void {
    if (this.client) {
      this.client.Disconnect();
      this.client = null;
    }
    this.stopStats();
  }

  onVideoStream(cb: (stream: MediaStream) => void): void {
    this.videoCallbacks.push(cb);
  }

  onConnectionState(cb: (state: ConnectionState, err?: any) => void): void {
    this.stateCallbacks.push(cb);
  }

  // Helper to check if data channel is open
  private isDataChannelOpen(): boolean {
    if (!this.client) return false;
    const channel = (this.client as any)._channel; // access protected property
    return channel && channel.readyState === 'open';
  }

  // Input methods with guard
  sendMouseMove(x: number, y: number): void {
    if (this.isDataChannelOpen()) {
      this.client?.SendMouseMove(x, y);
    } else {
      console.log('Data channel not open, ignoring mouse move');
    }
  }

  sendMouseButtonDown(button: 0 | 1 | 2): void {
    if (this.isDataChannelOpen()) {
      this.client?.SendMouseButton(button, true);
    } else {
      console.log('Data channel not open, ignoring mouse down');
    }
  }

  sendMouseButtonUp(button: 0 | 1 | 2): void {
    if (this.isDataChannelOpen()) {
      this.client?.SendMouseButton(button, false);
    } else {
      console.log('Data channel not open, ignoring mouse up');
    }
  }

  sendWheel(dx: number, dy: number): void {
    if (this.isDataChannelOpen()) {
      this.client?.SendWheel(dx, dy);
    } else {
      console.log('Data channel not open, ignoring wheel');
    }
  }

  sendKeyDown(keysym: number): void {
    if (this.isDataChannelOpen()) {
      this.client?.SendKeyboard(keysym, true);
    } else {
      console.log('Data channel not open, ignoring key down');
    }
  }

  sendKeyUp(keysym: number): void {
    if (this.isDataChannelOpen()) {
      this.client?.SendKeyboard(keysym, false);
    } else {
      console.log('Data channel not open, ignoring key up');
    }
  }

  // Quality controls (stubs)
  requestKeyframe(): void {
    console.warn('Keyframe request not implemented yet');
  }

  setQualityProfile(profile: QualityProfile): void {
    console.warn('Quality profile change not implemented yet');
  }

  // Stats
  startStats(intervalMs: number): void {
    this.stopStats();
    this.statsInterval = setInterval(() => {
      if (!this.client) return;
      const pc = (this.client as any).pc;
      if (pc && pc.getStats) {
        pc.getStats().then((report: RTCStatsReport) => {
          const stats = this.parseStats(report);
          this.statsCallbacks.forEach((cb) => cb(stats));
        });
      }
    }, intervalMs);
  }

  onStats(cb: (stats: SessionStats) => void): void {
    this.statsCallbacks.push(cb);
  }

  private stopStats(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }

  private emitState(state: ConnectionState, err?: any): void {
    this.stateCallbacks.forEach((cb) => cb(state, err));
  }

  private parseStats(report: RTCStatsReport): SessionStats {
    const stats: SessionStats = {
      rtt: 0,
      packetsLost: 0,
      packetsReceived: 0,
      lossRate: 0,
      jitter: 0,
      framesDecoded: 0,
      framesDropped: 0,
    };

    report.forEach((stat) => {
      if (stat.type === 'remote-inbound-rtp' && stat.kind === 'video') {
        stats.rtt = stat.roundTripTime || 0;
        stats.jitter = stat.jitter || 0;
        stats.packetsLost = stat.packetsLost || 0;
        stats.packetsReceived = stat.packetsReceived || 0;
        if (stats.packetsReceived + stats.packetsLost > 0) {
          stats.lossRate = stats.packetsLost / (stats.packetsReceived + stats.packetsLost);
        }
      }
      if (stat.type === 'inbound-rtp' && stat.kind === 'video') {
        stats.framesDecoded = stat.framesDecoded || 0;
        stats.framesDropped = stat.framesDropped || 0;
      }
    });

    return stats;
  }
}