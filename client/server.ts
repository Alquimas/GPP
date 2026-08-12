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
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

// ── Oracle imports ──────────────────────────────────────────────────
import { Game } from "../oracle/src/game/game.js";
import type { Action } from "../oracle/src/types.js";
import { PIECE_NAMES, ALL_PIECE_TYPES } from "../oracle/src/constants.js";
import { serializeGAN } from "../oracle/src/gan/serialize.js";

// ── Paths ───────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ASSETS_DIR = path.join(ROOT, "assets");
const INDEX_HTML = path.join(__dirname, "index.html");
const PORT = parseInt(process.env.PORT ?? "") || 3030;
const MAX_BODY_BYTES = 1024 * 1024; // 1 MB cap on request bodies

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
  /** Acting player for this entry's action (player to move for the initial entry). */
  player: "white" | "black";
  /** Track B: the AI decision record for this move, if the move was AI-made. */
  decision: any | null;
}

let game: Game;
let fullHistory: HistoryEntry[];
let currentGameIndex: number;
/** Track B: which side(s) the AI plays ("none" | "white" | "black" | "both"). */
let aiMode: "none" | "white" | "black" | "both" = "none";

/** GAN parser (loaded async at startup). */
let _parseGAN: ((s: string) => any) | null = null;

// ── Track B: the AI bridge (frontend observability plan §13/§15) ────

const AI_DIR = path.resolve(__dirname, "..", "ai");
const AI_PY = path.join(AI_DIR, "py");
const AI_TIMEOUT_MS = 60_000;

/** One deterministic decision record for the current state, via the
 * Python analyze CLI (ai/ subrepo). The oracle history GSFENs restore
 * the repetition context (the C core re-derives the zkeys). */
function runAIDecision(gsfen: string, historyGsfens: string[]): Promise<any> {
  return new Promise((resolve, reject) => {
    execFile(
      "python3",
      ["-m", "gppai.analyze", "--gsfen", gsfen,
       "--history", JSON.stringify(historyGsfens),
       "--depth", "3", "--budget-ms", "300"],
      { cwd: AI_DIR, env: { ...process.env, PYTHONPATH: AI_PY },
        timeout: AI_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error("AI analyze failed: " + (stderr || err.message)));
          return;
        }
        try {
          resolve(JSON.parse(stdout));
        } catch {
          reject(new Error("AI returned invalid JSON: " + stdout.slice(0, 200)));
        }
      },
    );
  });
}

/** Apply a GAN through the oracle (the existing apply-gan path). */
function applyGanToSession(gan: string): { ok: true } | { ok: false; error: string } {
  const parsed = _parseGAN?.(gan);
  if (!parsed?.ok) {
    return { ok: false, error: "Invalid GAN: " + (parsed?.error ?? "parse failed") };
  }
  return doAction(parsed.action);
}

/** Whether the side to move is AI-assigned (game ongoing). */
function aiToMove(): boolean {
  if (game.result.kind !== "ongoing") return false;
  return aiMode === "both" || aiMode === game.state.turn.activePlayer;
}

/** Compute and apply one AI move for the side to move. Attaches the
 * decision record to the new history entry. Throws on failure. */
async function stepAI(): Promise<any> {
  const histGsfens = fullHistory.map((e) => e.gsfen);
  const record = await runAIDecision(game.toGsfen(), histGsfens);
  if (!record.move_gan) {
    throw new Error("AI found no move (record: " + JSON.stringify(record).slice(0, 200) + ")");
  }
  const r = applyGanToSession(record.move_gan);
  if (!r.ok) {
    throw new Error("AI move rejected by the oracle (" + record.move_gan + "): " + r.error);
  }
  fullHistory[currentGameIndex].decision = record;
  return record;
}

// ── Session management ──────────────────────────────────────────────

function startNewGame(gsfen?: string): void {
  game = new Game(gsfen);
  fullHistory = [
    {
      gsfen: game.toGsfen(),
      actionGAN: null,
      actionLabel: null,
      // Initial entry has no action, so record the player to move there.
      player: game.state.turn.activePlayer,
      decision: null,
    },
  ];
  currentGameIndex = 0;
}

startNewGame();

/** Apply an action. Returns the new result on success. */
function doAction(action: Action): { ok: true } | { ok: false; error: string } {
  // Read the acting player BEFORE applying (the state getter returns a clone).
  const actingPlayer = game.state.turn.activePlayer;

  // Serialize and label BEFORE mutating state: if serialization throws
  // (e.g. malformed turncoat), nothing has been applied, so history can
  // never diverge from the board.
  let ganStr: string;
  let pn: string;
  try {
    ganStr = serializeGAN(action);
    pn = actionLabel(action);
  } catch (e: any) {
    console.error("ORACLE THREW:", e.message ?? e);
    return { ok: false, error: "ORACLE ERROR: " + (e.message ?? String(e)) };
  }

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
  fullHistory = fullHistory.slice(0, currentGameIndex + 1);
  fullHistory.push({
    gsfen: afterGsfen,
    actionGAN: ganStr,
    actionLabel: pn,
    player: actingPlayer,
    decision: null,
  });
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
      return `Place ${pn} ${action.dest.col}-${action.dest.row}`;
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
    case "done":
      return "Declare Done";
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
    player: entry.player,
    isCurrent: i === currentGameIndex,
    hasDecision: entry.decision !== null,
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
    // Track B: AI mode + the most recent decision record (for the strip).
    aiMode,
    aiTurn: aiToMove(),
    lastDecision: fullHistory[currentGameIndex]?.decision ?? null,
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
    let total = 0;
    let settled = false;
    const settle = (value: any): void => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    // Defensive: bail out immediately if the declared length is over the cap.
    const declaredLength = parseInt(
      String(req.headers["content-length"] ?? ""),
      10,
    );
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      settle(null);
      return;
    }

    req.on("data", (c: Buffer) => {
      if (settled) return; // already rejected (oversize / abort)
      total += c.length;
      if (total > MAX_BODY_BYTES) {
        // Stop accumulating past the cap; the route sees null.
        settle(null);
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      if (settled) return;
      try {
        settle(JSON.parse(Buffer.concat(chunks).toString()));
      } catch {
        settle(null);
      }
    });
    // Client abort or connection error mid-body: settle instead of leaving
    // the promise pending and crashing the process on an unhandled event.
    req.on("error", () => settle(null));
    req.on("aborted", () => settle(null));
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

  // Content-Security-Policy: index.html uses inline style="" attributes
  // (hence 'unsafe-inline' for styles) but has NO inline <script> blocks,
  // so script-src 'self' is sufficient. All resources are same-origin.
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'",
  );

  // CORS: reflect the origin ONLY for the local dev origins (the server
  // binds loopback). Any other origin gets no Access-Control-Allow-Origin.
  const origin = req.headers.origin;
  if (
    origin === `http://localhost:${PORT}` ||
    origin === `http://127.0.0.1:${PORT}`
  ) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Reject oversized request bodies up front when Content-Length is known.
  const declaredLength = parseInt(
    String(req.headers["content-length"] ?? ""),
    10,
  );
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    req.resume(); // drain the socket so it can be reused
    json(res, 413, { error: "Request body too large (max 1 MB)" });
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
      if (
        typeof body?.index !== "number" ||
        !Number.isInteger(body.index) ||
        !doGoto(body.index)
      ) {
        json(res, 400, { error: "Invalid index" });
        return;
      }
      json(res, 200, buildStateResponse());
      return;
    }

    if (url.pathname === "/api/reset" && method === "POST") {
      const body = await parseBody(req);
      startNewGame(body?.gsfen);
      if (body?.ai === "white" || body?.ai === "black" || body?.ai === "both" || body?.ai === "none") {
        aiMode = body.ai;
      }
      json(res, 200, buildStateResponse());
      return;
    }

    if (url.pathname === "/api/ai-step" && method === "POST") {
      // Track B: one AI move for the side to move (if AI-assigned).
      if (!aiToMove()) {
        json(res, 422, { error: "Not the AI's turn (or game over)" });
        return;
      }
      try {
        await stepAI();
      } catch (e: any) {
        console.error("AI step failed:", e);
        json(res, 500, { error: String(e?.message ?? e) });
        return;
      }
      json(res, 200, buildStateResponse());
      return;
    }

    if (url.pathname === "/api/export-decisions" && method === "GET") {
      // Track B: JSONL dump of every recorded AI decision this session.
      const lines = fullHistory
        .filter((e) => e.decision !== null)
        .map((e) => JSON.stringify(e.decision));
      res.writeHead(200, {
        "Content-Type": "application/x-ndjson",
        "Content-Disposition": 'attachment; filename="decisions.jsonl"',
      });
      res.end(lines.join("\n") + (lines.length ? "\n" : ""));
      return;
    }

    if (url.pathname === "/api/piece-names" && method === "GET") {
      json(res, 200, PIECE_NAMES);
      return;
    }

    // ── Serve assets ─────────────────────────────────────────────
    if (url.pathname.startsWith("/assets/")) {
      const filename = url.pathname.slice("/assets/".length);
      // Prevent path traversal / escape from ASSETS_DIR.
      const filePath = path.resolve(ASSETS_DIR, filename);
      if (
        filename.includes("..") ||
        filename.includes("~") ||
        !filePath.startsWith(ASSETS_DIR + path.sep)
      ) {
        text(res, 403, "Forbidden");
        return;
      }
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
      // Resolve relative to client/ directory, enforcing containment:
      // the resolved path must stay inside __dirname.
      const filePath = path.resolve(__dirname, url.pathname.replace(/^\//, ""));
      if (!filePath.startsWith(__dirname + path.sep)) {
        text(res, 403, "Forbidden");
        return;
      }
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

const PIECE_TYPE_SET: ReadonlySet<string> = new Set(ALL_PIECE_TYPES);

/** True if v is an object with integer col/row in 1..9. */
function isValidSquare(v: any): boolean {
  return (
    v !== null &&
    typeof v === "object" &&
    Number.isInteger(v.col) &&
    Number.isInteger(v.row) &&
    v.col >= 1 &&
    v.col <= 9 &&
    v.row >= 1 &&
    v.row <= 9
  );
}

/** True if v is an array whose elements are all 1 or 2 (TurncoatLevels). */
function isValidTurncoat(v: any): boolean {
  // Strictly ascending: serializeTurncoat joins levels into "+12"; the GAN
  // parser accepts only "1", "2", "12", so [2,1] would create a history
  // entry that cannot be replayed after undo/goto.
  return (
    Array.isArray(v) &&
    v.every((n) => n === 1 || n === 2) &&
    v.every((n, i) => i === 0 || v[i - 1] < n)
  );
}

/**
 * Validate the raw wire DTO BEFORE constructing the Action so the engine
 * never sees unvalidated input (the engine fails open on unknown piece
 * letters and crashes on bad coordinates).
 */
function buildActionFromDTO(dto: any): Action | null {
  try {
    switch (dto.kind) {
      case "placement":
        if (!PIECE_TYPE_SET.has(dto.piece) || !isValidSquare(dto.dest)) {
          return null;
        }
        return {
          kind: "placement",
          piece: dto.piece,
          dest: dto.dest,
        };
      case "done":
        return { kind: "done" };
      case "move": {
        if (!isValidSquare(dto.origin) || !isValidSquare(dto.dest)) {
          return null;
        }
        const outcome = dto.outcome ?? null;
        if (outcome !== null && outcome !== "stack" && outcome !== "capture") {
          return null;
        }
        const turncoat = dto.turncoat ?? [];
        if (!isValidTurncoat(turncoat)) return null;
        return {
          kind: "move",
          origin: dto.origin,
          dest: dto.dest,
          outcome,
          turncoat,
        };
      }
      case "arata": {
        if (!PIECE_TYPE_SET.has(dto.piece) || !isValidSquare(dto.dest)) {
          return null;
        }
        const turncoat = dto.turncoat ?? [];
        if (!isValidTurncoat(turncoat)) return null;
        return {
          kind: "arata",
          piece: dto.piece,
          dest: dto.dest,
          turncoat,
        };
      }
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

  server.listen(PORT, "127.0.0.1", () => {
    console.log(`\n  🏯 Gungi Developer Client\n`);
    console.log(`  -> http://127.0.0.1:${PORT} (loopback only)\n`);
    console.log(`  Keys:  g=GSFEN  a=Actions  h=History  t=Turn info`);
    console.log(`         u=Undo  ←->=Navigate  r=Reset  ?=Help\n`);
  });
}

main().catch(console.error);
