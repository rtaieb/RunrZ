import { state } from './state.js';
import { elements, showScreen, showError } from './ui.js';
import { joinPublicRoom, createRoom, joinRoom, hostStartGame, restartGame } from './network.js';
import { setLocalMovement, setLocalSprinting, attemptShoot, draw } from './game.js';
import { RUNNER_RADIUS } from './config.js';

const savedName = localStorage.getItem('runrz_player_name');
if (savedName) {
    elements.inputPlayerName.value = savedName;
}

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
    if (e.code === 'KeyR' || e.key === 'r' || e.key === 'R') {
        const localRunner = state.runners.find(r => r.isLocal);
        if (!state.isRPressed && localRunner && !localRunner.isDead) {
            state.isRPressed = true;
            setLocalSprinting(true);
            if (!state.isSpacePressed) {
                setLocalMovement(true);
            }
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
        state.isSpacePressed = false;
        if (!state.isRPressed) {
            setLocalMovement(false);
        }
    }
    if (e.code === 'KeyR' || e.key === 'r' || e.key === 'R') {
        state.isRPressed = false;
        setLocalSprinting(false);
        if (!state.isSpacePressed) {
            setLocalMovement(false);
        }
    }
});

function getCanvasPos(e) {
    const rect = elements.canvas.getBoundingClientRect();
    const scaleX = elements.canvas.width / rect.width;
    const scaleY = elements.canvas.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

elements.canvas.addEventListener('mousedown', (e) => {
    const pos = getCanvasPos(e);
    attemptShoot(pos.x, pos.y);
});

elements.canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); 
    
    const touch = e.touches[0];
    const pos = getCanvasPos(touch);
    let isShotAttempt = false;

    if (state.gameState === 'playing' && !state.hasShot) {
        const localRunner = state.runners.find(r => r.isLocal);
        if (localRunner && !localRunner.isDead) {
            for (const r of state.runners) {
                if (!r.isDead && Math.hypot(r.x - pos.x, r.y - pos.y) <= RUNNER_RADIUS * 3) {
                    attemptShoot(pos.x, pos.y);
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
    if (!state.isRPressed) {
        setLocalMovement(false);
    }
});

// Sprint mobile
elements.btnSprintMobile.addEventListener('touchstart', (e) => {
    e.preventDefault(); 
    const localRunner = state.runners.find(r => r.isLocal);
    if (!state.isRPressed && localRunner && !localRunner.isDead) {
        state.isRPressed = true;
        setLocalSprinting(true);
        if (!state.isSpacePressed) {
            setLocalMovement(true);
        }
    }
});

elements.btnSprintMobile.addEventListener('touchend', (e) => {
    e.preventDefault();
    state.isRPressed = false;
    setLocalSprinting(false);
    if (!state.isSpacePressed) {
        setLocalMovement(false);
    }
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
    restartGame();
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
draw(); // Appel initial pour dessiner le fond
