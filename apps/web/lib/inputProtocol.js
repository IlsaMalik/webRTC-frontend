// apps/web/lib/inputProtocol.js

// Every binary frame starts with this version number.
// The pod checks this first to make sure it understands the message.
export const INPUT_VERSION = 1;

// Opcodes — each number represents a type of input event.
// The pod reads this number and knows what kind of event it received.
export const OPCODES = {
  POINTER_MOVE_ABS:    1,  // mouse moved to a position
  POINTER_BUTTON_DOWN: 2,  // mouse button pressed
  POINTER_BUTTON_UP:   3,  // mouse button released
  POINTER_WHEEL:       4,  // scroll wheel moved
  KEY_DOWN:            5,  // keyboard key pressed
  KEY_UP:              6,  // keyboard key released
};

// Builds the standard 4-byte header around any payload.
// Every single message we send uses this — mouse, keyboard, scroll.
// Structure: [version(1)] [opcode(1)] [flags(2)] [payload...]
export function packFrame(opcode, payloadBytes) {
  const payloadLen = payloadBytes ? payloadBytes.length : 0;

  // Allocate exact memory needed: 4 byte header + payload
  const buf = new ArrayBuffer(4 + payloadLen);
  const dv  = new DataView(buf);

  dv.setUint8(0,  INPUT_VERSION); // byte 0: always 1
  dv.setUint8(1,  opcode);        // byte 1: what type of event
  dv.setUint16(2, 0, false);      // bytes 2-3: flags, unused, always 0

  // Copy payload bytes in after the 4-byte header
  if (payloadLen) {
    new Uint8Array(buf, 4).set(payloadBytes);
  }

  return buf;
}

// Builds a mouse MOVE message.
// x, y = pixel coordinates on the remote screen
export function packMove(x, y) {
  const payload = new Uint8Array(4); // 2 bytes x + 2 bytes y
  const dv = new DataView(payload.buffer);
  dv.setUint16(0, x, false); // x coordinate
  dv.setUint16(2, y, false); // y coordinate
  return packFrame(OPCODES.POINTER_MOVE_ABS, payload);
}

// Builds a mouse BUTTON message (press or release).
// opcode  = POINTER_BUTTON_DOWN or POINTER_BUTTON_UP
// button  = 1 (left), 2 (middle), 3 (right)
export function packButton(opcode, x, y, button, modifierFlags = 0) {
  const payload = new Uint8Array(6); // x(2) + y(2) + button(1) + flags(1)
  const dv = new DataView(payload.buffer);
  dv.setUint16(0, x, false);     // x position
  dv.setUint16(2, y, false);     // y position
  dv.setUint8(4,  button);       // which button: 1/2/3
  dv.setUint8(5,  modifierFlags);// was ctrl/shift/alt held?
  return packFrame(opcode, payload);
}

// Builds a SCROLL WHEEL message.
// dx = horizontal scroll, dy = vertical scroll (can be negative)
export function packWheel(x, y, dx, dy, modifierFlags = 0) {
  const payload = new Uint8Array(9); // x(2)+y(2)+dx(2)+dy(2)+flags(1)
  const dv = new DataView(payload.buffer);
  dv.setUint16(0, x,  false); // x position
  dv.setUint16(2, y,  false); // y position
  dv.setInt16(4,  dx, false); // horizontal scroll (signed, can be negative)
  dv.setInt16(6,  dy, false); // vertical scroll (signed, can be negative)
  dv.setUint8(8,  modifierFlags);
  return packFrame(OPCODES.POINTER_WHEEL, payload);
}

// Builds a KEYBOARD message (key down or key up).
// keyCode = numeric code (65 = A)
// key     = string name ("a", "Enter", "Escape")
// code    = physical key ("KeyA", "Enter")
export function packKey(opcode, keyCode, key, code, modifierFlags = 0) {
  const keyBytes  = new TextEncoder().encode(key  || "");
  const codeBytes = new TextEncoder().encode(code || "");

  // Dynamic size because key strings have different lengths
  // Layout: keyCode(2) + modifiers(1) + keyLen(1) + keyBytes + codeLen(1) + codeBytes
  const payload = new Uint8Array(
    2 + 1 + 1 + keyBytes.length + 1 + codeBytes.length
  );
  const dv = new DataView(payload.buffer);

  dv.setUint16(0, keyCode, false);           // numeric key code
  dv.setUint8(2,  modifierFlags);            // ctrl/shift/alt/meta
  dv.setUint8(3,  keyBytes.length);          // how long the key string is
  payload.set(keyBytes, 4);                  // the key string itself
  payload.set([codeBytes.length], 4 + keyBytes.length); // code string length
  payload.set(codeBytes, 5 + keyBytes.length);          // the code string itself

  return packFrame(opcode, payload);
}

// Reads a browser keyboard/mouse event and returns
// a single number with all modifier keys packed in.
// Ctrl=1, Shift=2, Alt=4, Meta=8
// Example: Ctrl+Shift held = 1|2 = 3
export function getModifierFlags(event) {
  return (
    (event.ctrlKey  ? 1 : 0) |
    (event.shiftKey ? 2 : 0) |
    (event.altKey   ? 4 : 0) |
    (event.metaKey  ? 8 : 0)
  );
}

// Keeps a number within a min/max range.
// Example: clamp(1500, 0, 1279) → 1279
// Used to stop mouse coordinates going off screen
export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}