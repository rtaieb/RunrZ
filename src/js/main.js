import { state } from './state.js';
import { elements, showScreen, showError } from './ui.js';
import { joinPublicRoom, createRoom, joinRoom, hostStartGame, returnToLobby } from './network.js';
import { setLocalMovement, attemptShoot, draw } from './game.js';
import { RUNNER_RADIUS } from './config.js';

// --- GESTION DES ENTREES ---
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        const localRunner = state.runners.find(r => r.isLocal);
        if (!state.isSpacePressed && localRunner && !localRunner.isDead) {
            state.isSpacePressed = true;
            setLocalMovement(true);
        }
        if (e.target === document.body) e.preventDefault(); 
    }
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
        state.isSpacePressed = false;
        setLocalMovement(false);
    }
});

elements.canvas.addEventListener('mousedown', (e) => {
    attemptShoot(e.clientX, e.clientY);
});

elements.canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); 
    
    const touch = e.touches[0];
    let isShotAttempt = false;

    if (state.gameState === 'playing' && !state.hasShot) {
        const localRunner = state.runners.find(r => r.isLocal);
        if (localRunner && !localRunner.isDead) {
            for (const r of state.runners) {
                if (!r.isDead && Math.hypot(r.x - touch.clientX, r.y - touch.clientY) <= RUNNER_RADIUS * 3) {
                    attemptShoot(touch.clientX, touch.clientY);
                    isShotAttempt = true;
                    break;
                }
            }
        }
    }

    if (!isShotAttempt && !state.isSpacePressed) {
        const localRunner = state.runners.find(r => r.isLocal);
        if (localRunner && !localRunner.isDead) {
            state.isSpacePressed = true;
            setLocalMovement(true);
        }
    }
});

elements.canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    state.isSpacePressed = false;
    setLocalMovement(false);
});

// --- EVENEMENTS DES BOUTONS ---
elements.btnPublic.addEventListener('click', joinPublicRoom);
elements.btnCreate.addEventListener('click', createRoom);
elements.btnJoin.addEventListener('click', joinRoom);

elements.inputCode.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinRoom();
});

elements.btnStartHost.addEventListener('click', hostStartGame);

elements.btnNextRound.addEventListener('click', () => {
    returnToLobby();
});

elements.btnLeave.addEventListener('click', () => {
    if (state.unsubRoom) state.unsubRoom();
    state.currentRoomRef = null;
    state.gameState = 'menu';
    showScreen('start');
    elements.inputCode.value = "";
    showError("");
    elements.scoreboard.classList.add('hidden'); 
    
    const ctx = elements.canvas.getContext('2d');
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, elements.canvas.width, elements.canvas.height);
});

// --- INITIALISATION ---
function resizeCanvas() {
    elements.canvas.width = window.innerWidth;
    elements.canvas.height = window.innerHeight;
    // Si on est dans un menu statique et pas en pleine partie, on force un redessin
    if (state.gameState !== 'playing') {
        draw();
    }
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas(); // Appel initial pour régler la taille
