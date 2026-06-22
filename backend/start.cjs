'use strict';

/**
 * Entry-point wrapper — must run before dist/index.js loads ANY module.
 * Polyfills globalThis.crypto so LangGraph / uuid work on Node < 18.
 */
if (!globalThis.crypto) {
  const nodeCrypto = require('crypto');

  // Node 15-17: webcrypto exists on the module
  if (nodeCrypto.webcrypto) {
    Object.defineProperty(globalThis, 'crypto', {
      value: nodeCrypto.webcrypto,
      writable: false,
      configurable: false,
    });
  } else {
    // Node 14 fallback: implement randomUUID manually
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        randomUUID() {
          const b = nodeCrypto.randomBytes(16);
          b[6] = (b[6] & 0x0f) | 0x40;
          b[8] = (b[8] & 0x3f) | 0x80;
          const h = b.toString('hex');
          return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
        },
        getRandomValues(arr) {
          const bytes = nodeCrypto.randomBytes(arr.byteLength);
          arr.set(new arr.constructor(bytes.buffer));
          return arr;
        },
      },
      writable: false,
      configurable: false,
    });
  }

  console.log('[startup] globalThis.crypto polyfilled for Node', process.version);
}

// Load compiled app AFTER polyfill is in place
require('./dist/index.js');
