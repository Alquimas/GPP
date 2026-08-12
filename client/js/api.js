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

  if (!res.ok) {
    // Non-2xx response: surface the server's error message when the body is
    // parseable JSON, otherwise fall back to the HTTP status text.
    let message = `${res.status} ${res.statusText}`;
    try {
      const errBody = await res.json();
      if (errBody && typeof errBody.error === 'string') message = errBody.error;
      else if (errBody && typeof errBody.message === 'string') message = errBody.message;
    } catch {
      // Body was not JSON (e.g. an HTML error page) — keep the status text.
    }
    throw new Error(message);
  }

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

export async function resetGame(gsfen, ai) {
  return api('POST', '/api/reset', { gsfen: gsfen || undefined, ai: ai || 'none' });
}

export async function applyGAN(gan) {
  return api('POST', '/api/apply-gan', { gan });
}

export async function aiStep() {
  return api('POST', '/api/ai-step', {});
}

export async function exportDecisions() {
  const res = await fetch(BASE + '/api/export-decisions');
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const err = await res.json();
      if (err && typeof err.error === 'string') msg = err.error;
    } catch { /* keep status text */ }
    throw new Error(msg);
  }
  return res.text();
}
