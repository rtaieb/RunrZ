import { NUM_RUNNERS, RUNNER_RADIUS, BASE_SPEED, NPC_MIN_PAUSE_TIME, NPC_MAX_PAUSE_TIME, NPC_MIN_RUN_TIME, NPC_MAX_RUN_TIME } from './config.js';
import { randomRange } from './utils.js';
import { elements } from './ui.js';

export class Runner {
    constructor(lane, isLocal, isRemote, uid, xStart = 50, name = "PNJ") {
        this.lane = lane;
        this.isLocal = isLocal;
        this.isRemote = isRemote;
        this.isNPC = !isLocal && !isRemote;
        this.uid = uid;
        this.name = name;
        
        this.x = xStart;
        this.speed = BASE_SPEED + randomRange(-8, 8); 
        
        this.isMoving = false; 
        this.isDead = false; 
        this.stateTimer = randomRange(NPC_MIN_PAUSE_TIME, NPC_MAX_PAUSE_TIME); 
    }

    get y() {
        const laneSpacing = 30;
        const totalHeight = NUM_RUNNERS * laneSpacing;
        // On décale de 40px vers le bas pour ne pas toucher l'interface des munitions en haut
        const startY = ((elements.canvas.height - totalHeight) / 2) + 40;
        return startY + (this.lane * laneSpacing);
    }

    fixedUpdate(dt) {
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
            this.x += this.speed * dt;
        }
    }

    draw(ctx) {
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
