import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import { appId, firebaseConfig, MAX_HUMANS, NUM_RUNNERS } from './config.js';
import { state } from './state.js';
import { elements, showScreen, showError } from './ui.js';
import { generateRoomCode } from './utils.js';
import { startGame, updateRemotePlayers, handleGameOver, setLocalMovement } from './game.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
export const db = getFirestore(app);

export function getPlayerName() {
    const val = elements.inputPlayerName.value.trim();
    if (val) {
        localStorage.setItem('runrz_player_name', val);
        return val;
    }
    return "Coureur " + Math.floor(Math.random() * 10000);
}

export const initAuth = async () => {
    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
    } else {
        await signInAnonymously(auth);
    }
};

onAuthStateChanged(auth, (user) => {
    state.currentUser = user;
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
        
        let targetRoomId = null;
        let targetRoomData = null;

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (!data.isPrivate && Object.keys(data.players || {}).length < MAX_HUMANS) {
                targetRoomId = docSnap.id;
                targetRoomData = data;
            }
        });

        const pName = getPlayerName();

        if (targetRoomId) {
            const usedLanes = Object.values(targetRoomData.players).map(p => p.lane);
            let myLane = 0;
            while(usedLanes.includes(myLane)) myLane++;
            
            await updateDoc(doc(roomsRef, targetRoomId), {
                [`players.${state.currentUser.uid}`]: { lane: myLane, x: 50, isMoving: false, name: pName, isSpectator: targetRoomData.status !== 'waiting' }
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

        const data = docSnap.data();

        const playerCount = Object.keys(data.players || {}).length;
        if (playerCount >= MAX_HUMANS) {
            showError("Le salon est complet (6 joueurs max).");
            return;
        }

        const pName = getPlayerName();
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

function updateSidebar(data, roomId) {
    if (elements.sidebarCode) {
        elements.sidebarCode.innerText = data.isPrivate ? roomId : "PUBLIC";
    }
    if (elements.sidebarPlayerList && data.players) {
        elements.sidebarPlayerList.innerHTML = '';
        
        // Convertir l'objet players en tableau et le trier par ordre alphabétique du pseudo
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

export function listenToRoom(roomId) {
    state.currentRoomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId);
    state.gameState = 'lobby';
    
    if (state.unsubRoom) state.unsubRoom();
    
    state.unsubRoom = onSnapshot(state.currentRoomRef, (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        
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
            
            if (data.host === state.currentUser.uid) {
                elements.btnStartHost.classList.remove('hidden');
                elements.lobbyWaiting.classList.add('hidden');
            } else {
                elements.btnStartHost.classList.add('hidden');
                elements.lobbyWaiting.classList.remove('hidden');
            }
        } 
        else if (data.status === 'playing') {
            if (state.gameState !== 'playing') {
                startGame(data);
            } else {
                updateRemotePlayers(data);
            }
            
            // Synchroniser les morts
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
        await updateDoc(state.currentRoomRef, { status: 'playing' });
    } catch (error) {
        console.error("Erreur au lancement:", error);
    }
}

export async function returnToLobby() {
    if (!state.currentRoomRef) return;
    try {
        const docSnap = await getDoc(state.currentRoomRef);
        const data = docSnap.data();
        const updates = {
            status: 'waiting',
            deadRunners: {}
        };
        if (data && data.players) {
            for (const uid of Object.keys(data.players)) {
                updates[`players.${uid}.isSpectator`] = false;
                updates[`players.${uid}.x`] = 50;
                updates[`players.${uid}.isMoving`] = false;
            }
        }
        await updateDoc(state.currentRoomRef, updates);
    } catch (error) {
        console.error("Erreur retour au salon:", error);
    }
}
