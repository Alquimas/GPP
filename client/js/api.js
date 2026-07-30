/**
 * Gungi --- Server API Layer
 *
 * Lightweight fetch wrappers for all server endpoints.
 */

const BASE = '';

export async function api(method, path, body) {
  const opts = { method, headers: {} };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, opts);
  return res.json();
}

export async function fetchState() {
  return api('GET', '/api/state');
}

export async function sendAction(action) {
  return api('POST', '/api/action', { action });
}

export async function undo() {
  return api('POST', '/api/undo');
}

export async function gotoHistory(index) {
  return api('POST', '/api/goto', { index });
}

export async function resetGame(gsfen) {
  return api('POST', '/api/reset', { gsfen: gsfen || undefined });
}

export async function applyGAN(gan) {
  return api('POST', '/api/apply-gan', { gan });
}
