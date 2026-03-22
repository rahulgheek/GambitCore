// ============================================================
// AUTHORITATIVE DUMB CLIENT (EVALUATION II COMPLIANT)
// ============================================================

const pathParts = window.location.pathname.split('/');
const isOnline = pathParts[1] === 'play';
const partyCode = isOnline ? pathParts[2] : null;

const urlParams = new URLSearchParams(window.location.search);
const requestedTime = parseInt(urlParams.get('time')) || 10;
let pendingPromoMove = null;

let socket;
let myRole = 'spectator';
let boardFlipped = false;
let currentTurn = 'w';
let isGameOver = false;
let kingInCheckAlg = null;

// UI & Memory State
let localBoard = Array(8).fill(null).map(() => Array(8).fill(null));
let selectedSquareAlg = null; 
let legalDestinations = [];   
let moveHistory = [];
let historyFens = [];
let viewIdx = -1; // -1 means viewing the LIVE game

// Master Timers
let serverTimers = { w: 600000, b: 600000 };
let lastTickTime = Date.now();
let clockInterval;

const FILES = 'abcdefgh';

// --- UTILS ---
function algToRC(sq) { return { r: 8 - parseInt(sq[1]), c: FILES.indexOf(sq[0]) }; }
function rcToAlg(r, c) { return FILES[c] + (8 - r); }
function fenToBoardArray(fen) {
    const rows = fen.split(' ')[0].split('/');
    const board = [];
    for (let r of rows) {
        const boardRow = [];
        for (let char of r) {
            if (!isNaN(char)) {
                for (let i = 0; i < parseInt(char); i++) boardRow.push(null);
            } else {
                boardRow.push((char === char.toUpperCase() ? 'w' : 'b') + char.toUpperCase());
            }
        }
        board.push(boardRow);
    }
    return board;
}

// ⚡ THE SNIPER BULLET ⚡
function shootProjectile(attackerAlg, targetAlg) {
    const attackerSq = document.querySelector(`[data-alg="${attackerAlg}"]`);
    const targetSq = document.querySelector(`[data-alg="${targetAlg}"]`);
    if (!attackerSq || !targetSq) return;

    const aRect = attackerSq.getBoundingClientRect();
    const tRect = targetSq.getBoundingClientRect();
    const startX = aRect.left + window.scrollX + aRect.width / 2;
    const startY = aRect.top + window.scrollY + aRect.height / 2;
    const endX = tRect.left + window.scrollX + tRect.width / 2;
    const endY = tRect.top + window.scrollY + tRect.height / 2;

    const bullet = document.createElement('div');
    bullet.style.position = 'absolute';
    bullet.style.left = startX + 'px';
    bullet.style.top = startY + 'px';
    
    // Sleek, high-speed tracer round
    bullet.style.width = '45px';
    bullet.style.height = '4px';
    bullet.style.background = 'linear-gradient(90deg, transparent, #ffea00, #ffffff)';
    bullet.style.borderRadius = '2px';
    bullet.style.pointerEvents = 'none';
    bullet.style.zIndex = '999999';
    bullet.style.boxShadow = '0 0 8px #ffffff, 0 0 15px #ffea00';
    bullet.style.willChange = 'transform';
    
    const angle = Math.atan2(endY - startY, endX - startX) * (180 / Math.PI);
    bullet.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
    
    // Extremely fast flight time (0.15s)
    bullet.style.transition = 'transform 0.15s cubic-bezier(0.4, 0, 1, 1)'; 
    
    document.body.appendChild(bullet);

    const deltaX = endX - startX;
    const deltaY = endY - startY;

    // Fire the bullet
    requestAnimationFrame(() => {
        bullet.style.transform = `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px)) rotate(${angle}deg)`;
    });

    // The precise millisecond it hits: delete bullet, apply cracks, and shake!
    setTimeout(() => {
        bullet.remove();
        
        targetSq.classList.add('checkmate-flash');
        
        const boardEl = document.getElementById('board');
        if (boardEl) {
            boardEl.classList.remove('board-shake');
            void boardEl.offsetWidth; // Force browser to reset the animation
            boardEl.classList.add('board-shake');
        }
    }, 150); // Matches the 0.15s flight time perfectly
}

// --- INITIALIZATION ---
if (isOnline) {
    socket = io();
    document.getElementById('room-code-display').textContent = partyCode;
    document.getElementById('waiting-modal').classList.remove('hidden');

    socket.emit('join_party', { code: partyCode, username: myUsername,timeControl: requestedTime });

    socket.on('role_assigned', (role) => {
        myRole = role;
        boardFlipped = (role === 'b');
        flipLayout(); // Instantly flip the names, avatars, and timers!
    });

    socket.on('game_sync', (data) => {
        document.getElementById('waiting-modal').classList.add('hidden');
        document.getElementById('reconnect-modal').classList.add('hidden'); 
        
        currentTurn = data.turn;
        isGameOver = data.gameOver;
        kingInCheckAlg = data.inCheckSquare || null;
        serverTimers = data.timers;
        moveHistory = data.history || [];
        historyFens = data.fens || [];
        
        // Snap view index back to live whenever a new move is made
        viewIdx = -1; 

        if (!isGameOver) serverTimers[currentTurn] -= data.elapsed;
        lastTickTime = Date.now();

        if (data.whiteName) document.getElementById('white-player-name').innerText = data.whiteName;
        if (data.blackName) document.getElementById('black-player-name').innerText = data.blackName;

        localBoard = fenToBoardArray(data.fen);
        selectedSquareAlg = null;
        legalDestinations = [];
        
        renderBoard();
        renderMoveList();
        startClock();

        if (isGameOver) {
            const banner = document.getElementById('win-banner');
            const title = document.getElementById('win-title');
            const sub = document.getElementById('win-sub');
            document.getElementById('result-card').classList.remove('hidden');

            // Fallback: If your server doesn't send winner info in game_sync, we guess from the last move!
            const lastMove = moveHistory[moveHistory.length - 1];
            if (lastMove && lastMove.endsWith('#')) {
                // If it's an odd number of moves, White delivered checkmate. If even, Black did.
                const winner = (moveHistory.length % 2 !== 0) ? 
                    document.getElementById('white-player-name').innerText : 
                    document.getElementById('black-player-name').innerText;
                
                title.textContent = `${winner} Wins!`;
                sub.textContent = "by Checkmate";
                banner.classList.remove('draw');
            } else {
                title.textContent = "Game Over";
                sub.textContent = "Match Concluded";
            }
        } else {
            // Ensure the card is hidden if we are playing a live game
            document.getElementById('result-card').classList.add('hidden');
        }
    });

    socket.on('rematch_requested', () => {
        const btn = document.getElementById('btn-rematch');
        if (btn) {
            btn.textContent = "Accept Rematch";
            btn.style.background = "#2ecc71"; // Turn it green!
            btn.style.opacity = "1";
            btn.style.pointerEvents = "auto";
            
            // Temporarily override the click handler to accept
            btn.onclick = () => {
                socket.emit('accept_rematch');
            };
        }
    });

    socket.on('rematch_accepted', () => {
        // 1. Reset the button UI back to default
        const btn = document.getElementById('btn-rematch');
        if (btn) {
            btn.textContent = "Request Rematch";
            btn.style.background = "rgba(255,255,255,0.2)";
            btn.style.opacity = "1";
            btn.style.pointerEvents = "auto";
            btn.onclick = null; // Remove the temporary accept handler
        }
        
        // 2. Hide the Game Over screen!
        document.getElementById('result-card').classList.add('hidden');
        
        // (The server will immediately follow this up with a game_sync to reset the pieces)
    });

    socket.on('legal_moves_reply', (moves) => {
        legalDestinations = moves.map(m => m.to);
        renderBoard(); 
    });

    // --- GAME OVER LISTENER ---
socket.on('game_over', (data) => {
    isGameOver = true;
    clearInterval(clockInterval);
    document.getElementById('reconnect-modal').classList.add('hidden');
    
    // 🚨 TRIGGER THE BULLET ON CHECKMATE
    if (data.reason === 'checkmate') {
        const loserColor = data.winnerColor === 'w' ? 'b' : 'w';
        kingInCheckAlg = findKingSquare(loserColor);
        
        // Robust Regex to find the attacker's destination square from SAN (e.g., Qh4#, exf8=Q#)
        const lastMove = moveHistory[moveHistory.length - 1];
        const match = lastMove ? lastMove.match(/([a-h][1-8])(?:=[QRBN])?[+#]?$/) : null;
        const attackerAlg = match ? match[1] : null;

        renderBoard(); // Draw the pieces in their final position first

        // Fire the gun a split second later for dramatic effect
        if (attackerAlg && kingInCheckAlg) {
            setTimeout(() => {
                shootProjectile(attackerAlg, kingInCheckAlg);
            }, 100);
        } else {
            const target = document.querySelector(`[data-alg="${kingInCheckAlg}"]`);
            if (target) target.classList.add('checkmate-flash');
        }
    }

    const banner = document.getElementById('win-banner');
    const title = document.getElementById('win-title');
    const sub = document.getElementById('win-sub');
    document.getElementById('result-card').classList.remove('hidden');

    if (data.reason === 'draw') {
        title.textContent = "Draw";
        sub.textContent = "It's a tie!";
        banner.classList.add('draw');
    } else {
        title.textContent = `${data.winnerName} wins!`;
        sub.textContent = data.reason === 'abandonment' ? "Opponent abandoned the match" : `by ${data.reason}`;
        banner.classList.remove('draw');
    }
});

    socket.on('opponent_disconnected', () => {
        document.getElementById('reconnect-modal').classList.remove('hidden');
        let timeLeft = 60;
        const interval = setInterval(() => {
            timeLeft--;
            document.getElementById('reconnect-timer').innerText = timeLeft;
            if (timeLeft <= 0 || isGameOver) clearInterval(interval);
        }, 1000);
    });
}

// --- CSS TRICK TO FLIP LAYOUT ---
function flipLayout() {
    const bars = document.querySelectorAll('.player-bar');
    const boardOuter = document.querySelector('.board-outer');
    const boardSection = document.querySelector('.board-section');

    // This dynamically flips the top and bottom containers without changing your HTML!
    if (boardSection && bars.length === 2) {
        boardSection.style.display = 'flex';
        boardSection.style.flexDirection = 'column';
        if (boardFlipped) {
            bars[0].style.order = 3; // Moves Black bar to the bottom
            boardOuter.style.order = 2;
            bars[1].style.order = 1; // Moves White bar to the top
        } else {
            bars[0].style.order = 1;
            boardOuter.style.order = 2;
            bars[1].style.order = 3;
        }
    }
}

// ⚡ THE BULLET ANIMATION ⚡

// --- HISTORY & REWIND LOGIC ---
// --- HISTORY & REWIND LOGIC ---
function renderMoveList() {
    const list = document.getElementById('move-list');
    if (!list) return;
    list.innerHTML = '';

    for (let i = 0; i < moveHistory.length; i += 2) {
        const row = document.createElement('div');
        row.className = 'move-row';

        const num = document.createElement('div');
        num.className = 'move-number';
        num.textContent = `${Math.floor(i / 2) + 1}.`;
        row.appendChild(num);

        for (let j = 0; j <= 1; j++) {
            const moveIdx = i + j;
            const m = moveHistory[moveIdx];
            const moveEl = document.createElement('div');

            if (m) {
                const fenIdx = moveIdx + 1; // Syncing SAN index with FEN index
                
                // Active if viewing this exact move, OR if live and it's the latest move
                const isActive = (viewIdx !== -1 && viewIdx === fenIdx) || (viewIdx === -1 && moveIdx === moveHistory.length - 1);
                
                moveEl.className = 'move-san' + (isActive ? ' active' : '');
                moveEl.textContent = m;
                moveEl.addEventListener('click', () => navigateTo(fenIdx));
            } else {
                moveEl.className = 'move-san empty';
            }
            row.appendChild(moveEl);
        }
        list.appendChild(row);
    }
    
    // Smooth auto-scroll
    setTimeout(() => {
        const active = list.querySelector('.move-san.active');
        if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 10);
}

function navigateTo(idx) {
    // 1. Boundary Logic
    if (idx === -1 || idx >= historyFens.length - 1) {
        viewIdx = -1; // Snap to Live
    } else if (idx <= 0) {
        viewIdx = 0;  // Snap to Start
    } else {
        viewIdx = idx;
    }
    
    // 2. State Sync
    const fenToRender = viewIdx === -1 ? historyFens[historyFens.length - 1] : historyFens[viewIdx];
    localBoard = fenToBoardArray(fenToRender);
    
    selectedSquareAlg = null;
    legalDestinations = [];
    
    // 3. UX Toggle
    const goLiveBtn = document.getElementById('go-live-btn');
    const statusBar = document.getElementById('status-bar');
    
    if (viewIdx !== -1) {
        document.querySelector('.board-section').style.opacity = '0.85'; // Dim board
        statusBar.innerHTML = `<span style="color:#f39c12; font-weight:bold;">Analysis Mode</span>`;
        if(goLiveBtn) goLiveBtn.classList.remove('hidden');
    } else {
        document.querySelector('.board-section').style.opacity = '1';
        statusBar.innerHTML = `<div class="status-dot"></div> ${currentTurn === 'w' ? 'White' : 'Black'}'s Turn`;
        if(goLiveBtn) goLiveBtn.classList.add('hidden');
    }

    renderBoard();
    renderMoveList();
}

// 4. Correctly Mapped Nav Buttons
document.getElementById('btn-first')?.addEventListener('click', () => navigateTo(0));
document.getElementById('btn-prev')?.addEventListener('click', () => {
    if (viewIdx === 0) return; // Block going past start
    navigateTo(viewIdx === -1 ? historyFens.length - 2 : viewIdx - 1);
});
document.getElementById('btn-next')?.addEventListener('click', () => {
    if (viewIdx === -1) return; // Block going past live
    navigateTo(viewIdx + 1);
});
document.getElementById('btn-last')?.addEventListener('click', () => navigateTo(-1));

// --- CLOCK LOGIC ---
// --- CLOCK LOGIC ---
function startClock() {
    clearInterval(clockInterval);
    clockInterval = setInterval(() => {
        if (isGameOver) return clearInterval(clockInterval);
        
        const now = Date.now();
        const diff = now - lastTickTime;
        serverTimers[currentTurn] -= diff;
        lastTickTime = now;

        const formatTime = (ms) => {
            let totalSeconds = Math.max(0, Math.floor(ms / 1000));
            let m = Math.floor(totalSeconds / 60);
            let s = totalSeconds % 60;
            return `${m}:${s.toString().padStart(2, '0')}`;
        };

        document.getElementById('clock-white').innerText = formatTime(serverTimers.w);
        document.getElementById('clock-black').innerText = formatTime(serverTimers.b);

        if (serverTimers[currentTurn] <= 0 && !isGameOver) {
            isGameOver = true;
            clearInterval(clockInterval);
            
            // Show the result card
            document.getElementById('result-card').classList.remove('hidden');
            const banner = document.getElementById('win-banner');
            const title = document.getElementById('win-title');
            const sub = document.getElementById('win-sub');
            
            // If White's clock ran out, Black wins. If Black's ran out, White wins.
            const winnerName = currentTurn === 'w' ? 
                document.getElementById('black-player-name').innerText : 
                document.getElementById('white-player-name').innerText;
                
            title.textContent = `${winnerName} Wins!`;
            sub.textContent = "by Timeout";
            banner.classList.remove('draw');
            socket.emit('timeout'); 
        }

    }, 100); 
}

// --- CAPTURED PIECES TRACKER ---
function renderCaptures() {
    // 1. Standard starting pieces
    const startCounts = { 'Q': 1, 'R': 2, 'B': 2, 'N': 2, 'P': 8 };
    const currentCounts = { w: { 'Q':0, 'R':0, 'B':0, 'N':0, 'P':0 }, b: { 'Q':0, 'R':0, 'B':0, 'N':0, 'P':0 } };
    
    // 2. Scan the current board and count what is still alive
    for(let r=0; r<8; r++) {
        for(let c=0; c<8; c++) {
            const p = localBoard[r][c]; 
            if(p) currentCounts[p[0]][p[1]]++;
        }
    }

    let capturedByWhite = []; // Black pieces missing
    let capturedByBlack = []; // White pieces missing
    const pieceValues = { 'Q': 9, 'R': 5, 'B': 3, 'N': 3, 'P': 1 };
    let whiteScore = 0; let blackScore = 0;

    // 3. Find the missing pieces
    for (let pt in startCounts) {
        let missingBlack = startCounts[pt] - currentCounts.b[pt];
        for(let i=0; i<missingBlack; i++) {
            capturedByWhite.push('b' + pt);
            whiteScore += pieceValues[pt];
        }
        let missingWhite = startCounts[pt] - currentCounts.w[pt];
        for(let i=0; i<missingWhite; i++) {
            capturedByBlack.push('w' + pt);
            blackScore += pieceValues[pt];
        }
    }

    // Unicode icons for the captured graveyard
    const unicodes = {
        'wQ':'♕', 'wR':'♖', 'wB':'♗', 'wN':'♘', 'wP':'♙',
        'bQ':'♛', 'bR':'♜', 'bB':'♝', 'bN':'♞', 'bP':'♟'
    };
    
    // 4. Inject into the DOM
    const wCapEl = document.getElementById('captured-by-white');
    const bCapEl = document.getElementById('captured-by-black');
    if(wCapEl) wCapEl.textContent = capturedByWhite.map(p => unicodes[p]).join('');
    if(bCapEl) bCapEl.textContent = capturedByBlack.map(p => unicodes[p]).join('');

    // 5. Show the +1, +3 advantage score
    const diff = whiteScore - blackScore;
    const wScoreEl = document.getElementById('score-white');
    const bScoreEl = document.getElementById('score-black');
    if(wScoreEl) wScoreEl.textContent = diff > 0 ? `+${diff}` : '';
    if(bScoreEl) bScoreEl.textContent = diff < 0 ? `+${Math.abs(diff)}` : '';
}

let lastFiredMove = -1;
function renderBoard() {
    const el = document.getElementById('board');
    el.innerHTML = '';

    // 🚨 NEW: DYNAMIC CHECK DETECTION USING SAN NOTATION 🚨
    let kingInCheckAlg = null;
    let isCheckmate = false;
    let captureSquareAlg = null;
    
    // Look at the most recent move played in the current view
    const lastMoveIdx = viewIdx === -1 ? moveHistory.length - 1 : viewIdx - 1;
    const lastMove = moveHistory[lastMoveIdx];

    // If the last move has a '+' (Check) or '#' (Checkmate)
    if (lastMove && (lastMove.endsWith('+') || lastMove.endsWith('#'))) {
        // Even index means White moved, so Black's King is in check. Odd means White is in check.
        const kingColor = (lastMoveIdx % 2 === 0) ? 'b' : 'w'; 
        if (lastMove.endsWith('#')) isCheckmate = true;

        // Find that King's square on the board
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (localBoard[r][c] === kingColor + 'K') {
                    kingInCheckAlg = rcToAlg(r, c);
                }
            }
        }
    }

    // DRAW THE SQUARES
    for (let ri = 0; ri < 8; ri++) {
        for (let ci = 0; ci < 8; ci++) {
            const r = boardFlipped ? 7 - ri : ri;
            const c = boardFlipped ? 7 - ci : ci;
            const algSq = rcToAlg(r, c);
            const isLight = (r + c) % 2 === 0;

            const sq = document.createElement('div');
            sq.className = 'square ' + (isLight ? 'light' : 'dark');
            sq.dataset.alg = algSq;

            if (selectedSquareAlg === algSq) sq.classList.add('selected');
            if (legalDestinations.includes(algSq)) {
                sq.classList.add(localBoard[r][c] ? 'can-capture' : 'can-move');
            }

            // 🚨 APPLY THE RED GLOW TO THE KING'S SQUARE 🚨
            if (kingInCheckAlg === algSq) {
                sq.classList.add('check');
                if (isCheckmate) sq.classList.add('checkmate-flash');
            }

            const piece = localBoard[r][c];
            if (piece) {
                const pd = document.createElement('div');
                pd.className = 'piece';
                pd.innerHTML = SVG_PIECES[piece]; 
                sq.appendChild(pd);
            }

            sq.addEventListener('click', () => onSquareClick(algSq));
            el.appendChild(sq);
        }
    }
    
    // Visually indicate if the user is analyzing history instead of playing
    const statusBar = document.getElementById('status-bar');
    if (viewIdx !== -1) {
        document.querySelector('.board-section').style.opacity = '0.8';
        if(statusBar) statusBar.innerHTML = `Analysing move ${viewIdx} <span style="color:#f39c12; cursor:pointer; font-weight:bold;" onclick="navigateTo(-1)">↩ Go Live</span>`;
    } else {
        document.querySelector('.board-section').style.opacity = '1';
        if(statusBar) statusBar.innerHTML = `<div class="status-dot"></div> ${currentTurn === 'w' ? 'White' : 'Black'}'s Turn`;
    }

    const rankEl = document.getElementById('rank-coords');
    const fileEl = document.getElementById('file-coords');
    
    if (rankEl && fileEl) {
        rankEl.innerHTML = '';
        fileEl.innerHTML = '';
        
        for (let i = 0; i < 8; i++) {
            // Draw Numbers (Ranks)
            const rd = document.createElement('div');
            rd.className = 'coord';
            rd.textContent = boardFlipped ? i + 1 : 8 - i;
            rankEl.appendChild(rd);
            
            // Draw Letters (Files)
            const fd = document.createElement('div');
            fd.className = 'coord';
            fd.textContent = boardFlipped ? FILES[7 - i] : FILES[i];
            fileEl.appendChild(fd);
        }
    }

    renderCaptures();

    if (isCheckmate && lastFiredMove !== lastMoveIdx) {
        lastFiredMove = lastMoveIdx; // Mark as fired

        // Extract the attacker's square using regex (e.g., "Qh4#" -> "h4")
        const match = lastMove.match(/([a-h][1-8])(?:=[QRBN])?[+#]?$/);
        const attackerAlg = match ? match[1] : null;

        if (attackerAlg && kingInCheckAlg) {
            // Wait 50ms to ensure the board is fully visible on the screen, then fire!
            setTimeout(() => {
                shootProjectile(attackerAlg, kingInCheckAlg);
            }, 50);
        }
    }
}

function onSquareClick(clickedAlgSq) {
    if (isGameOver) return;
    if (viewIdx !== -1) { navigateTo(-1); return; }
    if (myRole !== currentTurn) return;

    if (selectedSquareAlg && legalDestinations.includes(clickedAlgSq)) {
        
        // 🚨 PROMOTION DETECTION LOGIC
        const { r, c } = algToRC(selectedSquareAlg);
        const piece = localBoard[r][c];
        const destRank = clickedAlgSq[1]; // '1' or '8'
        
        // If it's a pawn moving to the last rank, intercept it!
        if (piece && piece[1] === 'P' && (destRank === '8' || destRank === '1')) {
            pendingPromoMove = { from: selectedSquareAlg, to: clickedAlgSq };
            showPromoModal();
            return;
        }

        // Normal Move
        socket.emit('attempt_move', {
            from: selectedSquareAlg,
            to: clickedAlgSq,
            promo: 'q' // Fallback
        });
        selectedSquareAlg = null;
        legalDestinations = [];
        renderBoard();
        return;
    }

    const { r, c } = algToRC(clickedAlgSq);
    const piece = localBoard[r][c];
    
    if (piece && piece[0] === myRole) {
        selectedSquareAlg = clickedAlgSq;
        legalDestinations = []; 
        renderBoard(); 
        socket.emit('request_legal_moves', clickedAlgSq); 
    } else {
        selectedSquareAlg = null;
        legalDestinations = [];
        renderBoard();
    }
}

function showPromoModal() {
    const modal = document.getElementById('promo-modal');
    const container = document.getElementById('promo-pieces');
    container.innerHTML = '';
    
    const color = myRole === 'w' ? 'w' : 'b';
    const pieces = ['Q', 'R', 'B', 'N'];
    
    pieces.forEach(p => {
        const el = document.createElement('div');
        el.className = 'promo-piece';
        el.innerHTML = SVG_PIECES[color + p]; // Grab the exact SVG
        
        // When clicked, send the move with the chosen piece!
        el.onclick = () => {
            socket.emit('attempt_move', {
                from: pendingPromoMove.from,
                to: pendingPromoMove.to,
                promo: p.toLowerCase() // Send 'q', 'r', 'b', or 'n'
            });
            modal.classList.add('hidden');
            pendingPromoMove = null;
            selectedSquareAlg = null;
            legalDestinations = [];
            renderBoard();
        };
        container.appendChild(el);
    });
    
    modal.classList.remove('hidden');
}

// ==========================================
// BUTTONS & RESPONSIVE LAYOUT
// ==========================================

// --- 1. RESIGN BUTTON ---
const resignBtn = document.getElementById('btn-resign');
if (resignBtn) {
    resignBtn.addEventListener('click', () => {
        // Only let them resign if the game is active and they aren't a spectator
        if (!isGameOver && myRole !== 'spectator') {
            if (confirm('Are you sure you want to resign? This will affect your Elo.')) {
                socket.emit('resign_game');
            }
        }
    });
}

// --- 2. RESPONSIVE SQUARE SIZING ---
function resizeBoard() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isMobile = vw < 768;
    
    const sidePanelW = isMobile ? 0 : Math.min(300, vw * 0.25);
    const paddingX = isMobile ? 40 : 80;
    const availW = vw - sidePanelW - paddingX;
    
    // 🚨 FIX: We subtract 180 instead of 120 to give the layout much more breathing room vertically
    let availH = vh - 180; 
    if (isMobile) availH = vh * 0.55; 

    const sq = Math.floor(Math.min(availW, availH) / 8);
    // 🚨 FIX: Reduced the maximum square size from 90 to 75 so it doesn't blow up the screen
    const clamped = Math.max(30, Math.min(sq, 75)); 

    document.body.style.setProperty('--sq', clamped + 'px');
}

// --- 3. REMATCH BUTTON CLICKER ---
const btnRematch = document.getElementById('btn-rematch');
if (btnRematch) {
    // We only want this default listener to run if it says "Request Rematch"
    btnRematch.addEventListener('click', (e) => {
        // If the button has an onclick attached (from accept_rematch), don't run this
        if (e.currentTarget.onclick) return; 

        if (btnRematch.textContent === 'Request Rematch') {
            socket.emit('request_rematch');
            btnRematch.textContent = "Waiting for opponent...";
            btnRematch.style.opacity = "0.6";
            btnRematch.style.pointerEvents = "none";
        }
    });
}

const chatInput = document.getElementById('chat-input');
const chatBtn = document.getElementById('btn-send-chat');
const chatBox = document.getElementById('chat-messages');

// 🚨 1. Create a unique storage key for this specific match room
const chatStorageKey = `chat_${partyCode}`;

// Helper function to draw a message to the screen
function appendChatMessage(data) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-bubble';
    
    let nameColor = '#aaa'; 
    if (data.color === 'w') nameColor = '#e8e6e3'; 
    if (data.color === 'b') nameColor = '#81b64c'; // Matches your green theme

    msgDiv.innerHTML = `<span style="color: ${nameColor}; font-weight: bold; margin-right: 5px;">${data.sender}:</span><span>${data.text}</span>`;
    chatBox.appendChild(msgDiv);
    
    // Auto-scroll to bottom smoothly
    chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
}

if (chatBtn && chatInput) {
    // 🚨 2. LOAD SAVED CHATS ON PAGE REFRESH 🚨
    const savedChat = JSON.parse(sessionStorage.getItem(chatStorageKey) || '[]');
    savedChat.forEach(msg => appendChatMessage(msg));

    // Send message on click
    chatBtn.addEventListener('click', () => {
        if (chatInput.value.trim() !== '') {
            socket.emit('send_chat', chatInput.value.trim());
            chatInput.value = '';
        }
    });

    // Send message on Enter key
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') chatBtn.click();
    });

    // Receive message from server
    socket.on('receive_chat', (data) => {
        appendChatMessage(data);
        
        // 🚨 3. SAVE NEW CHAT TO TEMPORARY STORAGE 🚨
        const history = JSON.parse(sessionStorage.getItem(chatStorageKey) || '[]');
        history.push(data);
        sessionStorage.setItem(chatStorageKey, JSON.stringify(history));
    });
}

// Listen for window resizes and run immediately on load
window.addEventListener('resize', resizeBoard);
resizeBoard();