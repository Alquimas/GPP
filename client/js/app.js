/**
 * Gungi --- Game UI Application
 *
 * Lishogi-inspired two-player local Gungi interface.
 * Board rendering, hand zones, move list, controls, and game flow.
 */

import { fetchState as apiFetchState, sendAction, undo as apiUndo, gotoHistory, resetGame as apiReset, applyGAN } from './api.js';

/* ── Constants ─────────────────────────────────────────────────────── */

const PIECE_LABELS = {
  A:'Archer', C:'Cannon', E:'Spear', F:'Fortress',
  G:'General', J:'Major', L:'Lieutenant', M:'Marshal',
  N:'Knight', P:'Pawn', S:'Samurai', T:'Captain',
  U:'Musketeer', Y:'Spy'
};

const ALL_PIECE_TYPES = ['A','C','E','F','G','J','L','M','N','P','S','T','U','Y'];
const WHITE_HAND_ORDER = ['M','S','G','Y','L','F','J','C','T','A','E','U','N','P'];
const BLACK_HAND_ORDER = ['S','M','Y','G','F','L','C','J','A','T','U','E','P','N'];

/* ── State ──────────────────────────────────────────────────────────── */

let serverState = null;            // full state from server
let selectedCell = null;           // { col, row } | null
let selectedHandPiece = null;      // { color, type } | null
let pendingAction = null;          // action awaiting confirmation (battle phase)
let currentViewIndex = -1;         // history index currently viewing
let statusTimer = null;
let presenting = false;            // presentation mode active
let presentAbort = null;           // abort function for presentation

/* ── DOM refs ───────────────────────────────────────────────────────── */

const $ = id => document.getElementById(id);
const boardEl = $('board');
const handBlackEl = $('hand-black');
const handWhiteEl = $('hand-white');
const moveListEl = $('move-list');
const controlsEl = $('controls');
const infoBarEl = $('info-bar');
const statusMsgEl = $('status-msg');
const stackPopupEl = $('stack-popup');
const gameOverEl = $('game-over-overlay');

/* ── Helpers ────────────────────────────────────────────────────────── */

function assetUrl(color, type, level) {
  const cap = color === 'white' ? 'White' : 'Black';
  return `/assets/${cap}_${PIECE_LABELS[type]}_${level || 1}.png`;
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function pieceLetter(piece) {
  return piece.owner === 'white' ? piece.type.toUpperCase() : piece.type.toLowerCase();
}

function otherPlayer(p) {
  return p === 'white' ? 'black' : 'white';
}

/* ── API calls ──────────────────────────────────────────────────────── */

async function refreshState() {
  try {
    serverState = await apiFetchState();
    currentViewIndex = serverState.currentIndex;
    renderAll();
  } catch (e) {
    setStatus('Failed to fetch game state', true);
  }
}

async function doSendAction(action) {
  try {
    const res = await sendAction(action);
    if (res.error) { setStatus(res.error, true); return false; }
    serverState = res;
    currentViewIndex = serverState.currentIndex;
    return true;
  } catch (e) {
    setStatus('Failed to send action' + (e?.message ? ': ' + e.message : ''), true);
    return false;
  }
}

async function doUndo() {
  try {
    const res = await apiUndo();
    if (res.error) { setStatus(res.error, true); return false; }
    serverState = res;
    currentViewIndex = serverState.currentIndex;
    return true;
  } catch (e) {
    setStatus('Failed to undo' + (e?.message ? ': ' + e.message : ''), true);
    return false;
  }
}

async function doGotoHistory(index) {
  try {
    const res = await gotoHistory(index);
    if (res.error) { setStatus(res.error, true); return false; }
    serverState = res;
    currentViewIndex = index;
    renderAll();
    return true;
  } catch (e) {
    setStatus('Failed to navigate history' + (e?.message ? ': ' + e.message : ''), true);
    return false;
  }
}

async function doReset(gsfen) {
  try {
    const res = await apiReset(gsfen);
    if (res.error) { setStatus(res.error, true); return false; }
    serverState = res;
    currentViewIndex = serverState.currentIndex;
    selectedCell = null;
    selectedHandPiece = null;
    pendingAction = null;
    renderAll();
    return true;
  } catch (e) {
    setStatus('Failed to reset game' + (e?.message ? ': ' + e.message : ''), true);
    return false;
  }
}

/* ── Status messages ──────────────────────────────────────────────── */

function setStatus(msg, isError) {
  statusMsgEl.textContent = msg;
  statusMsgEl.className = isError ? 'error' : 'active';
  clearTimeout(statusTimer);
  if (!isError) {
    statusTimer = setTimeout(() => {
      if (statusMsgEl.textContent === msg) {
        statusMsgEl.textContent = '';
        statusMsgEl.className = '';
      }
    }, 4000);
  }
}

/* ── Top-level render ──────────────────────────────────────────────── */

function renderAll() {
  if (!serverState) return;
  renderInfoBar();
  renderBoard();
  renderHandZone('black');
  renderHandZone('white');
  renderMoveList();
  renderControls();
  renderGameOver();
}

/* ── Info Bar ───────────────────────────────────────────────────────── */

function renderInfoBar() {
  const s = serverState;

  let phaseText = s.phase === 'deploy' ? 'Deploy' : 'Battle';
  if (s.isTerminal) phaseText = 'Game Over';
  infoBarEl.querySelector('.ib-phase').textContent = phaseText;

  const turnEl = infoBarEl.querySelector('.ib-turn');
  const actionWord = s.phase === 'deploy' ? 'place' : 'play';
  let statusText = '';
  if (s.isTerminal) {
    statusText = 'Game ended';
  } else if (pendingAction) {
    statusText = `${s.playerLabel} --- pending confirm`;
  } else {
    statusText = `${s.playerLabel} to ${actionWord}`;
  }
  turnEl.innerHTML = `<span class="turn-dot ${s.activePlayer}"></span> ${statusText}`;

  infoBarEl.querySelector('.ib-counter').textContent = `Turn ${s.counter}`;

  const doneEl = infoBarEl.querySelector('.ib-done');
  if (s.done) {
    doneEl.textContent = `${s.done} done`;
    doneEl.style.display = 'inline';
  } else {
    doneEl.style.display = 'none';
  }

  const resultEl = infoBarEl.querySelector('.ib-result');
  if (s.isTerminal) {
    resultEl.textContent = s.resultLabel || 'Game Over';
    resultEl.style.display = 'inline';
  } else {
    resultEl.style.display = 'none';
  }
}

/* ── Board ───────────────────────────────────────────────────────────── */

function renderBoard() {
  const s = serverState;
  const isDeploy = s.phase === 'deploy';
  const isTerminal = s.isTerminal;
  const activePlayer = s.activePlayer;
  const legalActions = s.legalActions || [];

  // Compute highlights
  const legalMoveDests = new Set();
  const legalArataDests = new Set();
  const legalPlacementDests = new Set();

  if (pendingAction || presenting) {
    // Show pending/presenting state --- no highlights
  } else if (selectedCell) {
    for (const a of legalActions) {
      if (a.kind === 'move' && a.origin.col === selectedCell.col && a.origin.row === selectedCell.row) {
        legalMoveDests.add(`${a.dest.col},${a.dest.row}`);
      }
    }
  } else if (selectedHandPiece) {
    for (const a of legalActions) {
      if (a.kind === 'arata' && a.piece === selectedHandPiece.type) {
        legalArataDests.add(`${a.dest.col},${a.dest.row}`);
      }
      if (a.kind === 'placement' && a.piece === selectedHandPiece.type) {
        legalPlacementDests.add(`${a.dest.col},${a.dest.row}`);
      }
    }
  }

  let html = '';

  // Column headers (col 9 -> col 1 left-to-right)
  for (let c = 9; c >= 1; c--) {
    html += `<div class="board-label">${c}</div>`;
  }
  html += '<div class="board-label corner"></div>';

  // Rows (row 1 = top)
  for (let r = 0; r < 9; r++) {
    const rowNum = r + 1;
    const rowData = s.board[r];

    for (let d = 0; d < 9; d++) {
      const cell = rowData[d];
      const displayCol = 9 - d; // d=0 -> col 9 (leftmost)
      const isOccupied = cell && cell.stack && cell.stack.length > 0;
      const topPiece = isOccupied ? cell.stack[cell.stack.length - 1] : null;
      const stackSize = isOccupied ? cell.stack.length : 0;

      const isLight = (rowNum + displayCol) % 2 === 0;
      let extraClass = isLight ? ' light' : ' dark';
      if (!isOccupied) extraClass += ' empty-cell';

      // Deploy zone (active player only, no piece required)
      if (isDeploy && !isTerminal && !pendingAction) {
        if ((activePlayer === 'white' && rowNum >= 7) || (activePlayer === 'black' && rowNum <= 3)) {
          extraClass += ' deploy-zone';
        }
      }

      // Pending action highlights (battle confirm flow)
      if (pendingAction) {
        const a = pendingAction;
        if (a.kind === 'move') {
          if (a.origin.col === displayCol && a.origin.row === rowNum) extraClass += ' pending-source';
          if (a.dest.col === displayCol && a.dest.row === rowNum) extraClass += ' pending-dest';
        }
        if ((a.kind === 'placement' || a.kind === 'arata') && a.dest.col === displayCol && a.dest.row === rowNum) {
          extraClass += ' pending-dest';
        }
      }

      // Legal target highlights
      const coordKey = `${displayCol},${rowNum}`;
      if (legalMoveDests.has(coordKey) || legalArataDests.has(coordKey) || legalPlacementDests.has(coordKey)) {
        extraClass += ' legal-target';
      }

      // Selected cell
      if (selectedCell && selectedCell.col === displayCol && selectedCell.row === rowNum) {
        extraClass += ' selected';
      }

      html += `<div class="cell${extraClass}" data-col="${displayCol}" data-row="${rowNum}">`;

      if (topPiece) {
        const level = stackSize;
        const imgUrl = assetUrl(topPiece.owner, topPiece.type, level);
        const letter = pieceLetter(topPiece);
        const imgId = `pi_${r}_${d}`;

        html += `<div class="piece-wrap">`;
        html += `<img id="${imgId}" src="${imgUrl}" alt="${letter}" title="${PIECE_LABELS[topPiece.type]}" onerror="this.style.display='none';document.getElementById('fb-${imgId}').style.display='flex'">`;
        html += `<span id="fb-${imgId}" class="piece-fallback" style="display:none;background:${topPiece.owner === 'white' ? '#f0e6d3' : '#2a1a0a'};color:${topPiece.owner === 'white' ? '#2a1a0a' : '#f0e6d3'}">${letter}</span>`;

        if (stackSize > 1) {
          html += `<span class="stack-badge">×${stackSize}</span>`;
        }

        // Pending indicator
        if (pendingAction) {
          const a = pendingAction;
          if ((a.kind === 'move' && a.dest.col === displayCol && a.dest.row === rowNum) ||
              (a.kind === 'placement' && a.dest.col === displayCol && a.dest.row === rowNum) ||
              (a.kind === 'arata' && a.dest.col === displayCol && a.dest.row === rowNum)) {
            html += `<span class="pending-indicator">PENDING</span>`;
          }
        }

        html += `</div>`;
      } else {
        // Show dot on legal target empty squares
        if (legalMoveDests.has(coordKey) || legalArataDests.has(coordKey) || legalPlacementDests.has(coordKey)) {
          html += `<div style="width:16px;height:16px;border-radius:50%;background:rgba(0,0,0,0.18);pointer-events:none;"></div>`;
        }
      }

      html += '</div>';
    }
    html += `<div class="board-label">${rowNum}</div>`;
  }

  boardEl.innerHTML = html;

  // Click handlers
  boardEl.querySelectorAll('.cell').forEach(el => {
    el.addEventListener('click', () => onCellClick(el));
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); onCellRightClick(e, el); });
  });
}

/* ── Board click handlers ───────────────────────────────────────────── */

async function onCellClick(el) {
  if (!serverState || serverState.isTerminal) return;
  if (pendingAction || presenting) return; // must confirm/undo first, or presentation running

  const col = parseInt(el.dataset.col);
  const row = parseInt(el.dataset.row);
  const legalActions = serverState.legalActions || [];

  const r = row - 1;
  const d = 9 - col;
  const cellData = serverState.board[r]?.[d];
  const topPiece = cellData?.stack?.length > 0 ? cellData.stack[cellData.stack.length - 1] : null;

  // === Deselect if clicking same cell ===
  if (selectedCell && selectedCell.col === col && selectedCell.row === row) {
    selectedCell = null;
    selectedHandPiece = null;
    renderAll();
    return;
  }

  // === Click on own piece -> select for move (battle only) ===
  if (serverState.phase === 'battle' && topPiece && topPiece.owner === serverState.activePlayer && !selectedCell && !selectedHandPiece) {
    selectedCell = { col, row };
    selectedHandPiece = null;
    renderAll();
    setStatus(`Selected ${PIECE_LABELS[topPiece.type]}`);
    return;
  }

  // === Move to destination (battle, selectedCell set) ===
  // Check this BEFORE selection-switch so friendly-stacking works.
  if (selectedCell && serverState.phase === 'battle') {
    const moves = legalActions.filter(a =>
      a.kind === 'move' &&
      a.origin.col === selectedCell.col && a.origin.row === selectedCell.row &&
      a.dest.col === col && a.dest.row === row
    );

    if (moves.length > 0) {
      // Legal move destination (empty, enemy, or friendly-stack) -> execute
      if (moves.length === 1) {
        await executeBattleAction(moves[0]);
        return;
      }
      // Multiple outcomes -> show choice popup
      const srcPiece = (() => {
        const sr = selectedCell.row - 1;
        const sd = 9 - selectedCell.col;
        const sc = serverState.board[sr]?.[sd];
        return sc?.stack?.[sc.stack.length - 1];
      })();
      const pn = srcPiece ? PIECE_LABELS[srcPiece.type] : 'Piece';
      showOutcomeChoice(moves, `${pn} ${selectedCell.col}-${selectedCell.row} -> ${col}-${row}`);
      return;
    }

    // Not a legal move dest. If clicking a friendly piece -> switch selection.
    if (topPiece && topPiece.owner === serverState.activePlayer) {
      selectedCell = { col, row };
      selectedHandPiece = null;
      renderAll();
      return;
    }

    // Otherwise deselect
    selectedCell = null;
    selectedHandPiece = null;
    renderAll();
    return;
  }

  // === Placement / Arata to destination (selectedHandPiece set) ===
  if (selectedHandPiece) {
    if (serverState.phase === 'deploy') {
      // Deploy placement
      const placements = legalActions.filter(a =>
        a.kind === 'placement' &&
        a.piece === selectedHandPiece.type &&
        a.dest.col === col && a.dest.row === row
      );

      if (placements.length === 0) {
        selectedHandPiece = null;
        renderAll();
        return;
      }

      // Deploy placements are always plain { kind:'placement', piece, dest };
      // declaring Done is a separate standalone action (the Done button).
      const chosen = placements[0];

      const ok = await doSendAction(chosen);
      if (ok) {
        selectedHandPiece = null;
        renderAll();
        setStatus(`Placed ${PIECE_LABELS[chosen.piece]}`);
      }
      return;
    }

    if (serverState.phase === 'battle') {
      // Battle arata/drop
      const aratas = legalActions.filter(a =>
        a.kind === 'arata' &&
        a.piece === selectedHandPiece.type &&
        a.dest.col === col && a.dest.row === row
      );

      if (aratas.length === 0) {
        selectedHandPiece = null;
        renderAll();
        return;
      }

      if (aratas.length === 1) {
        await executeBattleAction(aratas[0]);
        return;
      }

      // Multiple options (e.g. Captain turncoat choices)
      showOutcomeChoice(aratas, `Drop ${PIECE_LABELS[selectedHandPiece.type]} at ${col}-${row}`);
      return;
    }
  }

  // === Click elsewhere with selection -> deselect ===
  if (selectedCell || selectedHandPiece) {
    selectedCell = null;
    selectedHandPiece = null;
    renderAll();
  }
}

function onCellRightClick(e, el) {
  const col = parseInt(el.dataset.col);
  const row = parseInt(el.dataset.row);
  const r = row - 1;
  const d = 9 - col;
  const cellData = serverState?.board[r]?.[d];
  if (!cellData || !cellData.stack || cellData.stack.length <= 1) {
    stackPopupEl.classList.remove('visible');
    return;
  }

  const stack = cellData.stack;
  let html = `<div class="sp-title">Stack at ${col}-${row}</div>`;
  for (let i = stack.length - 1; i >= 0; i--) {
    const p = stack[i];
    const level = i + 1;
    const imgUrl = assetUrl(p.owner, p.type, level);
    const ownerLabel = p.owner === 'white' ? 'White' : 'Black';

    html += `<div class="sp-item">
      <img src="${imgUrl}" alt="${pieceLetter(p)}" onerror="this.style.display='none'">
      <span class="sp-label">${PIECE_LABELS[p.type]} (${ownerLabel})</span>
      <span class="sp-level">Lv ${level}</span>
    </div>`;
  }

  stackPopupEl.innerHTML = html;
  stackPopupEl.classList.add('visible');
  const rect = stackPopupEl.getBoundingClientRect();
  stackPopupEl.style.left = Math.max(10, Math.min(e.clientX, window.innerWidth - rect.width - 10)) + 'px';
  stackPopupEl.style.top = Math.max(10, Math.min(e.clientY, window.innerHeight - rect.height - 10)) + 'px';
}

/* ── Outcome Choice Popup (Capture vs Stack vs Turncoat) ─────────────── */

let _pendingChoices = null; // set when outcome chooser is active

function showOutcomeChoice(actions, sourceLabel) {
  const chooser = document.getElementById('outcome-chooser');
  _pendingChoices = actions;

  let html = `<div class="oc-title">${escapeHtml(sourceLabel)}</div>`;

  for (let i = 0; i < actions.length; i++) {
    const a = actions[i];
    let icon = '·', iconCls = 'null', label = '', sub = '';

    if (a.kind === 'move') {
      if (a.outcome === 'stack') {
        icon = 'S'; iconCls = 'stack'; label = 'Stack on top';
        sub = 'Land on top of the enemy stack';
      } else if (a.outcome === 'capture') {
        icon = 'C'; iconCls = 'capture'; label = 'Capture top piece';
        sub = 'Remove the enemy top piece';
      } else {
        icon = '->'; iconCls = 'null'; label = 'Move';
        sub = a.display ? a.display.replace(/^Move\s+\d+-\d+->\d+-\d+/, '').trim() : '';
      }
    } else if (a.kind === 'arata') {
      icon = '↓'; iconCls = 'null'; label = `Drop ${PIECE_LABELS[a.piece]}`;
      sub = a.display ? a.display.replace(/^Arata\s+\w+\s+\d+-\d+/, '').trim() : '';
    } else {
      icon = '·'; iconCls = 'null'; label = a.display || 'Action';
    }

    if (a.turncoat && a.turncoat.length > 0) {
      sub = (sub ? sub + ' · ' : '') + `Turncoat Lv${a.turncoat.join('/')}`;
    }

    html += `<div class="oc-option" data-oc-idx="${i}">
      <div class="oc-icon ${iconCls}">${icon}</div>
      <div class="oc-label">${label}<span class="oc-sub">${escapeHtml(sub)}</span></div>
    </div>`;
  }

  chooser.innerHTML = html;

  // Click handlers on options (bind before showing)
  const ocOptions = chooser.querySelectorAll('.oc-option');
  ocOptions.forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.ocIdx);
      chooser.classList.remove('visible');
      if (_pendingChoices && idx >= 0 && idx < _pendingChoices.length) {
        const chosen = _pendingChoices[idx];
        _pendingChoices = null;
        executeBattleAction(chosen);
      }
    });
  });

  // Defer showing to avoid the current click event's bubble from immediately
  // closing the chooser via the document outside-click handler.
  setTimeout(() => {
    chooser.classList.add('visible');

    // Position near the board center
    const boardRect = document.getElementById('board-frame').getBoundingClientRect();
    const chRect = chooser.getBoundingClientRect();
    chooser.style.left = Math.max(10, boardRect.left + (boardRect.width - chRect.width) / 2) + 'px';
    chooser.style.top = Math.max(10, boardRect.top + (boardRect.height - chRect.height) / 2) + 'px';
  }, 0);
}

function dismissOutcomeChooser() {
  const chooser = document.getElementById('outcome-chooser');
  chooser.classList.remove('visible');
  _pendingChoices = null;
}

// Close outcome chooser and stack popup on outside click
document.addEventListener('click', function (e) {
  if (stackPopupEl.classList.contains('visible') && !stackPopupEl.contains(e.target)) {
    stackPopupEl.classList.remove('visible');
  }
  const chooser = document.getElementById('outcome-chooser');
  if (chooser.classList.contains('visible') && !chooser.contains(e.target)) {
    chooser.classList.remove('visible');
    _pendingChoices = null;
    // Deselect to clean up state
    selectedCell = null;
    selectedHandPiece = null;
    renderAll();
  }
});

/* ── Hand Zones ─────────────────────────────────────────────────────── */

function renderHandZone(color) {
  const el = color === 'white' ? handWhiteEl : handBlackEl;
  const s = serverState;
  const hand = s.hands[color];
  const activePlayer = s.activePlayer;
  const isTerminal = s.isTerminal;

  const isActive = color === activePlayer;
  const colorLabel = color === 'white' ? 'White' : 'Black';

  const order = color === 'white' ? WHITE_HAND_ORDER : BLACK_HAND_ORDER;

  let html = `<div class="hand-title ${color}"><span class="hand-dot"></span> ${colorLabel}</div>`;
  html += `<div class="hand-grid">`;

  let hasPieces = false;
  for (const pt of order) {
    const count = hand[pt] || 0;
    if (count === 0) continue;
    hasPieces = true;

    const imgUrl = assetUrl(color, pt, 1);
    const isSelected = selectedHandPiece && selectedHandPiece.color === color && selectedHandPiece.type === pt;
    const canInteract = isActive && !isTerminal && !pendingAction;
    const disabled = !canInteract;

    // Additional deploy check: if player already done, don't allow placement
    const playerIsDone = s.phase === 'deploy' && s.done === color;

    html += `<div class="hand-piece${isSelected ? ' selected' : ''}${disabled || playerIsDone ? ' disabled' : ''}" data-color="${color}" data-type="${pt}">
      <img src="${imgUrl}" alt="${pt}" title="${PIECE_LABELS[pt]}" onerror="this.style.display='none'">
      <span class="hp-count">×${count}</span>
    </div>`;
  }

  html += `</div>`;

  if (!hasPieces) {
    html += `<div class="hand-empty">No pieces in hand</div>`;
  }

  el.innerHTML = html;

  // Click handlers
  if (!isTerminal && !pendingAction && !presenting) {
    el.querySelectorAll('.hand-piece:not(.disabled)').forEach(pieceEl => {
      pieceEl.addEventListener('click', () => {
        onHandPieceClick(pieceEl.dataset.color, pieceEl.dataset.type);
      });
    });
  }
}

function onHandPieceClick(color, type) {
  if (!serverState || serverState.isTerminal || pendingAction) return;
  if (color !== serverState.activePlayer) return;

  // Toggle selection
  if (selectedHandPiece && selectedHandPiece.color === color && selectedHandPiece.type === type) {
    selectedHandPiece = null;
    selectedCell = null;
    renderAll();
    return;
  }

  selectedHandPiece = { color, type };
  selectedCell = null;
  renderAll();

  if (serverState.phase === 'deploy') {
    setStatus(`Selected ${PIECE_LABELS[type]} --- click deploy zone`);
  } else {
    setStatus(`Selected ${PIECE_LABELS[type]} from hand --- click destination`);
  }
}

/* ── Battle action execution with confirm flow ──────────────────────── */

async function executeBattleAction(action) {
  // Don't send to server yet --- set pending so player must confirm first
  pendingAction = action;
  selectedCell = null;
  selectedHandPiece = null;
  renderAll();
  setStatus(`Confirm or undo this action`);
}

/* ── Confirm / Cancel flow ──────────────────────────────────────────── */

async function onConfirm() {
  if (!pendingAction) return;
  const action = pendingAction;

  let result;
  try {
    result = await sendAction(action);
  } catch (e) {
    // Network/parse failure (or a server-side rejection thrown by api()):
    // keep the action pending so the player can retry or cancel.
    setStatus('Failed to send action' + (e?.message ? ': ' + e.message : ''), true);
    renderAll();
    return;
  }

  if (result.error) {
    // Defensive: the server normally rejects with a non-2xx status instead.
    pendingAction = null;
    setStatus('Error: ' + result.error, true);
    renderAll();
    return;
  }

  // Only clear the pending action once the server accepted it.
  pendingAction = null;
  serverState = result;
  currentViewIndex = serverState.currentIndex;
  selectedCell = null;
  selectedHandPiece = null;
  renderAll();
}

function onCancelUndo() {
  if (!pendingAction) return;
  pendingAction = null;
  selectedCell = null;
  selectedHandPiece = null;
  renderAll();
  setStatus('Cancelled');
}

/* ── Presentation Mode ───────────────────────────────────────────────── */

async function startPresentation() {
  const input = document.getElementById('present-input');
  const ganString = input?.value?.trim();
  if (!ganString) { setStatus('Enter GAN actions separated by |', true); return; }

  const gans = ganString.split('|').map(s => s.trim()).filter(s => s.length > 0);
  if (gans.length === 0) { setStatus('No GAN actions found', true); return; }

  presenting = true;
  selectedCell = null;
  selectedHandPiece = null;
  pendingAction = null;
  renderAll();
  setStatus(`Presenting ${gans.length} actions…`);

  let aborted = false;
  let failed = false;
  presentAbort = () => { aborted = true; };

  try {
    for (let i = 0; i < gans.length; i++) {
      if (aborted || serverState?.isTerminal) break;

      setStatus(`Presenting ${i + 1}/${gans.length}: ${gans[i]}`);

      const result = await applyGAN(gans[i]);
      // Stop may have been pressed while the request was in flight: never
      // commit (or render) an action the user tried to abort.
      if (aborted) break;

      if (result.error) {
        setStatus(`Presentation stopped at action ${i + 1}: ${result.error}`, true);
        break;
      }

      serverState = result;
      currentViewIndex = serverState.currentIndex;
      renderAll();

      if (serverState.isTerminal) {
        setStatus('Game ended --- presentation complete');
        break;
      }

      // Wait 1 second between actions (skip wait after last)
      if (i < gans.length - 1 && !aborted) {
        await new Promise(r => { const t = setTimeout(r, 1000); presentAbort = () => { clearTimeout(t); aborted = true; r(); }; });
        if (aborted) break;
      }
    }
  } catch (e) {
    // Network failure etc.: surface the error instead of leaving the UI stuck
    // in "presenting" mode (the finally below always resets the state).
    failed = true;
    setStatus('Presentation failed' + (e?.message ? ': ' + e.message : ''), true);
  } finally {
    presenting = false;
    presentAbort = null;
    if (!aborted && !failed && !serverState?.isTerminal) setStatus('Presentation complete');
    renderAll();
  }
}

function stopPresentation() {
  if (presentAbort) presentAbort();
}

/* ── Done button (deploy phase) ──────────────────────────────────────── */

async function onDeployDone() {
  if (!serverState || serverState.phase !== 'deploy' || serverState.isTerminal) return;
  if (pendingAction || presenting) return;

  // No-op if this player has already declared done. (The engine enforces
  // that the declaring player's Marshal is on the board before accepting.)
  if (serverState.done === serverState.activePlayer) return;

  selectedHandPiece = null;
  selectedCell = null;

  // Declare Done immediately via the normal action endpoint.
  const ok = await doSendAction({ kind: 'done' });
  if (ok) {
    renderAll();
    setStatus('Done declared --- turn passed');
  }
}

/* ── Move List ───────────────────────────────────────────────────────── */

function renderMoveList() {
  const s = serverState;
  const history = s.history || [];
  const currentIdx = s.currentIndex;

  let html = `<div class="ml-header">
    <span>Moves</span>
  </div>`;

  html += '<div class="ml-body">';

  if (history.length <= 1) {
    html += '<div style="color:#666;font-style:italic;padding:12px;text-align:center;font-size:12px;">Game started</div>';
  } else {
    // Turn attribution. The server reports the acting player on every history
    // entry (entry.player), so use it directly. The simulated tracker below
    // is only a fallback for entries that predate that field: battle strictly
    // alternates, and in deploy a player who declared done ('!') is skipped.
    let whiteDone = false;
    let blackDone = false;
    let isWhiteTurn = true;       // first action is always White
    let inBattle = false;

    for (let i = 1; i < history.length; i++) {
      const entry = history[i];
      const actionGAN = entry.actionGAN || '';

      // Battle actions are moves/arata: GAN contains '>' (move) or '*' (arata).
      // Placements (e.g. 'M5-9') and standalone Done ('!') are deploy actions.
      const isBattleAction = actionGAN.includes('>') || actionGAN.includes('*');

      // Transition from deploy to battle
      if (isBattleAction && !inBattle) {
        inBattle = true;
        html += '<div class="ml-sep"><span>Battle</span></div>';
        isWhiteTurn = true; // first battle action is always White
      }

      const isCurrent = i === currentIdx;
      const displayLabel = actionGAN || '---';
      const isDone = actionGAN === '!';

      // Attribution: trust the server-provided acting player when present;
      // otherwise fall back to the simulated turn tracker.
      const hasPlayer = entry.player === 'white' || entry.player === 'black';
      const whiteTurn = hasPlayer ? entry.player === 'white' : isWhiteTurn;

      if (whiteTurn) {
        html += `<div class="ml-turn${isCurrent ? ' current' : ''}">
          <span class="ml-tnum">${i}</span>
          <span class="ml-move${inBattle ? '' : ' ml-deploy'}${isCurrent ? ' ml-cur' : ''}" data-hi="${i}">${escapeHtml(displayLabel)}</span>
          <span class="ml-move"></span>
        </div>`;
      } else {
        html += `<div class="ml-turn${isCurrent ? ' current' : ''}">
          <span class="ml-tnum">${i}</span>
          <span class="ml-move"></span>
          <span class="ml-move${inBattle ? '' : ' ml-deploy'}${isCurrent ? ' ml-cur' : ''}" data-hi="${i}">${escapeHtml(displayLabel)}</span>
        </div>`;
      }

      // Advance the fallback tracker only when the server gave no player.
      if (!hasPlayer) {
        if (inBattle) {
          isWhiteTurn = !whiteTurn; // strict alternation in battle
        } else {
          if (isDone) {
            if (whiteTurn) whiteDone = true; else blackDone = true;
          }
          isWhiteTurn = whiteTurn ? blackDone : !whiteDone; // skip done players
        }
      }
    }
  }

  html += '</div>';

  moveListEl.innerHTML = html;

  // Click handlers for history navigation
  moveListEl.querySelectorAll('.ml-move[data-hi]').forEach(el => {
    el.addEventListener('click', () => {
      if (presenting) return;
      const idx = parseInt(el.dataset.hi);
      if (!isNaN(idx) && idx !== currentIdx) navigateToHistory(idx);
    });
  });

  // Scroll to current
  const cur = moveListEl.querySelector('.ml-cur');
  if (cur) cur.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

async function navigateToHistory(index) {
  if (pendingAction) {
    await onCancelUndo();
  }
  selectedCell = null;
  selectedHandPiece = null;
  await doGotoHistory(index);
}

/* ── Controls ────────────────────────────────────────────────────────── */

function renderControls() {
  const s = serverState;
  const isTerminal = s.isTerminal;
  const isDeploy = s.phase === 'deploy';
  const isViewingPast = currentViewIndex < (s.historySize || s.history.length) - 1;
  let html = '';

  if (presenting) {
    html = `
      <div style="display:flex;align-items:center;gap:8px;width:100%;padding:4px">
        <span style="color:var(--bg-cell-legal);font-size:11px;font-weight:600;">▶ Presenting…</span>
        <button class="ctrl-btn resign" id="btn-stop-present" style="flex:0;padding:4px 12px;">⏹ Stop</button>
      </div>
    `;
  } else if (pendingAction) {
    // Confirm mode --- battle phase pending action
    html = `
      <button class="ctrl-btn confirm" id="btn-confirm">✓ Confirm</button>
      <button class="ctrl-btn undo" id="btn-cancel" style="flex:1;">↩ Undo</button>
    `;
  } else if (isTerminal) {
    html = `
      <button class="ctrl-btn newgame" id="btn-newgame" style="flex:2;">⟳ New Game</button>
    `;
  } else if (isDeploy) {
    // Deploy phase --- Done is a standalone action, always available
    const playerDone = s.done === s.activePlayer;
    const canInteract = !isViewingPast && !playerDone;

    html = `
      <button class="ctrl-btn done" id="btn-done" ${canInteract ? '' : 'disabled'}>✓ Done</button>
      <button class="ctrl-btn undo" id="btn-undo" ${s.canUndo && !isViewingPast ? '' : 'disabled'}>↩ Undo</button>
      <button class="ctrl-btn newgame" id="btn-newgame">⟳ New</button>
    `;
  } else {
    // Battle phase controls (no pending action)
    html = `
      <button class="ctrl-btn undo" id="btn-undo" ${s.canUndo && !isViewingPast ? '' : 'disabled'}>↩ Undo</button>
      <button class="ctrl-btn resign" id="btn-resign" ${isViewingPast ? 'disabled' : ''}>⚑ Resign</button>
      <button class="ctrl-btn newgame" id="btn-newgame">⟳ New</button>
    `;
  }

  // Present input row (shown when not presenting/pending/terminal)
  if (!presenting && !pendingAction && !isTerminal) {
    html += `
      <div style="display:flex;gap:4px;width:100%;margin-top:4px;border-top:1px solid var(--border-color);padding-top:6px;">
        <input type="text" id="present-input" placeholder="GAN actions: M5-8|M5-2|F4-8..." style="flex:1;background:#0d1b2a;border:1px solid var(--border-color);border-radius:var(--radius);padding:6px 8px;color:var(--color-text);font-size:11px;font-family:monospace;outline:none;">
        <button class="ctrl-btn confirm" id="btn-present" style="flex:0;padding:6px 12px;font-size:11px;">▶ Play</button>
      </div>
    `;
  }

  controlsEl.innerHTML = html;

  // Bind buttons
  const bind = (id, handler) => {
    const el = document.getElementById(id);
    if (el && !el.disabled) el.addEventListener('click', handler);
  };

  bind('btn-done', onDeployDone);
  bind('btn-undo', async () => {
    if (pendingAction || presenting) return;
    if (selectedCell || selectedHandPiece) {
      selectedCell = null;
      selectedHandPiece = null;
      renderAll();
      return;
    }
    const ok = await doUndo();
    if (ok) { selectedCell = null; selectedHandPiece = null; renderAll(); }
  });
  bind('btn-resign', onResign);
  bind('btn-newgame', showNewGameDialog);
  bind('btn-confirm', onConfirm);
  bind('btn-cancel', onCancelUndo);
  bind('btn-present', startPresentation);
  bind('btn-stop-present', stopPresentation);
}

/* ── Resign ──────────────────────────────────────────────────────────── */

function onResign() {
  if (!serverState || serverState.isTerminal || pendingAction || presenting) return;
  const active = serverState.activePlayer;
  const loser = active === 'white' ? 'White' : 'Black';
  const winner = active === 'white' ? 'Black' : 'White';
  showGameOver(`${loser} resigns`, `${winner} wins`);
}

/* ── Game Over ───────────────────────────────────────────────────────── */

function renderGameOver() {
  if (!serverState || !serverState.isTerminal) {
    gameOverEl.classList.remove('visible');
    return;
  }

  const resultLabel = serverState.resultLabel || '';
  let title, subtitle;

  if (resultLabel.includes('Draw')) {
    title = 'Draw';
    subtitle = resultLabel;
  } else if (resultLabel.includes('wins') || resultLabel.includes('loses')) {
    title = resultLabel;
    subtitle = '';
  } else {
    title = 'Game Over';
    subtitle = resultLabel;
  }

  gameOverEl.classList.add('visible');
  gameOverEl.querySelector('.go-box').innerHTML = `
    <h2 class="${title.includes('Draw') ? 'draw' : 'win'}">${escapeHtml(title)}</h2>
    ${subtitle ? `<div class="go-sub">${escapeHtml(subtitle)}</div>` : ''}
    <button class="go-btn" id="go-newgame-btn">New Game</button>
  `;
  document.getElementById('go-newgame-btn').addEventListener('click', () => {
    gameOverEl.classList.remove('visible');
    showNewGameDialog();
  });
}

function showGameOver(title, subtitle) {
  gameOverEl.classList.add('visible');
  gameOverEl.querySelector('.go-box').innerHTML = `
    <h2 class="lose">${escapeHtml(title)}</h2>
    ${subtitle ? `<div class="go-sub">${escapeHtml(subtitle)}</div>` : ''}
    <button class="go-btn" id="go-newgame-btn">New Game</button>
  `;
  document.getElementById('go-newgame-btn').addEventListener('click', () => {
    gameOverEl.classList.remove('visible');
    showNewGameDialog();
  });
}

/* ── New Game Dialog ─────────────────────────────────────────────────── */

function showNewGameDialog() {
  $('newgame-dialog').classList.add('visible');
}

function closeNewGameDialog() {
  $('newgame-dialog').classList.remove('visible');
}

async function confirmNewGame() {
  const input = $('newgame-dialog').querySelector('input').value.trim();
  closeNewGameDialog();
  pendingAction = null;
  await doReset(input || undefined);
}

/* ── Keyboard Shortcuts ─────────────────────────────────────────────── */

document.addEventListener('keydown', function (e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    if (e.key === 'Escape') closeNewGameDialog();
    return;
  }

  // Outcome chooser dismiss
  const ocVisible = document.getElementById('outcome-chooser')?.classList.contains('visible');

  switch (e.key) {
    case 'Enter':
      if (pendingAction) { onConfirm(); e.preventDefault(); }
      break;
    case 'Escape':
      if (ocVisible) { dismissOutcomeChooser(); selectedCell = null; selectedHandPiece = null; renderAll(); e.preventDefault(); }
      else if (pendingAction) { onCancelUndo(); e.preventDefault(); }
      else if (selectedCell || selectedHandPiece) {
        selectedCell = null; selectedHandPiece = null; renderAll(); e.preventDefault();
      }
      break;
    case 'z': case 'Z':
      if (!pendingAction) {
        doUndo().then(ok => { if (ok) { selectedCell = null; selectedHandPiece = null; renderAll(); } });
      }
      e.preventDefault();
      break;
    case 'u': case 'U':
      if (pendingAction) { onCancelUndo(); e.preventDefault(); }
      break;
  }
});

/* ── Dialog event bindings ───────────────────────────────────────────── */

$('ng-cancel').addEventListener('click', closeNewGameDialog);
$('ng-confirm').addEventListener('click', confirmNewGame);

/* ── Initialization ──────────────────────────────────────────────────── */

async function init() {
  await refreshState();
}

init().catch(e => {
  console.error('Init failed:', e);
  document.body.innerHTML = `<div style="padding:40px;text-align:center;color:#e94560;">
    <h2>Failed to connect to server</h2>
    <p style="color:#888;margin-top:8px;">Make sure the server is running on port 3030</p>
  </div>`;
});
