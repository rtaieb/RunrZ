import { state } from './state';
import type { GameState } from './types';

// Add copyRoomCode to Window interface
declare global {
    interface Window {
        copyRoomCode: () => void;
    }
}

export const elements = {
    canvas: document.getElementById('gameCanvas') as HTMLCanvasElement,
    
    screens: {
        start: document.getElementById('screen-start') as HTMLElement,
        lobby: document.getElementById('screen-lobby') as HTMLElement,
        end: document.getElementById('screen-end') as HTMLElement
    },
    
    authLoading: document.getElementById('auth-loading') as HTMLElement,
    startActions: document.getElementById('start-actions') as HTMLElement,
    inputPlayerName: document.getElementById('input-player-name') as HTMLInputElement,
    btnPublic: document.getElementById('btn-public') as HTMLButtonElement,
    btnCreate: document.getElementById('btn-create') as HTMLButtonElement,
    btnJoin: document.getElementById('btn-join') as HTMLButtonElement,
    inputCode: document.getElementById('input-code') as HTMLInputElement,
    joinError: document.getElementById('join-error') as HTMLElement,
    
    btnStartHost: document.getElementById('btn-start-host') as HTMLButtonElement,
    btnNextRound: document.getElementById('btn-next-round') as HTMLButtonElement,
    btnLeave: document.getElementById('btn-leave') as HTMLButtonElement,
    privateCodeContainer: document.getElementById('private-code-container') as HTMLElement,
    lobbyCode: document.getElementById('lobby-code') as HTMLElement,
    lobbyCount: document.getElementById('lobby-count') as HTMLElement,
    lobbyWaiting: document.getElementById('lobby-waiting') as HTMLElement,
    endTitle: document.getElementById('end-title') as HTMLElement,
    endMessage: document.getElementById('end-message') as HTMLElement,
    scoreboard: document.getElementById('scoreboard') as HTMLElement,
    scoreboardList: document.getElementById('scoreboard-list') as HTMLUListElement,
    hud: document.getElementById('hud') as HTMLElement,
    ammoCount: document.getElementById('ammo-count') as HTMLElement,
    spectatorBanner: document.getElementById('spectator-banner') as HTMLElement,
    sidebar: document.getElementById('game-sidebar') as HTMLElement,
    sidebarCode: document.getElementById('sidebar-code') as HTMLElement,
    sidebarPlayerList: document.getElementById('sidebar-player-list') as HTMLUListElement,
    btnSprintMobile: document.getElementById('btn-sprint-mobile') as HTMLButtonElement
};

export function showError(msg: string) {
    if (msg) {
        elements.joinError.innerText = msg;
        elements.joinError.classList.remove('hidden');
    } else {
        elements.joinError.classList.add('hidden');
    }
}

export function showScreen(screenName: GameState | null) {
    Object.values(elements.screens).forEach(s => s.classList.add('hidden'));
    if (screenName && elements.screens[screenName as keyof typeof elements.screens]) {
        elements.screens[screenName as keyof typeof elements.screens].classList.remove('hidden');
    }
    
    if (screenName === null || screenName === 'playing') {
        if (elements.sidebar) elements.sidebar.classList.remove('sidebar-hidden');
        if (state.isSpectator) {
            elements.hud.classList.add('hidden');
            elements.spectatorBanner.classList.remove('hidden');
            if (elements.btnSprintMobile) elements.btnSprintMobile.classList.add('hidden');
            elements.canvas.style.cursor = 'default';
        } else {
            elements.hud.classList.remove('hidden');
            elements.spectatorBanner.classList.add('hidden');
            if (elements.btnSprintMobile) elements.btnSprintMobile.classList.remove('hidden');
            elements.canvas.style.cursor = "url('/src/assets/crosshair.svg') 16 16, crosshair";
        }
    } else {
        if (elements.sidebar) elements.sidebar.classList.add('sidebar-hidden');
        elements.hud.classList.add('hidden');
        if (elements.spectatorBanner) elements.spectatorBanner.classList.add('hidden');
        if (elements.btnSprintMobile) elements.btnSprintMobile.classList.add('hidden');
        elements.canvas.style.cursor = 'default';
    }
}

export function copyRoomCode() {
    const code = state.currentRoomRef?.id || elements.lobbyCode.innerText;
    if (!code || code === '-----') return;
    
    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(code)}`;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareUrl)
            .then(() => {
                showToast("Lien du salon copié !");
            })
            .catch(err => {
                console.error("Erreur de copie via clipboard API", err);
                copyFallback(shareUrl);
            });
    } else {
        copyFallback(shareUrl);
    }
}

function copyFallback(text: string) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        showToast("Lien du salon copié !");
    } catch (err) {
        console.error("Erreur de copie", err);
    }
    document.body.removeChild(textArea);
}

function showToast(message: string) {
    let toast = document.getElementById('global-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'global-toast';
        toast.className = 'fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-opacity duration-300 opacity-0';
        document.body.appendChild(toast);
    }
    toast.innerText = message;
    toast.classList.remove('opacity-0');
    
    const existingTimeout = (toast as any).timeoutId;
    if (existingTimeout) clearTimeout(existingTimeout);
    
    (toast as any).timeoutId = setTimeout(() => {
        if (toast) toast.classList.add('opacity-0');
    }, 2000);
}

window.copyRoomCode = copyRoomCode;

