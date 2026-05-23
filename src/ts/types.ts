import { DocumentReference } from 'firebase/firestore';

export type GameState = 'menu' | 'lobby' | 'playing' | 'ending' | 'finished' | 'start' | 'end';

export interface PlayerData {
    lane: number;
    name: string;
    isSpectator?: boolean;
    x?: number;
    isMoving?: boolean;
    isSprinting?: boolean;
}

export interface ShootEvent {
    id: string;
    shooterUid: string;
    shooterName: string;
    targetType: 'human' | 'npc' | 'miss';
    targetName: string;
    timestamp: number;
}

export interface RoomData {
    status: GameState | 'waiting';
    host: string;
    isPrivate: boolean;
    players: Record<string, PlayerData>;
    seed: number;
    startTime?: number;
    deadRunners?: Record<string, number | boolean>;
    winnerUid?: string;
    shootEvents?: ShootEvent[];
}


export interface RunnerState {
    uid: string | null;
    isLocal: boolean;
    isRemote: boolean;
    isNPC: boolean;
    lane: number;
    name: string;
    x: number;
    y: number;
    isMoving: boolean;
    isSprinting: boolean;
    isDead: boolean;
    
    // NPC state
    timer: number;
    state: 'idle' | 'running';
    
    // Visuals
    color: string;
    bounceY: number;
    bounceTime: number;
    trail: { x: number; y: number; time: number }[];
    spriteImg: HTMLImageElement | null;
    
    draw(ctx: CanvasRenderingContext2D): void;
    fixedUpdate(dt: number): void;
}

export interface AppState {
    currentUser: { uid: string } | null;
    currentRoomRef: DocumentReference | null;
    currentRoomCode: string | null;
    unsubRoom: (() => void) | null;
    gameState: GameState;
    runners: any[];
    lastTime: number;
    accumulator: number;
    animationFrameId: number | null;
    isSpacePressed: boolean;
    isRPressed: boolean;
    isSpectator: boolean;
    hasShot: boolean;
    currentSeed: number;
}
