const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Gravity Directions
const GRAVITY = { DOWN: 0, UP: 1, LEFT: 2, RIGHT: 3 };
let currentGravity = GRAVITY.DOWN;
const gravityStrength = 0.3;

const STATES = { START_SCREEN: 0, LEVEL_MENU: 1, PLAYING: 2 };
let currentGameState = STATES.START_SCREEN;
const MAX_LEVELS = 50;

// Progression & Storage
let unlockedLevels = parseInt(localStorage.getItem("paintGravity_unlockedLevels")) || 1;
let levelStarsData = JSON.parse(localStorage.getItem("paintGravity_starsData")) || {}; 
let resetConfirm = false;

function unlockNextLevel(completedLevel, starsEarned) {
    let currentBestStars = levelStarsData[completedLevel] || 0;
    if (starsEarned > currentBestStars) {
        levelStarsData[completedLevel] = starsEarned;
        localStorage.setItem("paintGravity_starsData", JSON.stringify(levelStarsData));
    }
    if (completedLevel === unlockedLevels && unlockedLevels < MAX_LEVELS) {
        unlockedLevels++;
        localStorage.setItem("paintGravity_unlockedLevels", unlockedLevels);
    }
}

let currentLevel = 1;
const keys = {};

const player = {
    x: 40, y: 480,
    width: 30, height: 44,
    vx: 0, vy: 0,
    speed: 4,
    jumpForce: 8,
    onGround: false,
    facing: "right",
    isWalking: false,
    walkFrame: 0
};

const flag = { x: 700, y: 500, width: 20, height: 50 };

// Object Arrays
let paintBalls = [];
let paintSplatters = [];
let platforms = [];
let spikes = [];
let plants = [];
let starsInLevel = [];    
let waterErasers = [];    
let hazmatDroppers = [];  
let hazardDroplets = [];  

let cameraX = 0; 

window.addEventListener("keydown", e => keys[e.key] = true);
window.addEventListener("keyup", e => keys[e.key] = false);

function updatePlayer() {
    player.isWalking = false;

    if (currentGravity === GRAVITY.DOWN) {
        if (keys["a"] || keys["ArrowLeft"]) { player.facing = "left"; player.isWalking = true; }
        if (keys["d"] || keys["ArrowRight"]) { player.facing = "right"; player.isWalking = true; }
    } 
    else if (currentGravity === GRAVITY.UP) {
        if (keys["a"] || keys["ArrowLeft"]) { player.facing = "right"; player.isWalking = true; }
        if (keys["d"] || keys["ArrowRight"]) { player.facing = "left"; player.isWalking = true; }
    } 
    else if (currentGravity === GRAVITY.LEFT) {
        if (keys["w"] || keys["ArrowUp"]) { player.facing = "left"; player.isWalking = true; }
        if (keys["s"] || keys["ArrowDown"]) { player.facing = "right"; player.isWalking = true; }
    } 
    else if (currentGravity === GRAVITY.RIGHT) {
        if (keys["w"] || keys["ArrowUp"]) { player.facing = "right"; player.isWalking = true; }
        if (keys["s"] || keys["ArrowDown"]) { player.facing = "left"; player.isWalking = true; }
    }

    if (player.isWalking) player.walkFrame += 0.2; 
    else player.walkFrame = 0;

    switch (currentGravity) {
        case GRAVITY.DOWN:
            player.vy += gravityStrength;
            if (keys["a"] || keys["ArrowLeft"]) player.vx = -player.speed;
            else if (keys["d"] || keys["ArrowRight"]) player.vx = player.speed;
            else player.vx = 0;
            if ((keys["w"] || keys[" "]) && player.onGround) { player.vy = -player.jumpForce; player.onGround = false; }
            break;
        case GRAVITY.UP:
            player.vy -= gravityStrength;
            if (keys["a"] || keys["ArrowLeft"]) player.vx = -player.speed;
            else if (keys["d"] || keys["ArrowRight"]) player.vx = player.speed;
            else player.vx = 0;
            if ((keys["s"] || keys[" "]) && player.onGround) { player.vy = player.jumpForce; player.onGround = false; }
            break;
        case GRAVITY.LEFT:
            player.vx -= gravityStrength;
            if (keys["w"] || keys["ArrowUp"]) player.vy = -player.speed;
            else if (keys["s"] || keys["ArrowDown"]) player.vy = player.speed;
            else player.vy = 0;
            if ((keys["d"] || keys[" "]) && player.onGround) { player.vx = player.jumpForce; player.onGround = false; }
            break;
        case GRAVITY.RIGHT:
            player.vx += gravityStrength;
            if (keys["w"] || keys["ArrowUp"]) player.vy = -player.speed;
            else if (keys["s"] || keys["ArrowDown"]) player.vy = player.speed;
            else player.vy = 0;
            if ((keys["a"] || keys[" "]) && player.onGround) { player.vx = -player.jumpForce; player.onGround = false; }
            break;
    }

    player.x += player.vx;
    player.y += player.vy;
    
    // Camera updates smoothly based on player center
    cameraX += ((player.x - canvas.width / 2) - cameraX) * 0.1;

    // Platform Collisions
    platforms.forEach(p => {
        if (player.x < p.x + p.w && player.x + player.width > p.x && player.y < p.y + p.h && player.y + player.height > p.y) {
            let overlapX = Math.min((player.x + player.width) - p.x, (p.x + p.w) - player.x);
            let overlapY = Math.min((player.y + player.height) - p.y, (p.y + p.h) - player.y);
            if (overlapX < overlapY) {
                if (player.vx > 0 && player.x < p.x) { player.x = p.x - player.width; player.vx = 0; if (currentGravity === GRAVITY.RIGHT) player.onGround = true; } 
                else if (player.vx < 0 && player.x > p.x) { player.x = p.x + p.w; player.vx = 0; if (currentGravity === GRAVITY.LEFT) player.onGround = true; }
            } else {
                if (player.vy > 0 && player.y < p.y) { player.y = p.y - player.height; player.vy = 0; if (currentGravity === GRAVITY.DOWN) player.onGround = true; } 
                else if (player.vy < 0 && player.y > p.y) { player.y = p.y + p.h; player.vy = 0; if (currentGravity === GRAVITY.UP) player.onGround = true; }
            }
        }
    });

    // Splatters
    paintSplatters.forEach(splat => {
        if (player.x < splat.x + splat.hitboxSize && player.x + player.width > splat.x - splat.hitboxSize && player.y < splat.y + splat.hitboxSize && player.y + player.height > splat.y - splat.hitboxSize) {
                if (splat.color === "blue") currentGravity = GRAVITY.UP;
                if (splat.color === "red") currentGravity = GRAVITY.DOWN;
                if (splat.color === "yellow") currentGravity = GRAVITY.LEFT;
                if (splat.color === "green") currentGravity = GRAVITY.RIGHT;
        }
    });

    // Star Pickups
    starsInLevel.forEach(star => {
        if (!star.collected && player.x < star.x + 20 && player.x + player.width > star.x && player.y < star.y + 20 && player.y + player.height > star.y) {
            star.collected = true;
        }
    });

    // Spikes
    spikes.forEach(s => {
        if (player.x < s.x + s.w && player.x + player.width > s.x && player.y < s.y + s.h && player.y + player.height > s.y) {
            loadLevel(currentLevel); 
        }
    });

    // Droplets
    hazardDroplets.forEach(d => {
        if (player.x < d.x + 6 && player.x + player.width > d.x && player.y < d.y + 10 && player.y + player.height > d.y) {
            loadLevel(currentLevel);
        }
    });

    // Goal clear
    if (player.x < flag.x + flag.width && player.x + player.width > flag.x && player.y < flag.y + flag.height && player.y + player.height > flag.y) {
        let starsCollected = starsInLevel.filter(s => s.collected).length;
        unlockNextLevel(currentLevel, starsCollected);
        if (currentLevel >= MAX_LEVELS) {
            currentGameState = STATES.LEVEL_MENU;
        } else {
            currentLevel++;
            loadLevel(currentLevel);
        }
    }

    if (player.y > canvas.height + 50 || player.x < -50 || player.x > canvas.width + 50 || player.y < -50) {
        loadLevel(currentLevel);
    }
}

let selectedColor = "red";

window.addEventListener("keydown", (e) => {
    if (currentGameState === STATES.PLAYING) {
        if (e.key === "1") selectedColor = "blue";
        if (e.key === "2") selectedColor = "red";
        if (e.key === "3") selectedColor = "yellow";
        if (e.key === "4") selectedColor = "green";
        if (e.key.toLowerCase() === "r") loadLevel(currentLevel);
        if (e.key === "Escape") currentGameState = STATES.LEVEL_MENU;
    }
});

canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (currentGameState === STATES.START_SCREEN) {
        currentGameState = STATES.LEVEL_MENU;
    } 
    else if (currentGameState === STATES.LEVEL_MENU) {
        if (mouseX >= 20 && mouseX <= 140 && mouseY >= 40 && mouseY <= 70) {
            resetConfirm = false;
            currentGameState = STATES.START_SCREEN;
            return;
        }
        if (mouseX >= 660 && mouseX <= 780 && mouseY >= 40 && mouseY <= 70) {
            if (!resetConfirm) { resetConfirm = true; } 
            else { unlockedLevels = 1; levelStarsData = {}; localStorage.setItem("paintGravity_unlockedLevels", 1); localStorage.setItem("paintGravity_starsData", JSON.stringify({})); resetConfirm = false; }
            return;
        }
        if (!(mouseX >= 660 && mouseX <= 780 && mouseY >= 40 && mouseY <= 70)) { resetConfirm = false; }

        let startX = 60, startY = 120;
        let btnSize = 50, gap = 18;
        for (let i = 0; i < MAX_LEVELS; i++) {
            let col = i % 10; let row = Math.floor(i / 10);
            let x = startX + col * (btnSize + gap); let y = startY + row * (btnSize + gap);
            if (mouseX >= x && mouseX <= x + btnSize && mouseY >= y && mouseY <= y + btnSize) {
                let lvlSelected = i + 1;
                if (lvlSelected <= unlockedLevels) { currentLevel = lvlSelected; loadLevel(currentLevel); currentGameState = STATES.PLAYING; }
            }
        }
    } 
    else if (currentGameState === STATES.PLAYING) {
        if (paintAmmo <= 0) { loadLevel(currentLevel); return; }
        const angle = Math.atan2(mouseY - (player.y + player.height/2), mouseX - (player.x + player.width/2));
        paintBalls.push({ x: player.x + player.width/2, y: player.y + player.height/2, vx: Math.cos(angle) * 8, vy: Math.sin(angle) * 8, color: selectedColor });
        paintAmmo--;
    }
});

function updatePaintballs() {
    for (let i = paintBalls.length - 1; i >= 0; i--) {
        let b = paintBalls[i];
        b.x += b.vx; b.y += b.vy;
        let hit = false;

        waterErasers.forEach(w => {
            if (b.x >= w.x && b.x <= w.x + w.w && b.y >= w.y && b.y <= w.y + w.h) {
                hit = true; 
                b.evaporated = true; 
            }
        });

        if (b.y <= 0 || b.y >= canvas.height || b.x <= 0 || b.x >= canvas.width) hit = true;
        platforms.forEach(p => {
            if (b.x > p.x && b.x < p.x + p.w && b.y > p.y && b.y < p.y + p.h) hit = true;
        });

        if (hit) {
            if (!b.evaporated) {
                paintSplatters.push({ x: b.x, y: b.y, radius: 25, hitboxSize: 35, color: b.color });
            }
            paintBalls.splice(i, 1);
        }
    }

    waterErasers.forEach(w => {
        for (let i = paintSplatters.length - 1; i >= 0; i--) {
            let s = paintSplatters[i];
            if (s.x >= w.x - 10 && s.x <= w.x + w.w + 10 && s.y >= w.y - 10 && s.y <= w.y + w.h + 10) {
                paintSplatters.splice(i, 1);
            }
        }
    });

    hazmatDroppers.forEach(drop => {
        drop.timer++;
        if (drop.timer >= drop.interval) {
            drop.timer = 0;
            hazardDroplets.push({ x: drop.x + drop.w / 2 - 3, y: drop.y + drop.h, vy: 3 });
        }
    });

    for (let i = hazardDroplets.length - 1; i >= 0; i--) {
        let d = hazardDroplets[i];
        d.y += d.vy;
        let dropHit = false;
        if (d.y > canvas.height) dropHit = true;
        platforms.forEach(p => {
            if (d.x >= p.x && d.x <= p.x + p.w && d.y >= p.y && d.y <= p.y + p.h) dropHit = true;
        });
        if (dropHit) hazardDroplets.splice(i, 1);
    }
}

function loadLevel(level) {
    player.x = 40; player.y = 480; player.vx = 0; player.vy = 0;
    currentGravity = GRAVITY.DOWN; cameraX = 0;
    paintBalls = []; paintSplatters = []; spikes = []; plants = []; 
    starsInLevel = []; waterErasers = []; hazmatDroppers = []; hazardDroplets = [];

    paintAmmo = level === 1 ? 8 : (level === 2 ? 6 : 5); 

    platforms = [
        { x: 0, y: 560, w: 800, h: 40 },
        { x: 0, y: 0, w: 800, h: 40 }
    ];

    if (level === 1) {
        platforms.push({ x: 220, y: 300, w: 50, h: 260 }, { x: 390, y: 40, w: 50, h: 320 }, { x: 550, y: 250, w: 120, h: 25 }, { x: 700, y: 450, w: 100, h: 25 });
        spikes.push({ x: 290, y: 540, w: 20, h: 20 }, { x: 510, y: 540, w: 20, h: 20 });
        flag.x = 740; flag.y = 400;
        starsInLevel.push({ x: 180, y: 500, collected: false }, { x: 360, y: 120, collected: false }, { x: 600, y: 200, collected: false });
    } 
    else if (level === 2) {
        platforms.push({ x: 150, y: 160, w: 50, h: 400 }, { x: 340, y: 40, w: 50, h: 420 }, { x: 520, y: 160, w: 50, h: 400 }, { x: 650, y: 400, w: 150, h: 25 });
        for (let i = 0; i < 5; i++) spikes.push({ x: 220 + (i * 60), y: 540, w: 20, h: 20 });
        flag.x = 710; flag.y = 350;
        starsInLevel.push({ x: 100, y: 100, collected: false }, { x: 450, y: 500, collected: false }, { x: 600, y: 100, collected: false });
    } 
    else {
        let layoutSeed = Math.sin(level) * 1000;
        let totalIslands = 3 + (level % 3); 
        for (let i = 0; i < totalIslands; i++) {
            let pseudoRandomX = 150 + Math.abs(Math.sin(layoutSeed + i) * 450);
            let pseudoRandomY = 120 + Math.abs(Math.cos(layoutSeed * i) * 300);
            let islandWidth = Math.max(50, 100 - (level * 2));

            platforms.push({ x: pseudoRandomX, y: pseudoRandomY, w: islandWidth, h: 25 });
            
            let hasSpike = false;
            if (level >= 4 && i % 2 === 0) {
                spikes.push({ x: pseudoRandomX + (islandWidth / 2) - 10, y: pseudoRandomY - 20, w: 20, h: 20, isCeiling: false });
                hasSpike = true;
            }
            if (level >= 10) {
                spikes.push({ x: pseudoRandomX + (islandWidth / 2) - 10, y: pseudoRandomY + 25, w: 20, h: 20, isCeiling: true });
                hasSpike = true;
            }
            
            if (i < 3) {
    let starXOffset = hasSpike ? 5 : (islandWidth / 2) - 10;
    // Default star position is floating safely 30 pixels ABOVE the platform
    let starYOffset = -30; 

    // NEW: If there is a top spike, push the star DOWN below the platform instead so it's obtainable
    if (level >= 10) {
        starYOffset = 35; 
    }

    starsInLevel.push({ 
        x: pseudoRandomX + starXOffset, 
        y: pseudoRandomY + starYOffset, 
        collected: false 
    });
}
        }

        // Fill remaining structural targets if layout math didn't trigger full stars
        while(starsInLevel.length < 3) {
            starsInLevel.push({ x: 200 + (starsInLevel.length * 150), y: 240, collected: false });
        }

        if (level >= 15) { 
            waterErasers.push({ x: 300, y: 40, w: 35, h: 520 });
            if (level >= 30) waterErasers.push({ x: 500, y: 250, w: 25, h: 310 });
        }

        if (level >= 25) { 
            hazmatDroppers.push({ x: 200, y: 40, w: 40, h: 15, interval: Math.max(40, 120 - level), timer: 0 });
            hazmatDroppers.push({ x: 580, y: 40, w: 40, h: 15, interval: Math.max(50, 140 - level), timer: 0 });
        }

        let totalSpikes = 4 + Math.min(level, 8);
        for (let i = 0; i < totalSpikes; i++) {
            let spikeX = 200 + (i * (500 / totalSpikes));
            spikes.push({ x: spikeX, y: 540, w: 20, h: 20, isCeiling: false });
        }

        if (level >= 10) {
            for (let spikeX = 200; spikeX <= 600; spikeX += 20) spikes.push({ x: spikeX, y: 40, w: 20, h: 20, isCeiling: true });
        } else if (level >= 5) {
            for (let i = 0; i < 3; i++) spikes.push({ x: 300 + (i * 100), y: 40, w: 20, h: 20, isCeiling: true });
        }
        flag.x = 720; flag.y = 120 + Math.abs(Math.sin(layoutSeed) * 300);
    }

    let maxPlants = 12 + Math.min(level, 10); let spacingWidth = canvas.width / maxPlants;
    for (let i = 0; i < maxPlants; i++) {
        let plantX = (i * spacingWidth) + (Math.random() * 15 - 7); let decorationType = Math.floor(Math.random() * 4) + 1;
        let colors = ["#00f5d4", "#7b2cbf", "#ff007f", "#39ff14", "#fee440"];
        let wallSide = Math.random() < 0.5 ? "left" : "right";
        let finalY = 560;

        if (decorationType === 3 || decorationType === 4) {
            plantX = wallSide === "left" ? 80 : 720; 
            finalY = 100 + (Math.random() * 360); 
        }
        plants.push({ x: plantX, y: finalY, type: decorationType, side: wallSide, height: Math.random() * 25 + 20, width: Math.random() * 8 + 12, color: colors[Math.floor(Math.random() * colors.length)] });
    }
}

function drawStartScreen() {
    ctx.fillStyle = "#0c0512"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ff007f"; ctx.font = "bold 44px monospace"; ctx.textAlign = "center";
    ctx.fillText("PAINT GRAVITY", canvas.width / 2, 220);
    ctx.fillStyle = "#00f5d4"; ctx.font = "20px monospace";
    ctx.fillText("Flip reality. Splash the walls.", canvas.width / 2, 270);
    let flash = Math.floor(Date.now() / 500) % 2 === 0;
    ctx.fillStyle = flash ? "#ffffff" : "#6d218e"; ctx.font = "16px monospace";
    ctx.fillText("CLICK ANYWHERE TO START", canvas.width / 2, 400); ctx.textAlign = "left";
}

function drawLevelMenu() {
    ctx.fillStyle = "#0c0512"; ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#150a1f"; ctx.strokeStyle = "#ff007f"; ctx.lineWidth = 2;
    ctx.fillRect(20, 40, 120, 30); ctx.strokeRect(20, 40, 120, 30);
    ctx.fillStyle = "#ff007f"; ctx.font = "bold 12px monospace"; ctx.textAlign = "center";
    ctx.fillText("◄ MAIN MENU", 80, 59);

    ctx.fillStyle = "#150a1f"; ctx.strokeStyle = resetConfirm ? "#fee440" : "#ff3333";
    ctx.fillRect(660, 40, 120, 30); ctx.strokeRect(660, 40, 120, 30);
    ctx.fillStyle = resetConfirm ? "#fee440" : "#ff3333"; ctx.font = "bold 11px monospace";
    ctx.fillText(resetConfirm ? "ARE YOU SURE?" : "⚠️ RESET DATA", 720, 59);

    ctx.fillStyle = "#ffffff"; ctx.font = "28px monospace"; ctx.fillText("SELECT MISSIONS", canvas.width / 2, 60);
    ctx.font = "14px monospace"; ctx.fillStyle = "#aab2bd";
    ctx.fillText(`Unlocked: ${unlockedLevels} / ${MAX_LEVELS}`, canvas.width / 2, 90);

    let startX = 60, startY = 120; let btnSize = 50, gap = 18;
    for (let i = 0; i < MAX_LEVELS; i++) {
        let col = i % 10; let row = Math.floor(i / 10);
        let x = startX + col * (btnSize + gap); let y = startY + row * (btnSize + gap);
        let currentLvlNum = i + 1;

        if (currentLvlNum <= unlockedLevels) {
            ctx.fillStyle = "#2c1930"; ctx.strokeStyle = "#00f5d4";
            ctx.fillRect(x, y, btnSize, btnSize); ctx.strokeRect(x, y, btnSize, btnSize);
            ctx.fillStyle = "#ffffff";
            
            let starsSaved = levelStarsData[currentLvlNum] || 0;
            ctx.font = "11px monospace"; ctx.fillStyle = "#fee440";
            let starString = "★".repeat(starsSaved) + "☆".repeat(3 - starsSaved);
            ctx.fillText(starString, x + btnSize / 2, y + btnSize - 6);
        } else {
            ctx.fillStyle = "#150a1f"; ctx.strokeStyle = "#444";
            ctx.fillRect(x, y, btnSize, btnSize); ctx.strokeRect(x, y, btnSize, btnSize);
            ctx.fillStyle = "#555";
        }
        ctx.font = "bold 16px monospace";
        ctx.fillText(currentLvlNum, x + btnSize / 2, y + btnSize / 2 - 2);
    }
    ctx.textAlign = "left";
}

function drawGameSpace() {
    // --- 1. RESTORED ORIGINAL BACKGROUNDS MODULATED INTO PARALLAX DEPTHS ---
    ctx.fillStyle = "#0c0512"; // Deep space background fill
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Far Background Layer (factor 0.25)
    ctx.fillStyle = "#150a1f";
    ctx.fillRect(0 - (cameraX * 0.25), 0, 160, 200); 
    ctx.fillRect(160 - (cameraX * 0.25), 0, 240, 120); 
    ctx.fillRect(400 - (cameraX * 0.25), 0, 200, 80); 
    ctx.fillRect(600 - (cameraX * 0.25), 0, 200, 160);

    // Mid Background Layer (factor 0.5)
    ctx.fillStyle = "#1d0f2b";
    ctx.fillRect(0 - (cameraX * 0.5), 0, 80, 560); 
    ctx.fillRect(80 - (cameraX * 0.5), 120, 40, 300); 
    ctx.fillRect(120 - (cameraX * 0.5), 200, 40, 160); 
    ctx.fillRect(720 - (cameraX * 0.5), 0, 80, 560); 
    ctx.fillRect(680 - (cameraX * 0.5), 160, 40, 240);

    // Close Background Details Layer (factor 0.75)
    ctx.fillStyle = "#251436";
    ctx.fillRect(300 - (cameraX * 0.75), 80, 8, 20); 
    ctx.fillRect(308 - (cameraX * 0.75), 100, 8, 30); 
    ctx.fillRect(550 - (cameraX * 0.75), 140, 8, 40);

    // 2. FULLY RESTORED ORIGINAL PIXEL-ART ALIEN FLORA VARIETIES
    plants.forEach(p => {
        ctx.save();
        if (p.type === 1) {
            ctx.fillStyle = p.color; let segments = 5; let segHeight = p.height / segments;
            for (let i = 0; i < segments; i++) { let xOffset = (i % 2 === 0) ? 3 : -3; ctx.fillRect(p.x + xOffset - 2, p.y - (i * segHeight) - segHeight, 5, segHeight); }
            ctx.fillStyle = "#ffffff"; ctx.fillRect(p.x - 3, p.y - p.height - 3, 7, 3);
        } else if (p.type === 2) {
            ctx.fillStyle = "#a29bfe"; ctx.fillRect(p.x - 2, p.y - p.height, 4, p.height);
            ctx.fillStyle = p.color; ctx.fillRect(p.x - 10, p.y - p.height - 3, 20, 3); ctx.fillRect(p.x - 14, p.y - p.height - 6, 28, 3); ctx.fillRect(p.x - 6, p.y - p.height - 9, 12, 3);
        } else if (p.type === 3) {
            let dir = p.side === "left" ? 1 : -1; ctx.fillStyle = "#6c5ce7"; ctx.fillRect(p.x, p.y - 3, 10 * dir, 6); ctx.fillStyle = p.color;
            if (p.side === "left") { ctx.fillRect(p.x + 8, p.y - 12, 12, 18); ctx.fillRect(p.x + 20, p.y - 8, 4, 12); } 
            else { ctx.fillRect(p.x - 20, p.y - 12, 12, 18); ctx.fillRect(p.x - 24, p.y - 8, 4, 12); }
        } else if (p.type === 4) {
            ctx.fillStyle = p.color; let segments = 6; let segHeight = p.height / segments; let dir = p.side === "left" ? 1 : -1;
            for (let i = 0; i < segments; i++) { let xOffset = (i % 2 === 0) ? 2 : 5; ctx.fillRect(p.x + (xOffset * dir), p.y + (i * segHeight), 3, segHeight); }
            ctx.fillStyle = "#ffffff"; ctx.fillRect(p.x + (4 * dir) - 1, p.y + p.height, 5, 4);
        }
        ctx.restore();
    });

    // 3. TEXTURED COBBLESTONE PLATFORMS
    platforms.forEach(p => {
        ctx.fillStyle = "#2c1930"; ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = "#201124";
        for (let bx = p.x; bx < p.x + p.w; bx += 16) ctx.fillRect(bx, p.y, 2, p.h);
        for (let by = p.y; by < p.y + p.h; by += 12) ctx.fillRect(p.x, by, p.w, 2);
        ctx.fillStyle = "#5c336b"; ctx.fillRect(p.x, p.y, p.w, 3);
    });

    // 4. WATER PAINT ERASERS
    waterErasers.forEach(w => {
        ctx.fillStyle = "rgba(0, 191, 255, 0.35)"; ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.fillStyle = "#00bfff"; ctx.fillRect(w.x - 2, w.y, 2, w.h); ctx.fillRect(w.x + w.w, w.y, 2, w.h);
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        for (let wy = w.y + 10; wy < w.y + w.h; wy += 35) {
            let xOffset = Math.sin((Date.now() / 300) + wy) * (w.w / 3);
            ctx.fillRect(w.x + (w.w / 2) + xOffset, wy, 3, 3);
        }
    });

    // 5. HAZMAT DROPPERS
    hazmatDroppers.forEach(drop => {
        ctx.fillStyle = "#4a5568"; ctx.fillRect(drop.x, drop.y, drop.w, drop.h);
        ctx.fillStyle = "#39ff14"; ctx.fillRect(drop.x + 8, drop.y + drop.h - 4, drop.w - 16, 4);
    });
    hazardDroplets.forEach(d => {
        ctx.fillStyle = "#39ff14"; ctx.fillRect(d.x, d.y, 6, 8); ctx.fillRect(d.x + 1, d.y - 2, 4, 2);
    });

    // 6. FULLY RESTORED ORIGINAL STEPPED SHINY CRYSTAL HAZARDS (SPIKES)
    spikes.forEach(s => {
        ctx.save(); let spikeRows = s.h;
        for (let i = 0; i < spikeRows; i++) {
            let rowW = s.w * ((spikeRows - i) / spikeRows);
            let rowX = s.x + (s.w - rowW) / 2;
            let rowY = s.isCeiling ? (s.y + i) : ((s.y + s.h) - i);
            ctx.fillStyle = "#ff007f"; ctx.fillRect(rowX - 2, rowY, rowW + 4, 1);
            ctx.fillStyle = "#6d218e"; ctx.fillRect(rowX, rowY, rowW / 2, 1);
            ctx.fillStyle = "#be2edd"; ctx.fillRect(s.x + s.w / 2, rowY, rowW / 2, 1);
        }
        ctx.fillStyle = "#ffffff";
        let tipY = s.isCeiling ? (s.y + s.h - 1) : s.y;
        ctx.fillRect(s.x + s.w / 2 - 1, tipY, 3, 2);
        ctx.restore();
    });

    // 7. TARGET PICKUP STARS
    starsInLevel.forEach(star => {
        if (!star.collected) {
            ctx.save(); let hoverOffset = Math.sin((Date.now() / 200) + star.x) * 5;
            ctx.fillStyle = "#fee440"; ctx.shadowColor = "#fee440"; ctx.shadowBlur = 15;
            let sx = star.x; let sy = star.y + hoverOffset;
            ctx.fillRect(sx + 6, sy, 4, 16); ctx.fillRect(sx, sy + 6, 16, 4); ctx.fillRect(sx + 3, sy + 3, 10, 10);
            ctx.fillStyle = "#ffffff"; ctx.fillRect(sx + 6, sy + 6, 4, 4);
            ctx.restore();
        }
    });

    // 8. PIXEL GOAL FLAG
    ctx.save();
    let flagGlowSize = 25 + Math.sin(Date.now() / 200) * 10;
    ctx.shadowColor = "#fee440"; ctx.shadowBlur = flagGlowSize;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(flag.x, flag.y, 4, flag.height); 
    ctx.fillStyle = "#fee440"; ctx.beginPath();
    ctx.moveTo(flag.x + 4, flag.y); ctx.lineTo(flag.x + 28, flag.y + 10); ctx.lineTo(flag.x + 4, flag.y + 20); ctx.closePath(); ctx.fill();
    ctx.restore();

    // 9. ORIGINAL DETAILED SQUARE SPLATTERS
    paintSplatters.forEach(splat => {
        ctx.fillStyle = splat.color;
        if (splat.dripLen === undefined) splat.dripLen = 0;
        if (splat.dripLen < 20 && Math.random() < 0.2) splat.dripLen += 0.8;
        let isCeiling = splat.y < 100; let dripDir = isCeiling ? -1 : 1;
        ctx.fillRect(splat.x - 14, splat.y - 10, 28, 20);
        ctx.fillRect(splat.x - 9, splat.y, 5, 10 + (splat.dripLen * dripDir));   
        ctx.fillRect(splat.x + 3, splat.y, 6, 8 + (splat.dripLen * 1.4 * dripDir)); 
        ctx.fillRect(splat.x - 22, splat.y - 6, 8, 10); ctx.fillRect(splat.x + 14, splat.y - 7, 7, 12);  
        let speckOffset = (16 + splat.dripLen * 1.6) * dripDir; ctx.fillRect(splat.x + 4, splat.y + speckOffset, 4, 5);
    });

    // 10. ASTRONAUT & GUN
    ctx.save();
    let centerX = player.x + player.width / 2; let centerY = player.y + player.height / 2;
    ctx.translate(centerX, centerY);
    
    canvas.onmousemove = function(e) {
        const rect = canvas.getBoundingClientRect();
        canvas.mouseX = e.clientX - rect.left; canvas.mouseY = e.clientY - rect.top;
    };
    let targetX = canvas.mouseX || 0; let targetY = canvas.mouseY || 0;
    
    let gravityAngle = 0;
    switch (currentGravity) {
        case GRAVITY.UP: gravityAngle = Math.PI; ctx.rotate(Math.PI); break;
        case GRAVITY.LEFT: gravityAngle = Math.PI / 2; ctx.rotate(Math.PI / 2); break;
        case GRAVITY.RIGHT: gravityAngle = -Math.PI / 2; ctx.rotate(-Math.PI / 2); break;
        default: gravityAngle = 0; ctx.rotate(0); break;
    }
    
    let pw = player.width; let ph = player.height; let px = -pw / 2; let py = -ph / 2;
    let legOffset = Math.floor(Math.sin(player.walkFrame) * 5);
    
    ctx.fillStyle = "#ccd1d9";
    if (player.facing === "right") ctx.fillRect(px - 3, py + 12, 6, 22); else ctx.fillRect(px + pw - 3, py + 12, 6, 22);
    ctx.fillStyle = "#e6e9ed"; ctx.fillRect(px + 3, py + 12, pw - 6, 20);
    ctx.fillStyle = "#ff3333"; ctx.fillRect(px + 10, py + 16, 4, 4);
    ctx.fillStyle = "#2f3542"; ctx.fillRect(px + 6, py + 16, 3, 5);
    ctx.fillStyle = "#aab2bd";
    if (player.isWalking) { ctx.fillRect(px + 4, py + 32, 6, 8 + legOffset); ctx.fillRect(px + pw - 10, py + 32, 6, 8 - legOffset); } 
    else { ctx.fillRect(px + 4, py + 32, 6, 10); ctx.fillRect(px + pw - 10, py + 32, 6, 10); }
    ctx.fillStyle = "#e6e9ed"; ctx.fillRect(px + 4, py, pw - 8, 12); ctx.fillRect(px + 2, py + 2, pw - 4, 10);
    ctx.fillStyle = "#1c2024";
    if (player.facing === "right") ctx.fillRect(px + 12, py + 3, 14, 8); else ctx.fillRect(px + 4, py + 3, 14, 8);
    ctx.fillStyle = "#ffffff";
    if (player.facing === "right") ctx.fillRect(px + 20, py + 5, 2, 2); else ctx.fillRect(px + 6, py + 5, 2, 2);

    // Aiming Gun Sub-layer Matrix
    ctx.save();
    let absoluteAimAngle = Math.atan2(targetY - centerY, targetX - centerX);
    let relativeAimAngle = absoluteAimAngle - gravityAngle;
    let armX = player.facing === "right" ? (px + 14) : (px + pw - 14); let armY = py + 20;
    ctx.translate(armX, armY); ctx.rotate(relativeAimAngle);
    if (Math.cos(absoluteAimAngle) < 0) ctx.scale(1, -1);

    ctx.fillStyle = "#5d6a7a"; ctx.fillRect(0, -3, 14, 6); ctx.fillRect(2, 2, 3, 5); 
    ctx.fillStyle = selectedColor; ctx.fillRect(1, -7, 7, 4); ctx.fillStyle = "#aab2bd"; ctx.fillRect(0, -8, 9, 1);
    ctx.fillStyle = "#3a414c"; ctx.fillRect(12, -3, 2, 6);
    ctx.restore();
    
    ctx.fillStyle = "#ccd1d9";
    if (player.facing === "right") ctx.fillRect(px + 10, py + 18, 6, 5); else ctx.fillRect(px + pw - 16, py + 18, 6, 5);
    ctx.restore();

    // 11. PIXEL PROJECTILES & HUD
    paintBalls.forEach(b => { ctx.fillStyle = b.color; ctx.fillRect(b.x - 3, b.y - 3, 6, 6); });

    ctx.fillStyle = "#fff"; ctx.font = "16px monospace";
    ctx.fillText(`LEVEL: ${currentLevel}  |  SHOTS: ${paintAmmo}`, 20, 30);
    ctx.fillStyle = "#aab2bd"; ctx.fillText("ESC: MENU | R: RESET", 560, 30);
    
    ctx.fillStyle = "#fee440";
    let starsCollectedCount = starsInLevel.filter(s => s.collected).length;
    ctx.fillText(`STARS: ` + "★".repeat(starsCollectedCount) + "☆".repeat(3 - starsCollectedCount), 320, 30);
    
    ctx.fillStyle = "#fff"; ctx.fillText("GRAVITY KEY: ", 20, 55);
    ctx.fillStyle = "#00f5d4"; ctx.fillText("Blue=Up", 140, 55);
    ctx.fillStyle = "#ff007f"; ctx.fillText(" | Red=Down", 210, 55);
    ctx.fillStyle = "#fee440"; ctx.fillText(" | Yellow=Left", 315, 55);
    ctx.fillStyle = "#39ff14"; ctx.fillText(" | Green=Right", 445, 55);
    ctx.fillStyle = "#fff"; ctx.fillText(`Selected Paint: ${selectedColor.toUpperCase()} (1:Blue, 2:Red, 3:Yellow, 4:Green)`, 20, 80);

    if (currentLevel >= 15) { ctx.fillStyle = "#00bfff"; ctx.fillText("💧 WATER FIELD ACTIVE (Wipes Paint)", 530, 55); }
    if (currentLevel >= 25) { ctx.fillStyle = "#39ff14"; ctx.fillText("⚠️ HAZMAT SYSTEM ARMED (Avoid Sludge)", 460, 80); }

    // --- 12. FULLY RESTORED BOXED TUTORIAL OVERLAYS FOR LEVEL 1 ---
    if (currentLevel === 1) {
        ctx.save(); ctx.font = "bold 14px monospace"; ctx.fillStyle = "rgba(12, 5, 18, 0.85)"; ctx.strokeStyle = "#00f5d4"; ctx.lineWidth = 2;
        if (player.x < 180 && currentGravity === GRAVITY.DOWN) {
            ctx.fillRect(40, 120, 240, 75); ctx.strokeRect(40, 120, 240, 75); ctx.fillStyle = "#ffffff";
            ctx.fillText("MISSION: Reach the yellow flag!", 50, 140); ctx.fillStyle = "#fee440"; ctx.fillText("Move: A/D or Left/Right Arrows.", 50, 160); ctx.fillStyle = "#00f5d4"; ctx.fillText("Aim with MOUSE & CLICK to shoot.", 50, 180);
        } else if (player.x < 240 && currentGravity === GRAVITY.DOWN) {
            ctx.fillRect(80, 190, 340, 90); ctx.strokeRect(80, 190, 340, 90); ctx.fillStyle = "#ff007f";
            ctx.fillText("WAY BLOCKED!", 90, 210); ctx.fillStyle = "#ffffff"; ctx.fillText("1. Press 1 to select BLUE paint.", 90, 230); ctx.fillStyle = "#00f5d4"; ctx.fillText("2. Shoot blue on the ground.", 90, 250); ctx.fillStyle = "#fee440"; ctx.fillText("3. WALK INTO IT to flip gravity!", 90, 270);
        } else if (currentGravity === GRAVITY.UP && player.x < 450) {
            ctx.fillRect(250, 190, 350, 90); ctx.strokeRect(250, 190, 350, 90); ctx.fillStyle = "#00f5d4";
            ctx.fillText("GRAVITY INVERTED!", 260, 210); ctx.fillStyle = "#ffffff"; ctx.fillText("Walk past the wall upside down.", 260, 230); ctx.fillStyle = "#ff007f"; ctx.fillText("Press 2 to activate the RED paint", 260, 250); ctx.fillStyle = "#fee440"; ctx.fillText("shoot and step on it to drop down!", 260, 270);
        } else if (player.x >= 450 && player.x < 680) {
            ctx.fillRect(440, 110, 330, 90); ctx.strokeRect(440, 110, 330, 90); ctx.fillStyle = "#ff007f";
            ctx.fillText("WATCH THE CRYSTALS!", 450, 130); ctx.fillStyle = "#ffffff"; ctx.fillText("Avoid pink spikes! To climb walls later:", 450, 150); ctx.fillStyle = "#39ff14"; ctx.fillText("Paint GREEN (4) or YELLOW (3), then", 450, 170); ctx.fillStyle = "#fee440"; ctx.fillText("step onto the color to change gravity!", 450, 190);
        }
        ctx.restore();
    }
}

function gameLoop() {
    if (currentGameState === STATES.START_SCREEN) {
        drawStartScreen();
    } else if (currentGameState === STATES.LEVEL_MENU) {
        drawLevelMenu();
    } else if (currentGameState === STATES.PLAYING) {
        updatePlayer();
        updatePaintballs();
        drawGameSpace();
    }
    requestAnimationFrame(gameLoop);
}

gameLoop();