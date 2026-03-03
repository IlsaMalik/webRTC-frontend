import { NekoClient } from './adapters/neko/neko-client';
export * from './core/types';
export { NekoClient } from './adapters/neko/neko-client';
export { default as GuacamoleKeyboard } from './input/guacamole-keyboard';

export function createSessionClient() {
    return new NekoClient();
}