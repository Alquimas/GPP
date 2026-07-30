/**
 * Gungi Developer Client --- HTTP API server + static file server.
 *
 * Run with: npx tsx client/server.ts
 * Uses the oracle's Game engine to manage a full game session with
 * history navigation, undo, and state inspection.
 */

import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ── Oracle imports ──────────────────────────────────────────────────
import { Game } from "../oracle/src/game/game.js";
import type { Action } from "../oracle/src/types.js";
import { PIECE_NAMES } from "../oracle/src/constants.js";
import { serializeGAN } from "../oracle/src/gan/serialize.js";

// ── Paths ───────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ASSETS_DIR = path.join(ROOT, "assets");
const INDEX_HTML = path.join(__dirname, "index.html");
const PORT = parseInt(process.env.PORT ?? "") || 3030;

// ── MIME types ──────────────────────────────────────────────────────
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function mimeType(p: string): string {
  return MIME[path.extname(p).toLowerCase()] ?? "application/octet-stream";
}

// ── Game session state ──────────────────────────────────────────────

interface HistoryEntry {
  gsfen: string;
  actionGAN: string | null;
  actionLabel: string | null;
}

let game: Game;
let fullHistory: HistoryEntry[];
let currentGameIndex: number;

/** GAN parser (loaded async at startup). */
let _parseGAN: ((s: string) => any) | null = null;

// ── Session management ──────────────────────────────────────────────

function startNewGame(gsfen?: string): void {
  game = new Game(gsfen);
  fullHistory = [{ gsfen: game.toGsfen(), actionGAN: null, actionLabel: null }];
  currentGameIndex = 0;
}

startNewGame();

/** Apply an action. Returns the new result on success. */
function doAction(action: Action): { ok: true } | { ok: false; error: string } {
  let applyResult;
  try {
    applyResult = game.applyAction(action);
  } catch (e: any) {
    console.error("ORACLE THREW:", e.message ?? e);
    return { ok: false, error: "ORACLE ERROR: " + (e.message ?? String(e)) };
  }

  if (!applyResult.ok) {
    return {
      ok: false,
      error: `${applyResult.error.rule}: ${applyResult.error.message}`,
    };
  }

  // Action succeeded
  const afterGsfen = game.toGsfen();
  const ganStr = serializeGAN(action);
  const pn = actionLabel(action);
  fullHistory = fullHistory.slice(0, currentGameIndex + 1);
  fullHistory.push({ gsfen: afterGsfen, actionGAN: ganStr, actionLabel: pn });
  currentGameIndex = fullHistory.length - 1;

  return { ok: true };
}

/** Undo: rewind to previous history entry. */
function doUndo(): boolean {
  if (currentGameIndex <= 0) return false;
  currentGameIndex--;
  rebuildGameAtCurrentIndex();
  return true;
}

/** Go to a specific history index (read-only view --- game is rebuilt there). */
function doGoto(index: number): boolean {
  if (index < 0 || index >= fullHistory.length) return false;
  currentGameIndex = index;
  rebuildGameAtCurrentIndex();
  return true;
}

/** Create a Game at the current history index by replaying from the initial state. */
function rebuildGameAtCurrentIndex(): void {
  const startGsfen = fullHistory[0].gsfen;
  game = new Game(startGsfen);
  for (let i = 1; i <= currentGameIndex; i++) {
    const entry = fullHistory[i];
    if (!entry.actionGAN) continue;
    try {
      // Parse the GAN and apply
      const parsed = _parseGAN?.(entry.actionGAN);
      if (!parsed || !parsed.ok) {
        console.warn(`Failed to parse GAN at index ${i}: ${entry.actionGAN}`);
        continue;
      }
      game.applyAction(parsed.action);
    } catch (e) {
      console.warn(`Failed to replay action at index ${i}:`, e);
    }
  }
}

function actionLabel(action: Action): string {
  switch (action.kind) {
    case "placement": {
      const pn = PIECE_NAMES[action.piece] ?? action.piece;
      return `Place ${pn} ${action.dest.col}-${action.dest.row}${action.done ? " ✓" : ""}`;
    }
    case "move": {
      let label = `Move ${action.origin.col}-${action.origin.row}->${action.dest.col}-${action.dest.row}`;
      // outcome: null = forced (auto-stack or forced-capture), 'stack' = choice, 'capture' = choice
      if (action.outcome === "stack") label += " (stack)";
      else if (action.outcome === "capture") label += " (capture)";
      if (action.turncoat.length > 0) label += ` TC[${action.turncoat}]`;
      return label;
    }
    case "arata": {
      const pn = PIECE_NAMES[action.piece] ?? action.piece;
      let label = `Arata ${pn} ${action.dest.col}-${action.dest.row}`;
      if (action.turncoat.length > 0) label += ` TC[${action.turncoat}]`;
      return label;
    }
    default:
      return "Unknown action";
  }
}

// ── Board serialization ─────────────────────────────────────────────

interface CellDTO {
  col: number;
  row: number;
  stack: { type: string; owner: string; level: number }[] | null;
}

interface ActionDTO {
  kind: string;
  piece?: string;
  dest?: { col: number; row: number };
  done?: boolean;
  origin?: { col: number; row: number };
  outcome?: string | null;
  turncoat: number[];
  display: string;
}

function actionToDTO(action: Action): ActionDTO {
  return {
    ...action,
    turncoat:
      "turncoat" in action && Array.isArray((action as any).turncoat)
        ? (action as any).turncoat
        : [],
    display: actionLabel(action),
  };
}

function buildStateResponse(): object {
  const state = game.state;
  const result = game.result;
  const legalActions = game.legalActions.map(actionToDTO);

  // Board: API row[d] where d=0 is LEFTmost (GSFEN col 9),
  // d=8 is RIGHTmost (GSFEN col 1).
  // Oracle position[r][c] stores c=0 = GSFEN col 1 (rightmost),
  // c=8 = GSFEN col 9 (leftmost). So we iterate c in reverse.
  const board: (CellDTO | null)[][] = [];
  for (let r = 0; r < 9; r++) {
    const row: (CellDTO | null)[] = [];
    for (let c = 8; c >= 0; c--) {
      const stack = state.position[r][c];
      if (stack === null) {
        row.push(null);
      } else {
        row.push({
          col: c + 1,
          row: r + 1,
          stack: stack.map((p, i) => ({
            type: p.type,
            owner: p.owner,
            level: i + 1,
          })),
        });
      }
    }
    board.push(row);
  }

  const turn = state.turn;
  const playerLabel = turn.activePlayer === "white" ? "White" : "Black";
  const turnDesc =
    turn.phase === "deploy"
      ? `${playerLabel} to place`
      : `${playerLabel} to play`;

  const historyEntries = fullHistory.map((entry, i) => ({
    index: i,
    gsfen: entry.gsfen,
    action: entry.actionLabel,
    actionGAN: entry.actionGAN,
    isCurrent: i === currentGameIndex,
  }));

  return {
    gsfen: game.toGsfen(),
    phase: turn.phase,
    phaseDesc: turn.phase === "deploy" ? "Deploy Phase" : "Battle Phase",
    activePlayer: turn.activePlayer,
    playerLabel,
    turnDesc,
    done: turn.done,
    counter: turn.counter,
    result,
    isTerminal: result.kind !== "ongoing",
    resultLabel: resultLabel(result),
    board,
    hands: {
      white: state.hands.white,
      black: state.hands.black,
    },
    legalActions,
    history: historyEntries,
    currentIndex: currentGameIndex,
    historySize: fullHistory.length,
    canUndo: currentGameIndex > 0,
  };
}

function resultLabel(result: { kind: string; loser?: string }): string {
  switch (result.kind) {
    case "ongoing":
      return "Game in progress";
    case "checkmate":
      return `Checkmate --- ${result.loser} loses`;
    case "stalemate":
      return `Stalemate --- ${result.loser} loses`;
    case "exposure":
      return `Exposure --- ${result.loser} loses`;
    case "exposure-draw":
      return `Exposure --- Draw`;
    case "repetition":
      return `Repetition --- Draw`;
    default:
      return result.kind;
  }
}

// ── Body parser ─────────────────────────────────────────────────────

function parseBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()));
      } catch {
        resolve(null);
      }
    });
  });
}

// ── HTTP Router ─────────────────────────────────────────────────────

function json(res: http.ServerResponse, status: number, data: any): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function text(res: http.ServerResponse, status: number, body: string): void {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(body);
}

function binary(
  res: http.ServerResponse,
  status: number,
  ct: string,
  data: Buffer,
): void {
  res.writeHead(status, { "Content-Type": ct });
  res.end(data);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const method = req.method ?? "GET";

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // ── API ──────────────────────────────────────────────────────

    if (url.pathname === "/api/state" && method === "GET") {
      json(res, 200, buildStateResponse());
      return;
    }

    if (url.pathname === "/api/action" && method === "POST") {
      const body = await parseBody(req);
      if (!body?.action) {
        json(res, 400, { error: "Missing action" });
        return;
      }
      const action = buildActionFromDTO(body.action);
      if (!action) {
        json(res, 400, { error: "Invalid action" });
        return;
      }
      let result;
      try {
        result = doAction(action);
      } catch (e: any) {
        console.error("doAction threw:", e);
        json(res, 500, {
          error: "doAction threw: " + (e.message ?? String(e)),
        });
        return;
      }
      if (!result.ok) {
        let stateResp;
        try {
          stateResp = buildStateResponse();
        } catch (e2: any) {
          console.error("buildStateResponse threw:", e2);
          json(res, 500, {
            error: "buildStateResponse threw: " + (e2.message ?? String(e2)),
          });
          return;
        }
        json(res, 422, { error: result.error, state: stateResp });
        return;
      }
      json(res, 200, buildStateResponse());
      return;
    }

    if (url.pathname === "/api/apply-gan" && method === "POST") {
      const body = await parseBody(req);
      if (!body?.gan) {
        json(res, 400, { error: "Missing gan" });
        return;
      }
      const parsed = _parseGAN?.(body.gan);
      if (!parsed?.ok) {
        json(res, 400, { error: "Invalid GAN: " + (parsed?.error ?? "parse failed") });
        return;
      }
      const action = parsed.action;
      const result = doAction(action);
      if (!result.ok) {
        json(res, 422, { error: result.error, state: buildStateResponse() });
        return;
      }
      json(res, 200, buildStateResponse());
      return;
    }

    if (url.pathname === "/api/undo" && method === "POST") {
      if (!doUndo()) {
        json(res, 422, { error: "Nothing to undo" });
        return;
      }
      json(res, 200, buildStateResponse());
      return;
    }

    if (url.pathname === "/api/goto" && method === "POST") {
      const body = await parseBody(req);
      if (typeof body?.index !== "number" || !doGoto(body.index)) {
        json(res, 400, { error: "Invalid index" });
        return;
      }
      json(res, 200, buildStateResponse());
      return;
    }

    if (url.pathname === "/api/reset" && method === "POST") {
      const body = await parseBody(req);
      startNewGame(body?.gsfen);
      json(res, 200, buildStateResponse());
      return;
    }

    if (url.pathname === "/api/piece-names" && method === "GET") {
      json(res, 200, PIECE_NAMES);
      return;
    }

    // ── Serve assets ─────────────────────────────────────────────
    if (url.pathname.startsWith("/assets/")) {
      const filename = url.pathname.slice("/assets/".length);
      // Prevent path traversal
      if (filename.includes("..") || filename.includes("~")) {
        text(res, 403, "Forbidden");
        return;
      }
      const filePath = path.join(ASSETS_DIR, filename);
      try {
        const content = await fs.readFile(filePath);
        binary(res, 200, mimeType(filePath), content);
      } catch {
        // If exact file missing, try level-1 variant for missing specific-level art
        const fallback = missingAssetFallback(filePath);
        if (fallback) {
          try {
            const fb = await fs.readFile(fallback);
            binary(res, 200, mimeType(fallback), fb);
          } catch {
            // Also try serving a generic placeholder SVG
            try {
              const svg = missingPieceSVG(filePath);
              if (svg) {
                res.writeHead(200, { "Content-Type": "image/svg+xml" });
                res.end(svg);
              } else {
                text(res, 404, "Not found");
              }
            } catch {
              text(res, 404, "Not found");
            }
          }
        } else {
          // Try SVG placeholder
          try {
            const svg = missingPieceSVG(filePath);
            if (svg) {
              res.writeHead(200, { "Content-Type": "image/svg+xml" });
              res.end(svg);
            } else {
              text(res, 404, "Not found");
            }
          } catch {
            text(res, 404, "Not found");
          }
        }
      }
      return;
    }

    // ── Serve static files (JS, CSS, etc.) ────────────────────────
    const ext = path.extname(url.pathname).toLowerCase();
    if (ext === ".js" || ext === ".css") {
      // Resolve relative to client/ directory
      const filePath = path.join(__dirname, url.pathname.replace(/^\//, ""));
      try {
        const content = await fs.readFile(filePath, "utf-8");
        res.writeHead(200, { "Content-Type": mimeType(filePath) });
        res.end(content);
        return;
      } catch {
        // fall through to index.html
      }
    }

    // ── Serve index.html ─────────────────────────────────────────
    const html = await fs.readFile(INDEX_HTML, "utf-8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  } catch (err: any) {
    console.error("Server error:", err);
    json(res, 500, { error: err.message ?? "Internal error" });
  }
});

/** Missing asset fallback: some game art is missing for certain levels (e.g. White_Cannon_1.png). */
function missingAssetFallback(filePath: string): string | null {
  const basename = path.basename(filePath);
  const m = basename.match(/^(White|Black)_(\w+)_(\d+)\.png$/);
  if (!m) return null;
  const [, color, pname] = m;
  const fallback = path.join(ASSETS_DIR, `${color}_${pname}_1.png`);
  if (fallback !== filePath) return fallback;
  return null;
}

/**
 * Generate a simple SVG placeholder for a missing piece image.
 * Color extracts from filename (White/Black), letter from piece mapping.
 */
function missingPieceSVG(filePath: string): string | null {
  const basename = path.basename(filePath);
  const m = basename.match(/^(White|Black)_(\w+)_(\d+)\.png$/);
  if (!m) return null;
  const [, color, , level] = m;
  const bg = color === "White" ? "#3B2A1C" : "#E4D0B4";
  const fg = color === "White" ? "#F5E8D8" : "#2A1A0A";
  const border = color === "White" ? "#5D3A1A" : "#C4A27A";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
    <rect width="120" height="120" rx="8" fill="${bg}" stroke="${border}" stroke-width="1.5"/>
    <text x="60" y="72" text-anchor="middle" font-family="Georgia,serif" font-size="42" font-weight="700" fill="${fg}" dominant-baseline="central">?</text>
    <text x="60" y="112" text-anchor="middle" font-family="sans-serif" font-size="11" fill="${fg}" opacity="0.6">Lv ${level}</text>
  </svg>`;
}

// ── Build Action from DTO ───────────────────────────────────────────

function buildActionFromDTO(dto: any): Action | null {
  try {
    switch (dto.kind) {
      case "placement":
        return {
          kind: "placement",
          piece: dto.piece,
          dest: dto.dest,
          done: !!dto.done,
        };
      case "move":
        return {
          kind: "move",
          origin: dto.origin,
          dest: dto.dest,
          outcome: dto.outcome ?? null,
          turncoat: dto.turncoat ?? [],
        };
      case "arata":
        return {
          kind: "arata",
          piece: dto.piece,
          dest: dto.dest,
          turncoat: dto.turncoat ?? [],
        };
      default:
        return null;
    }
  } catch {
    return null;
  }
}

// ── Bootstrap ────────────────────────────────────────────────────────

async function main() {
  try {
    const mod = await import("../oracle/src/gan/parse.js");
    _parseGAN = (s: string) => mod.parseGAN(s);
    console.log("GAN parser ready");
  } catch (err) {
    console.warn("GAN parser not available:", err);
  }

  server.listen(PORT, () => {
    console.log(`\n  🏯 Gungi Developer Client\n`);
    console.log(`  -> http://localhost:${PORT}\n`);
    console.log(`  Keys:  g=GSFEN  a=Actions  h=History  t=Turn info`);
    console.log(`         u=Undo  ←->=Navigate  r=Reset  ?=Help\n`);
  });
}

main().catch(console.error);
