import { state } from './state.js';

export const elements = {
    canvas: document.getElementById('gameCanvas'),
    
    screens: {
        start: document.getElementById('screen-start'),
        lobby: document.getElementById('screen-lobby'),
        end: document.getElementById('screen-end')
    },
    
    authLoading: document.getElementById('auth-loading'),
    startActions: document.getElementById('start-actions'),
    inputPlayerName: document.getElementById('input-player-name'),
    btnPublic: document.getElementById('btn-public'),
    btnCreate: document.getElementById('btn-create'),
    btnJoin: document.getElementById('btn-join'),
    inputCode: document.getElementById('input-code'),
    joinError: document.getElementById('join-error'),
    
    btnStartHost: document.getElementById('btn-start-host'),
    btnNextRound: document.getElementById('btn-next-round'),
    btnLeave: document.getElementById('btn-leave'),
    privateCodeContainer: document.getElementById('private-code-container'),
    lobbyCode: document.getElementById('lobby-code'),
    lobbyCount: document.getElementById('lobby-count'),
    lobbyWaiting: document.getElementById('lobby-waiting'),
    endTitle: document.getElementById('end-title'),
    endMessage: document.getElementById('end-message'),
    scoreboard: document.getElementById('scoreboard'),
    scoreboardList: document.getElementById('scoreboard-list'),
    hud: document.getElementById('hud'),
    ammoCount: document.getElementById('ammo-count'),
    spectatorBanner: document.getElementById('spectator-banner'),
    sidebar: document.getElementById('game-sidebar'),
    sidebarCode: document.getElementById('sidebar-code'),
    sidebarPlayerList: document.getElementById('sidebar-player-list')
};

export function showError(msg) {
    if (msg) {
        elements.joinError.innerText = msg;
        elements.joinError.classList.remove('hidden');
    } else {
        elements.joinError.classList.add('hidden');
    }
}

export function showScreen(screenName) {
    Object.values(elements.screens).forEach(s => s.classList.add('hidden'));
    if (screenName && elements.screens[screenName]) {
        elements.screens[screenName].classList.remove('hidden');
    }
    
    if (screenName === null || screenName === 'playing') {
        if (elements.sidebar) elements.sidebar.classList.remove('sidebar-hidden');
        if (state.isSpectator) {
            elements.hud.classList.add('hidden');
            elements.spectatorBanner.classList.remove('hidden');
            elements.canvas.style.cursor = 'default';
        } else {
            elements.hud.classList.remove('hidden');
            elements.spectatorBanner.classList.add('hidden');
            elements.canvas.style.cursor = 'crosshair';
        }
    } else {
        if (elements.sidebar) elements.sidebar.classList.add('sidebar-hidden');
        elements.hud.classList.add('hidden');
        if (elements.spectatorBanner) elements.spectatorBanner.classList.add('hidden');
        elements.canvas.style.cursor = 'default';
    }
}

export function copyRoomCode() {
    const code = elements.lobbyCode.innerText;
    const textArea = document.createElement("textarea");
    textArea.value = code;
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        const toast = document.getElementById('copy-toast');
        toast.classList.remove('opacity-0');
        setTimeout(() => toast.classList.add('opacity-0'), 2000);
    } catch (err) {
        console.error("Erreur de copie", err);
    }
    document.body.removeChild(textArea);
}

// On attache copyRoomCode à window pour le onClick dans le HTML
window.copyRoomCode = copyRoomCode;
