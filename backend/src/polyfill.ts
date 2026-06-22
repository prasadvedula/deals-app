// Polyfill globalThis.crypto for Node.js < 18 (LangGraph/uuid requires it)
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    writable: false,
    configurable: false,
  });
}
