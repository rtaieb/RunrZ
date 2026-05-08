export const state = {
    currentUser: null,
    currentRoomRef: null,
    unsubRoom: null,
    runners: [],
    isSpacePressed: false,
    hasShot: false,
    gameState: 'menu', // menu, lobby, playing, finished, ending
    lastTime: 0,
    accumulator: 0,
    animationFrameId: null,
    currentSeed: 0
};
