import { updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { NUM_RUNNERS, RUNNER_RADIUS, FINISH_LINE_OFFSET, TIME_STEP } from './config.js';
import { state } from './state.js';
import { elements, showScreen } from './ui.js';
import { Runner } from './runner.js';

const ctx = elements.canvas.getContext('2d');

export function startGame(roomData) {
    state.runners = [];
    state.currentSeed = roomData.seed; 
    state.isSpectator = roomData.players[state.currentUser.uid]?.isSpectator || false;
    
    for (let i = 0; i < NUM_RUNNERS; i++) {
        let isLocal = false;
        let isRemote = false;
        let pUid = null;
        let startX = 50;
        let pName = "PNJ " + (i + 1);
        
        for (const [uid, pData] of Object.entries(roomData.players)) {
            if (pData.lane === i) {
                pUid = uid;
                startX = pData.x || 50;
                pName = pData.name || "Joueur";
                if (uid === state.currentUser.uid && !state.isSpectator) isLocal = true;
                else if (uid !== state.currentUser.uid) isRemote = true;
                break;
            }
        }
        state.runners.push(new Runner(i, isLocal, isRemote, pUid, startX, pName));
    }

    state.hasShot = false;
    elements.ammoCount.innerText = "1";
    elements.ammoCount.className = "text-red-400 font-extrabold text-2xl ml-1";
    
    if (!state.isSpectator) {
        elements.canvas.style.cursor = `url('src/assets/crosshair.svg') 16 16, crosshair`;
    } else {
        elements.canvas.style.cursor = 'default';
    }

    state.gameState = 'playing';
    showScreen(null); 
    
    state.lastTime = performance.now();
    state.accumulator = 0;
    if (state.animationFrameId) cancelAnimationFrame(state.animationFrameId);
    gameLoop(state.lastTime);
}

export function updateRemotePlayers(roomData) {
    for (const [uid, pData] of Object.entries(roomData.players)) {
        if (uid !== state.currentUser.uid) {
            const runner = state.runners.find(r => r.uid === uid);
            if (runner) {
                runner.isMoving = pData.isMoving;
                runner.isSprinting = pData.isSprinting;
                if (Math.abs(runner.x - pData.x) > 20) {
                    runner.x = pData.x;
                }
            }
        }
    }
}

export function gameLoop(currentTime) {
    if (state.gameState !== 'playing') return;

    let deltaTime = (currentTime - state.lastTime) / 1000;
    state.lastTime = currentTime;
    
    // On permet un rattrapage jusqu'à 60 secondes pour garder la synchronisation
    // des nombres aléatoires (seeded) entre les joueurs même si l'onglet est inactif.
    if (deltaTime > 60.0) deltaTime = 60.0; 
    state.accumulator += deltaTime;

    while (state.accumulator >= TIME_STEP) {
        fixedUpdate(TIME_STEP);
        state.accumulator -= TIME_STEP;
    }
    draw();
    state.animationFrameId = requestAnimationFrame(gameLoop);
}

export function fixedUpdate(dt) {
    const finishLineX = elements.canvas.width - FINISH_LINE_OFFSET;

    for (const runner of state.runners) {
        runner.fixedUpdate(dt);
        
        if (!runner.isDead && runner.x + RUNNER_RADIUS >= finishLineX) {
            if (state.gameState === 'playing') {
                state.gameState = 'ending'; 
                updateDoc(state.currentRoomRef, {
                    status: 'finished',
                    winnerUid: runner.uid || 'NPC'
                }).catch(console.error);
            }
        }
    }
}

export function draw() {
    ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
    
    // Fond semi-transparent pour laisser voir le décor cyberpunk
    ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
    ctx.fillRect(0, 0, elements.canvas.width, elements.canvas.height);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(40, 0, 10, elements.canvas.height);

    const finishLineX = elements.canvas.width - FINISH_LINE_OFFSET;
    for (let y = 0; y < elements.canvas.height; y += 20) {
        ctx.fillStyle = (y / 20) % 2 === 0 ? 'white' : 'black';
        ctx.fillRect(finishLineX, y, 20, 20);
    }

    state.runners.forEach(runner => runner.draw(ctx));
}

export function handleGameOver(roomData) {
    state.gameState = 'finished';
    showScreen('end');
    
    if (roomData.host === state.currentUser.uid) {
        elements.btnNextRound.classList.remove('hidden');
    } else {
        elements.btnNextRound.classList.add('hidden');
    }

    if (roomData.winnerUid === state.currentUser.uid) {
        elements.endTitle.innerText = "Victoire !";
        elements.endTitle.className = "text-5xl font-bold mb-4 text-green-400";
        elements.endMessage.innerText = "Tu as bluffé tout le monde et fini en tête.";
    } else if (roomData.winnerUid === 'NPC' || roomData.winnerUid === undefined) {
        elements.endTitle.innerText = "Perdu !";
        elements.endTitle.className = "text-5xl font-bold mb-4 text-gray-400";
        elements.endMessage.innerText = "Un PNJ a remporté la course...";
    } else {
        elements.endTitle.innerText = "Perdu !";
        elements.endTitle.className = "text-5xl font-bold mb-4 text-red-400";
        elements.endMessage.innerText = "Un autre joueur a été plus malin que toi.";
    }

    const sortedRunners = [...state.runners].sort((a, b) => {
        if (a.uid === roomData.winnerUid && a.uid) return -1;
        if (b.uid === roomData.winnerUid && b.uid) return 1;
        return b.x - a.x;
    });

    elements.scoreboardList.innerHTML = '';
    sortedRunners.forEach((r, index) => {
        const li = document.createElement('li');
        
        if (r.isLocal) {
            li.className = "flex justify-between items-center p-2 rounded bg-blue-900 text-white font-bold";
        } else if (r.isNPC) {
            li.className = "flex justify-between items-center p-2 rounded text-gray-500 text-sm";
        } else {
            li.className = "flex justify-between items-center p-2 rounded text-gray-300 font-semibold bg-gray-700 bg-opacity-50";
        }
        
        const rankSpan = document.createElement('span');
        rankSpan.innerText = `${index + 1}. ${r.name}`;
        if (r.isDead) {
            rankSpan.innerHTML += ' <span class="text-red-500 text-xs ml-2">☠️ Éliminé</span>';
            li.style.opacity = '0.6';
        }
        
        li.appendChild(rankSpan);
        elements.scoreboardList.appendChild(li);
    });
    
    elements.scoreboard.classList.remove('hidden');
}

export function setLocalMovement(isMoving) {
    if (state.gameState !== 'playing' || !state.currentRoomRef || state.isSpectator) return;
    
    const localRunner = state.runners.find(r => r.isLocal);
    if (localRunner && !localRunner.isDead && localRunner.isMoving !== isMoving) {
        localRunner.isMoving = isMoving;
        updateDoc(state.currentRoomRef, {
            [`players.${state.currentUser.uid}.isMoving`]: isMoving,
            [`players.${state.currentUser.uid}.x`]: localRunner.x
        }).catch(console.error);
    }
}

export function setLocalSprinting(isSprinting) {
    if (state.gameState !== 'playing' || !state.currentRoomRef || state.isSpectator) return;
    
    const localRunner = state.runners.find(r => r.isLocal);
    if (localRunner && !localRunner.isDead && localRunner.isSprinting !== isSprinting) {
        localRunner.isSprinting = isSprinting;
        updateDoc(state.currentRoomRef, {
            [`players.${state.currentUser.uid}.isSprinting`]: isSprinting,
            [`players.${state.currentUser.uid}.x`]: localRunner.x
        }).catch(console.error);
    }
}

export function attemptShoot(clientX, clientY) {
    if (state.gameState !== 'playing' || state.hasShot || !state.currentRoomRef || state.isSpectator) return false;

    const localRunner = state.runners.find(r => r.isLocal);
    if (localRunner && localRunner.isDead) return false; 

    state.hasShot = true;
    elements.ammoCount.innerText = "0";
    elements.ammoCount.className = "text-gray-500 font-extrabold text-2xl ml-1";
    elements.canvas.style.cursor = 'default';

    let hitRunner = null;
    const HITBOX = RUNNER_RADIUS * 2; 

    for (let i = state.runners.length - 1; i >= 0; i--) {
        const r = state.runners[i];
        if (r.isDead) continue;
        
        const dist = Math.hypot(r.x - clientX, r.y - clientY);
        if (dist <= HITBOX) {
            hitRunner = r;
            break;
        }
    }

    if (hitRunner) {
        updateDoc(state.currentRoomRef, {
            [`deadRunners.${hitRunner.lane}`]: true
        }).catch(console.error);
    }
    
    return true;
}
