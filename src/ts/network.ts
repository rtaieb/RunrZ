import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, onSnapshot, DocumentData, DocumentSnapshot } from "firebase/firestore";

import { appId, firebaseConfig, MAX_HUMANS, NUM_RUNNERS } from './config';
import { state } from './state';
import { elements, showScreen, showError, addShootNotification } from './ui';
import { generateRoomCode } from './utils';
import { RETRO_NAMES } from './names';

const seenShootEvents = new Set<string>();

import { startGame, updateRemotePlayers, handleGameOver, setLocalMovement } from './game';
import type { RoomData } from './types';

// Let Vite handle global variables properly
declare const __initial_auth_token: string | undefined;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
export const db = getFirestore(app);

export function getPlayerName(): string {
    const val = elements.inputPlayerName.value.trim();
    if (val) {
        return val;
    }
    
    const randomName = RETRO_NAMES[Math.floor(Math.random() * RETRO_NAMES.length)];
    elements.inputPlayerName.value = randomName;
    return randomName;
}

export const initAuth = async () => {
    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
    } else {
        await signInAnonymously(auth);
    }
};

onAuthStateChanged(auth, (user) => {
    state.currentUser = user as any;
    if (user) {
        elements.authLoading.classList.add('hidden');
        elements.startActions.classList.remove('hidden');
    }
});

initAuth().catch(err => {
    console.error("Erreur auth:", err);
    elements.authLoading.innerText = "Erreur de connexion";
});

export async function joinPublicRoom() {
    if (!state.currentUser) return;
    showError("");
    elements.btnPublic.disabled = true;
    elements.btnPublic.innerText = "Recherche...";

    try {
        const roomsRef = collection(db, 'artifacts', appId, 'public', 'data', 'rooms');
        const snapshot = await getDocs(roomsRef);
        
        let targetRoomId: string | null = null;
        let targetRoomData: RoomData | null = null;

        snapshot.forEach(docSnap => {
            const data = docSnap.data() as RoomData;
            if (!data.isPrivate && Object.keys(data.players || {}).length < MAX_HUMANS) {
                targetRoomId = docSnap.id;
                targetRoomData = data;
            }
        });

        const pName = getPlayerName();
        localStorage.setItem('runrz_player_name', pName);

        if (targetRoomId && targetRoomData) {
            const trData = targetRoomData as RoomData;
            const usedLanes = Object.values(trData.players).map(p => p.lane);
            let myLane = 0;
            while(usedLanes.includes(myLane)) myLane++;
            
            await updateDoc(doc(roomsRef, targetRoomId), {
                [`players.${state.currentUser.uid}`]: { lane: myLane, x: 50, isMoving: false, name: pName, isSpectator: trData.status !== 'waiting' }
            });
            listenToRoom(targetRoomId);
        } else {
            const newRoomRef = doc(roomsRef);
            await setDoc(newRoomRef, {
                status: 'waiting',
                isPrivate: false,
                host: state.currentUser.uid,
                seed: Math.floor(Math.random() * 1000000),
                deadRunners: {},
                players: {
                    [state.currentUser.uid]: { lane: Math.floor(Math.random() * NUM_RUNNERS), x: 50, isMoving: false, name: pName, isSpectator: false }
                }
            });
            listenToRoom(newRoomRef.id);
        }
    } catch (error) {
        console.error("Erreur Matchmaking Public:", error);
        showError("Erreur lors de la recherche d'un salon public.");
    } finally {
        elements.btnPublic.disabled = false;
        elements.btnPublic.innerText = "Rejoindre un salon public";
    }
}

export async function createRoom() {
    if (!state.currentUser) return;
    showError("");
    elements.btnCreate.disabled = true;
    elements.btnCreate.innerText = "Création...";

    try {
        const pName = getPlayerName();
        localStorage.setItem('runrz_player_name', pName);
        const roomCode = generateRoomCode();
        const newRoomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
        
        await setDoc(newRoomRef, {
            status: 'waiting',
            isPrivate: true,
            host: state.currentUser.uid,
            seed: Math.floor(Math.random() * 1000000), 
            deadRunners: {},
            players: {
                [state.currentUser.uid]: { lane: Math.floor(Math.random() * NUM_RUNNERS), x: 50, isMoving: false, name: pName, isSpectator: false }
            }
        });
        listenToRoom(roomCode);
    } catch (error) {
        console.error("Erreur Création:", error);
        showError("Erreur lors de la création.");
    } finally {
        elements.btnCreate.disabled = false;
        elements.btnCreate.innerText = "Créer un salon privé";
    }
}

export async function joinRoom() {
    if (!state.currentUser) return;
    showError("");
    const code = elements.inputCode.value.trim().toUpperCase();
    
    if (code.length !== 5) {
        showError("Le code doit faire 5 caractères.");
        return;
    }

    elements.btnJoin.disabled = true;
    elements.btnJoin.innerText = "...";

    try {
        const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', code);
        const docSnap = await getDoc(roomRef);

        if (!docSnap.exists()) {
            showError("Salon introuvable.");
            return;
        }

        const data = docSnap.data() as RoomData;

        const playerCount = Object.keys(data.players || {}).length;
        if (playerCount >= MAX_HUMANS) {
            showError("Le salon est complet (6 joueurs max).");
            return;
        }

        const pName = getPlayerName();
        localStorage.setItem('runrz_player_name', pName);
        const usedLanes = Object.values(data.players).map(p => p.lane);
        let myLane = 0;
        while(usedLanes.includes(myLane)) myLane++; 
        
        await updateDoc(roomRef, {
            [`players.${state.currentUser.uid}`]: { lane: myLane, x: 50, isMoving: false, name: pName, isSpectator: data.status !== 'waiting' }
        });
        
        listenToRoom(code);
    } catch (error) {
        console.error("Erreur Rejoindre:", error);
        showError("Erreur de connexion au salon.");
    } finally {
        elements.btnJoin.disabled = false;
        elements.btnJoin.innerText = "Rejoindre";
    }
}

function updateSidebar(data: RoomData, roomId: string) {
    if (elements.sidebarCode) {
        elements.sidebarCode.innerText = data.isPrivate ? roomId : "PUBLIC";
    }
    if (elements.sidebarPlayerList && data.players) {
        elements.sidebarPlayerList.innerHTML = '';
        
        const sortedPlayers = Object.entries(data.players).sort((a, b) => {
            return a[1].name.localeCompare(b[1].name);
        });

        sortedPlayers.forEach(([uid, pData]) => {
            const isLocal = uid === state.currentUser?.uid;
            const isDead = data.deadRunners && data.deadRunners[pData.lane];
            const isSpectator = pData.isSpectator;
            
            const li = document.createElement('li');
            li.className = `flex items-center justify-between p-2 rounded ${isLocal ? 'bg-gray-700 border border-gray-600' : 'bg-gray-800'}`;
            
            let statusIcon = '🟢';
            if (isSpectator) statusIcon = '👀';
            else if (isDead) statusIcon = '💀';
            
            li.innerHTML = `
                <div class="flex items-center gap-2">
                    <span>${statusIcon}</span>
                    <span class="${isLocal ? 'font-bold text-white' : 'text-gray-300'} ${isDead ? 'line-through text-red-400' : ''}">
                        ${pData.name} ${isLocal ? '(Toi)' : ''}
                    </span>
                </div>
            `;
            elements.sidebarPlayerList.appendChild(li);
        });
    }
}

export function listenToRoom(roomId: string) {
    state.currentRoomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId);
    state.gameState = 'lobby';
    
    if (state.unsubRoom) state.unsubRoom();
    
    state.unsubRoom = onSnapshot(state.currentRoomRef, (docSnap: DocumentSnapshot<DocumentData, DocumentData>) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data() as RoomData;
        
        updateSidebar(data, roomId);
        
        if (data.status === 'waiting') {
            state.gameState = 'lobby';
            showScreen('lobby');
            
            if (data.isPrivate) {
                elements.privateCodeContainer.classList.remove('hidden');
                elements.lobbyCode.innerText = roomId;
            } else {
                elements.privateCodeContainer.classList.add('hidden');
            }

            const playerCount = Object.keys(data.players || {}).length;
            elements.lobbyCount.innerText = `${playerCount}/${MAX_HUMANS}`;
            
            if (state.currentUser && data.host === state.currentUser.uid) {
                elements.btnStartHost.classList.remove('hidden');
                elements.lobbyWaiting.classList.add('hidden');
            } else {
                elements.btnStartHost.classList.add('hidden');
                elements.lobbyWaiting.classList.remove('hidden');
            }
        } 
        else if (data.status === 'playing') {
            if (state.gameState !== 'playing') {
                seenShootEvents.clear();
                startGame(data);
            } else {
                updateRemotePlayers(data);
            }
            
            if (data.deadRunners) {
                for (const lane of Object.keys(data.deadRunners)) {
                    const runner = state.runners.find(r => r.lane === parseInt(lane));
                    if (runner && !runner.isDead) {
                        runner.isDead = true;
                        runner.isMoving = false;
                        if (runner.isLocal) setLocalMovement(false);
                    }
                }
            }

            if (data.shootEvents) {
                const sortedEvents = [...data.shootEvents].sort((a, b) => a.timestamp - b.timestamp);
                for (const event of sortedEvents) {
                    if (!seenShootEvents.has(event.id)) {
                        seenShootEvents.add(event.id);
                        addShootNotification(event);
                    }
                }
            }
        }
        else if (data.status === 'finished') {
            handleGameOver(data);
        }
    }, (error) => {
        console.error("Erreur de synchronisation:", error);
    });
}

export async function hostStartGame() {
    if (!state.currentRoomRef) return;
    try {
        await updateDoc(state.currentRoomRef, { 
            status: 'playing',
            startTime: Date.now()
        });
    } catch (error) {
        console.error("Erreur au lancement:", error);
    }
}

export async function restartGame() {
    if (!state.currentRoomRef) return;
    try {
        const docSnap = await getDoc(state.currentRoomRef);
        const data = docSnap.data() as RoomData;
        const updates: any = {
            status: 'playing',
            seed: Math.floor(Math.random() * 1000000), 
            startTime: Date.now(),
            deadRunners: {},
            shootEvents: []
        };
        if (data && data.players) {
            for (const uid of Object.keys(data.players)) {
                updates[`players.${uid}.isSpectator`] = false;
                updates[`players.${uid}.x`] = 50;
                updates[`players.${uid}.isMoving`] = false;
                updates[`players.${uid}.isSprinting`] = false;
            }
        }
        await updateDoc(state.currentRoomRef, updates);
    } catch (error) {
        console.error("Erreur lors de la relance de la course:", error);
    }
}

let lastCursorSentTime = 0;
const CURSOR_SEND_INTERVAL = 150; // ms
let cursorTimeoutId: any = null;

export function updateLocalCursor(x: number, y: number) {
    if (!state.currentRoomRef || !state.currentUser) return;
    
    const now = Date.now();
    
    const send = () => {
        if (!state.currentRoomRef || !state.currentUser) return;
        updateDoc(state.currentRoomRef, {
            [`players.${state.currentUser.uid}.cursorX`]: x,
            [`players.${state.currentUser.uid}.cursorY`]: y
        }).catch(() => {});
    };

    if (now - lastCursorSentTime >= CURSOR_SEND_INTERVAL) {
        lastCursorSentTime = now;
        send();
        if (cursorTimeoutId) {
            clearTimeout(cursorTimeoutId);
            cursorTimeoutId = null;
        }
    } else {
        if (cursorTimeoutId) clearTimeout(cursorTimeoutId);
        cursorTimeoutId = setTimeout(() => {
            send();
            lastCursorSentTime = Date.now();
        }, CURSOR_SEND_INTERVAL);
    }
}
