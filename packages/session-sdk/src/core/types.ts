export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
export type QualityProfile = '1080p' | '720p' | '480p';

export interface SessionStats {
  rtt: number;
  packetsLost: number;
  packetsReceived: number;
  lossRate: number;
  jitter: number;
  framesDecoded: number;
  framesDropped: number;
}

export interface SessionClient {
  connect(params: { baseUrl: string; wsPath?: string; username?: string; password?: string; backend: 'neko' }): Promise<void>;
  disconnect(): void;
  onVideoStream(cb: (stream: MediaStream) => void): void;
  onConnectionState(cb: (state: ConnectionState, err?: any) => void): void;
  sendMouseMove(x: number, y: number): void;
  sendMouseButtonDown(button: 0 | 1 | 2): void;
  sendMouseButtonUp(button: 0 | 1 | 2): void;
  sendWheel(dx: number, dy: number): void;
  sendKeyDown(keysym: number): void;
  sendKeyUp(keysym: number): void;
  requestKeyframe(): void;
  setQualityProfile(profile: QualityProfile): void;
  startStats(intervalMs: number): void;
  onStats(cb: (stats: SessionStats) => void): void;
}