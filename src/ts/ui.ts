import { state } from './state';
import type { GameState, ShootEvent } from './types';
// @ts-ignore
import crosshairUrl from '../assets/crosshair.svg';

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
            elements.canvas.style.cursor = `url('${crosshairUrl}') 16 16, crosshair`;
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

export function addShootNotification(event: ShootEvent) {
    const feedContainer = document.getElementById('kill-feed');
    if (!feedContainer) return;

    const notification = document.createElement('div');
    notification.className = "flex items-center justify-between bg-slate-950/85 backdrop-blur-md text-white font-mono px-3 py-2 rounded shadow-lg animate-slide-in pointer-events-none select-none border border-transparent";

    let content = "";
    if (event.targetType === 'human') {
        notification.classList.add('border-cyan-500/40', 'shadow-[0_0_10px_rgba(6,182,212,0.15)]');
        content = `
            <span class="font-extrabold text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]">${event.shooterName}</span>
            <span class="text-gray-400 mx-2 flex items-center gap-1">💀🔫</span>
            <span class="font-extrabold text-pink-500 drop-shadow-[0_0_5px_rgba(236,72,153,0.5)]">${event.targetName}</span>
        `;
    } else if (event.targetType === 'npc') {
        notification.classList.add('border-amber-500/30', 'shadow-[0_0_10px_rgba(245,158,11,0.1)]');
        content = `
            <span class="font-extrabold text-amber-400">${event.shooterName}</span>
            <span class="text-gray-400 mx-2 flex items-center gap-1">🤖🔫</span>
            <span class="font-bold text-gray-400">${event.targetName}</span>
        `;
    } else {
        notification.classList.add('border-purple-500/20', 'opacity-90');
        content = `
            <span class="font-extrabold text-purple-400">${event.shooterName}</span>
            <span class="text-gray-400 mx-2 flex items-center gap-1">💨🔫</span>
            <span class="text-gray-500 font-bold"></span>
        `;
    }

    notification.innerHTML = content;
    feedContainer.appendChild(notification);

    if (feedContainer.children.length > 5) {
        const oldest = feedContainer.children[0] as HTMLElement;
        if (!oldest.classList.contains('animate-fade-out')) {
            removeNotification(oldest);
        }
    }

    setTimeout(() => {
        removeNotification(notification);
    }, 4000);
}

function removeNotification(element: HTMLElement) {
    if (element.parentNode) {
        element.classList.remove('animate-slide-in');
        element.classList.add('animate-fade-out');
        setTimeout(() => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        }, 500);
    }
}

