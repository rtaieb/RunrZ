import { NUM_RUNNERS, RUNNER_RADIUS, BASE_SPEED, NPC_MIN_PAUSE_TIME, NPC_MAX_PAUSE_TIME, NPC_MIN_RUN_TIME, NPC_MAX_RUN_TIME } from './config';
import { randomRange } from './utils';
import { elements } from './ui';

// @ts-ignore
import runner0 from '../assets/runner_0.png';
// @ts-ignore
import runner1 from '../assets/runner_1.png';
// @ts-ignore
import runner2 from '../assets/runner_2.png';
// @ts-ignore
import runner3 from '../assets/runner_3.png';
// @ts-ignore
import runner4 from '../assets/runner_4.png';
// @ts-ignore
import runner5 from '../assets/runner_5.png';

const spriteUrls = [runner0, runner1, runner2, runner3, runner4, runner5];

interface SpriteData {
    ready: boolean;
    canvas: HTMLCanvasElement;
}

const loadedSprites: SpriteData[] = [];

for (let i = 0; i < 6; i++) {
    const img = new Image();
    img.src = spriteUrls[i];
    
    const offscreenCanvas = document.createElement('canvas');
    loadedSprites.push({ ready: false, canvas: offscreenCanvas });
    
    img.onload = () => {
        offscreenCanvas.width = img.width;
        offscreenCanvas.height = img.height;
        const ctx = offscreenCanvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0);
        
        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        const data = imgData.data;
        for (let j = 0; j < data.length; j += 4) {
            const r = data[j];
            const g = data[j+1];
            const b = data[j+2];
            
            const isBlack = r < 30 && g < 30 && b < 30;
            const isWhite = r > 225 && g > 225 && b > 225;
            
            if (isBlack || isWhite) {
                data[j+3] = 0; 
            }
        }
        ctx.putImageData(imgData, 0, 0);
        loadedSprites[i].ready = true;
    };
}

export class Runner {
    lane: number;
    isLocal: boolean;
    isRemote: boolean;
    isNPC: boolean;
    uid: string | null;
    name: string;
    
    x: number;
    speed: number;
    
    isMoving: boolean;
    isSprinting: boolean;
    isDead: boolean;
    stateTimer: number;
    spriteIndex: number;
    
    targetCursorX: number | null = null;
    targetCursorY: number | null = null;
    currentCursorX: number | null = null;
    currentCursorY: number | null = null;

    constructor(lane: number, isLocal: boolean, isRemote: boolean, uid: string | null, xStart: number = 50, name: string = "PNJ") {
        this.lane = lane;
        this.isLocal = isLocal;
        this.isRemote = isRemote;
        this.isNPC = !isLocal && !isRemote;
        this.uid = uid;
        this.name = name;
        
        this.x = xStart;
        this.speed = BASE_SPEED + randomRange(-8, 8); 
        
        this.isMoving = false; 
        this.isSprinting = false;
        this.isDead = false; 
        this.stateTimer = randomRange(NPC_MIN_PAUSE_TIME, NPC_MAX_PAUSE_TIME); 
        this.spriteIndex = this.lane % 6;
    }

    get y(): number {
        const laneSpacing = 30;
        const totalHeight = NUM_RUNNERS * laneSpacing;
        const startY = ((elements.canvas.height - totalHeight) / 2) + 40;
        return startY + (this.lane * laneSpacing);
    }

    fixedUpdate(dt: number) {
        if (this.isDead) return;

        if (this.isNPC) {
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
                this.isMoving = !this.isMoving;
                if (this.isMoving) {
                    this.stateTimer = randomRange(NPC_MIN_RUN_TIME, NPC_MAX_RUN_TIME);
                } else {
                    this.stateTimer = randomRange(NPC_MIN_PAUSE_TIME, NPC_MAX_PAUSE_TIME);
                }
            }
        }

        if (this.isMoving) {
            let currentSpeed = this.speed;
            if (this.isSprinting) {
                currentSpeed *= 1.5;
            }
            this.x += currentSpeed * dt;
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        const sprite = loadedSprites[this.spriteIndex];
        const size = RUNNER_RADIUS * 3.5; 
        
        let drawY = this.y;
        if (this.isMoving && !this.isDead) {
            const time = performance.now() / 100;
            const bounceSpeed = this.isSprinting ? 2.0 : 1.0;
            drawY += Math.sin(time * bounceSpeed + this.lane) * 3;
        }

        if (sprite && sprite.ready) {
            ctx.save();
            if (this.isDead) {
                ctx.globalAlpha = 0.3;
            }
            
            if (this.isSprinting && this.isMoving && !this.isDead) {
                ctx.save();
                ctx.globalAlpha = 0.4;
                ctx.drawImage(sprite.canvas, this.x - size/2 - 15, drawY - size/2 - 5, size, size);
                ctx.globalAlpha = 0.15;
                ctx.drawImage(sprite.canvas, this.x - size/2 - 30, drawY - size/2 - 5, size, size);
                ctx.restore();
            }
            
            ctx.drawImage(
                sprite.canvas, 
                this.x - size/2, 
                drawY - size/2 - 5, 
                size, 
                size
            );
            
            if (this.isDead) {
                ctx.globalAlpha = 1.0;
                ctx.beginPath();
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 3;
                ctx.moveTo(this.x - 10, this.y - 10);
                ctx.lineTo(this.x + 10, this.y + 10);
                ctx.moveTo(this.x + 10, this.y - 10);
                ctx.lineTo(this.x - 10, this.y + 10);
                ctx.stroke();
            }
            ctx.restore();
        } else {
            ctx.beginPath();
            ctx.arc(this.x, this.y, RUNNER_RADIUS, 0, Math.PI * 2);
            
            if (this.isDead) {
                ctx.fillStyle = '#4b5563'; 
                ctx.fill();
                ctx.closePath();
                
                ctx.beginPath();
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 2;
                ctx.moveTo(this.x - RUNNER_RADIUS, this.y - RUNNER_RADIUS);
                ctx.lineTo(this.x + RUNNER_RADIUS, this.y + RUNNER_RADIUS);
                ctx.moveTo(this.x + RUNNER_RADIUS, this.y - RUNNER_RADIUS);
                ctx.lineTo(this.x - RUNNER_RADIUS, this.y + RUNNER_RADIUS);
                ctx.stroke();
            } else {
                ctx.fillStyle = '#60a5fa'; 
                ctx.fill();
            }
            ctx.closePath();
        }
    }
}
