import { updateDoc, arrayUnion } from "firebase/firestore";
import { NUM_RUNNERS, RUNNER_RADIUS, FINISH_LINE_OFFSET, TIME_STEP } from './config';
import { state } from './state';
import { elements, showScreen } from './ui';
// @ts-ignore
import crosshairUrl from '../assets/crosshair.svg?url';
import { Runner } from './runner';
import type { RoomData } from './types';

const ctx = elements.canvas.getContext('2d') as CanvasRenderingContext2D;

export function startGame(roomData: RoomData) {
    state.runners = [];
    state.currentSeed = roomData.seed; 
    
    if (state.currentUser && roomData.players[state.currentUser.uid]) {
        state.isSpectator = roomData.players[state.currentUser.uid].isSpectator || false;
    } else {
        state.isSpectator = false;
    }
    
    for (let i = 0; i < NUM_RUNNERS; i++) {
        let isLocal = false;
        let isRemote = false;
        let pUid: string | null = null;
        let startX = 50;
        let pName = "PNJ " + (i + 1);
        
        for (const [uid, pData] of Object.entries(roomData.players)) {
            if (pData.lane === i) {
                pUid = uid;
                startX = pData.x || 50;
                pName = pData.name || "Joueur";
                if (state.currentUser && uid === state.currentUser.uid && !state.isSpectator) isLocal = true;
                else if (state.currentUser && uid !== state.currentUser.uid) isRemote = true;
                break;
            }
        }
        state.runners.push(new Runner(i, isLocal, isRemote, pUid, startX, pName));
    }

    state.hasShot = false;
    elements.ammoCount.innerText = "1";
    elements.ammoCount.className = "text-red-400 font-extrabold text-2xl ml-1";
    
    if (!state.isSpectator) {
        elements.canvas.style.cursor = `url("${crosshairUrl}") 16 16, crosshair`;
    } else {
        elements.canvas.style.cursor = 'default';
    }

    state.gameState = 'playing';
    showScreen(null); 
    
    state.lastTime = performance.now();
    state.accumulator = 0;
    
    if (roomData.startTime) {
        let elapsedSeconds = (Date.now() - roomData.startTime) / 1000;
        if (elapsedSeconds > 0) {
            const catchupSteps = Math.floor(elapsedSeconds / TIME_STEP);
            for (let step = 0; step < catchupSteps; step++) {
                const currentSimTime = roomData.startTime + (step * TIME_STEP * 1000);
                for (const runner of state.runners) {
                    if (runner.isNPC) {
                        const deathTime = roomData.deadRunners?.[runner.lane];
                        const isDeadAtThisTime = deathTime && currentSimTime >= (deathTime as number);
                        if (!isDeadAtThisTime) {
                            runner.fixedUpdate(TIME_STEP);
                        }
                    }
                }
            }
        }
    }

    if (state.animationFrameId) cancelAnimationFrame(state.animationFrameId);
    gameLoop(state.lastTime);
}

export function updateRemotePlayers(roomData: RoomData) {
    if (!state.currentUser) return;
    
    for (const [uid, pData] of Object.entries(roomData.players)) {
        const runner = state.runners.find(r => r.uid === uid);
        if (runner) {
            runner.isMoving = pData.isMoving || false;
            runner.isSprinting = pData.isSprinting || false;
            
            if (uid !== state.currentUser.uid) {
                if (pData.x !== undefined && Math.abs(runner.x - pData.x) > 20) {
                    runner.x = pData.x;
                }
                runner.targetCursorX = pData.cursorX !== undefined ? pData.cursorX : null;
                runner.targetCursorY = pData.cursorY !== undefined ? pData.cursorY : null;
            }
        }
    }
}

export function gameLoop(currentTime: number) {
    if (state.gameState !== 'playing') return;

    let deltaTime = (currentTime - state.lastTime) / 1000;
    state.lastTime = currentTime;
    
    if (deltaTime > 60.0) deltaTime = 60.0; 
    state.accumulator += deltaTime;

    while (state.accumulator >= TIME_STEP) {
        fixedUpdate(TIME_STEP);
        state.accumulator -= TIME_STEP;
    }
    draw();
    state.animationFrameId = requestAnimationFrame(gameLoop);
}

export function fixedUpdate(dt: number) {
    const finishLineX = elements.canvas.width - FINISH_LINE_OFFSET;

    for (const runner of state.runners) {
        runner.fixedUpdate(dt);
        
        if (!runner.isDead && runner.x + RUNNER_RADIUS >= finishLineX) {
            if (state.gameState === 'playing' && state.currentRoomRef) {
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

    // List of cyberpunk colors for player cursors
    const CURSOR_COLORS = [
        '#00f0ff', // Cyber Cyan
        '#ff007f', // Cyber Pink/Rose
        '#cc00ff', // Neon Purple
        '#39ff14', // Neon Green
        '#ff9900', // Neon Orange
        '#ffff00', // Neon Yellow
    ];

    state.runners.forEach(runner => {
        const isNotLocal = runner.uid && runner.uid !== state.currentUser?.uid;
        
        if (isNotLocal && !runner.isDead) {
            if (runner.targetCursorX !== null && runner.targetCursorY !== null) {
                if (runner.currentCursorX === null || runner.currentCursorY === null) {
                    runner.currentCursorX = runner.targetCursorX;
                    runner.currentCursorY = runner.targetCursorY;
                } else {
                    // Smoothly slide cursor position
                    runner.currentCursorX += (runner.targetCursorX - runner.currentCursorX) * 0.15;
                    runner.currentCursorY += (runner.targetCursorY - runner.currentCursorY) * 0.15;
                }

                const color = CURSOR_COLORS[runner.lane % CURSOR_COLORS.length];
                drawCrosshair(ctx, runner.currentCursorX, runner.currentCursorY, color);
            }
        }
    });
}

function drawCrosshair(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    
    // Draw outer reticle circle
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw crosshair tick lines
    ctx.beginPath();
    ctx.moveTo(x - 12, y); ctx.lineTo(x - 4, y);
    ctx.moveTo(x + 4, y); ctx.lineTo(x + 12, y);
    ctx.moveTo(x, y - 12); ctx.lineTo(x, y - 4);
    ctx.moveTo(x, y + 4); ctx.lineTo(x, y + 12);
    ctx.stroke();
    
    // Draw center dot
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}

export function handleGameOver(roomData: RoomData) {
    state.gameState = 'finished';
    showScreen('end');
    
    if (state.currentUser && roomData.host === state.currentUser.uid) {
        elements.btnNextRound.classList.remove('hidden');
    } else {
        elements.btnNextRound.classList.add('hidden');
    }

    if (state.currentUser && roomData.winnerUid === state.currentUser.uid) {
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

export function setLocalMovement(isMoving: boolean) {
    if (state.gameState !== 'playing' || !state.currentRoomRef || state.isSpectator || !state.currentUser) return;
    
    const localRunner = state.runners.find(r => r.isLocal);
    if (localRunner && !localRunner.isDead && localRunner.isMoving !== isMoving) {
        localRunner.isMoving = isMoving;
        updateDoc(state.currentRoomRef, {
            [`players.${state.currentUser.uid}.isMoving`]: isMoving,
            [`players.${state.currentUser.uid}.x`]: localRunner.x
        }).catch(console.error);
    }
}

export function setLocalSprinting(isSprinting: boolean) {
    if (state.gameState !== 'playing' || !state.currentRoomRef || state.isSpectator || !state.currentUser) return;
    
    const localRunner = state.runners.find(r => r.isLocal);
    if (localRunner && !localRunner.isDead && localRunner.isSprinting !== isSprinting) {
        localRunner.isSprinting = isSprinting;
        updateDoc(state.currentRoomRef, {
            [`players.${state.currentUser.uid}.isSprinting`]: isSprinting,
            [`players.${state.currentUser.uid}.x`]: localRunner.x
        }).catch(console.error);
    }
}

export function attemptShoot(clientX: number, clientY: number): boolean {
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

    let targetType: 'human' | 'npc' | 'miss' = 'miss';
    let targetName = '';

    if (hitRunner) {
        if (hitRunner.isNPC) {
            targetType = 'npc';
            targetName = hitRunner.name;
        } else {
            targetType = 'human';
            targetName = hitRunner.name;
        }
    }

    const eventId = `${Date.now()}_${state.currentUser?.uid || 'unknown'}`;
    const newEvent = {
        id: eventId,
        shooterUid: state.currentUser?.uid || 'unknown',
        shooterName: localRunner?.name || 'Inconnu',
        targetType,
        targetName,
        timestamp: Date.now()
    };

    const updates: any = {
        shootEvents: arrayUnion(newEvent)
    };

    if (hitRunner) {
        updates[`deadRunners.${hitRunner.lane}`] = Date.now();
    }

    updateDoc(state.currentRoomRef, updates).catch(console.error);
    
    return true;
}

