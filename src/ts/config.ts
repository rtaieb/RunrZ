// @ts-ignore
export const appId = typeof __app_id !== 'undefined' ? __app_id : 'runrz-multiplayer-demo';

export const firebaseConfig = {
  apiKey: "AIzaSyBT4Iud1XBVgNt_ooUVAAtdC1zwk3dMtI8",
  authDomain: "runrz-57a15.firebaseapp.com",
  projectId: "runrz-57a15",
  storageBucket: "runrz-57a15.firebasestorage.app",
  messagingSenderId: "97011801857",
  appId: "1:97011801857:web:40d6cc5517b28c5f47c500"
};

export const NUM_RUNNERS = 15;
export const RUNNER_RADIUS = 8;
export const FINISH_LINE_OFFSET = 100;
export const BASE_SPEED = 50; 
export const TIME_STEP = 1 / 60; // Simulation à 60 FPS constants pour le déterminisme
export const MAX_HUMANS = 6;

// Temps distincts pour les PNJ
export const NPC_MIN_RUN_TIME = 0.1;
export const NPC_MAX_RUN_TIME = 2.0;
export const NPC_MIN_PAUSE_TIME = 0.5;
export const NPC_MAX_PAUSE_TIME = 4.0;
