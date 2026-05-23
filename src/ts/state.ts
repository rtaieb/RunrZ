import type { AppState } from './types';

export const state: AppState = {
    currentUser: null,
    currentRoomRef: null,
    currentRoomCode: null,
    unsubRoom: null,
    runners: [],
    isSpacePressed: false,
    isRPressed: false,
    hasShot: false,
    gameState: 'menu',
    lastTime: 0,
    accumulator: 0,
    animationFrameId: null,
    currentSeed: 0,
    isSpectator: false
};
