import { BaseClient } from './base';
import { EVENT } from './events';

export class Client extends BaseClient {
  private _displayName = '';
  private _password = '';
  private _reconnecting = false;
  private _reconnectTimer?: number;

  public Connect(password: string, displayName: string) {
    this._password = password;
    this._displayName = displayName;
    super.connect(this._ws?.url || '', password, displayName);
  }

  public Disconnect() {
    this.disconnect();
  }

  public SendMouseMove(x: number, y: number) {
    this.sendData('mousemove', { x, y });
  }

  public SendMouseButton(button: number, down: boolean) {
    this.sendData(down ? 'mousedown' : 'mouseup', { key: button });
  }

  public SendWheel(dx: number, dy: number) {
    this.sendData('wheel', { x: dx, y: dy });
  }

  public SendKeyboard(key: number, down: boolean) {
    this.sendData(down ? 'keydown' : 'keyup', { key });
  }

  protected [EVENT.RECONNECTING]() {
    this.emit('reconnecting');
  }

  protected [EVENT.CONNECTING]() {
    this.emit('connecting');
  }

  protected [EVENT.CONNECTED]() {
    this.emit('connected');
  }

  protected [EVENT.DISCONNECTED](reason?: Error) {
    this.emit('disconnected', reason);
  }

  protected [EVENT.TRACK](event: RTCTrackEvent) {
    const stream = event.streams[0];
    if (stream) {
      this.emit('stream', stream);
    }
    this.emit('track', event);
  }

  protected [EVENT.DATA](data: any) {
    this.emit('data', data);
  }

  protected [EVENT.MESSAGE](event: string, payload: any) {
    this.emit('message', { event, payload });
  }
}