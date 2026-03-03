declare class GuacamoleKeyboard {
  onkeydown: ((keysym: number) => boolean | void) | null;
  onkeyup: ((keysym: number) => void) | null;
  constructor(element?: Element | Document | Window);
  press(keysym: number): boolean;
  release(keysym: number): void;
  reset(): void;
  listenTo(element: Element | Document): void;
}

export default GuacamoleKeyboard;