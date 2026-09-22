const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Gravity Directions
const GRAVITY = { DOWN: 0, UP: 1, LEFT: 2, RIGHT: 3 };
let currentGravity = GRAVITY.DOWN;
const gravityStrength = 0.3;

// Game States (All states declared at once)
const STATES = {
    START_SCREEN: 0,
    LEVEL_MENU: 1,
    LEVEL_POPUP: 2, // <-- MAKE SURE THIS LINE IS HERE
    ACHIEVEMENTS: 3,
    PLAYING: 4
};

let currentGameState = STATES.START_SCREEN;
let selectedLevelForPopup = 1;
let currentRecordedRun = []; // Tracks current play session frame-by-frame
let activeGhostData = null;  // Loaded ghost run to replay
let isGhostActive = false;   // True when "Play with Ghost" is clicked

const MAX_LEVELS = 50;

// Floating background particles for Start Screen
let menuParticles = [];
for (let i = 0; i < 25; i++) {
    menuParticles.push({
        x: Math.random() * 800,
        y: Math.random() * 600,
        radius: Math.random() * 6 + 2,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        color: ["#00f5d4", "#7b2cbf", "#ff007f", "#fee440"][Math.floor(Math.random() * 4)]
    });
}

// Global mouse tracking for gun aiming & trajectory
let mouseX = 0;
let mouseY = 0;
// Global Achievements Object (Saved to LocalStorage)
let achievements = JSON.parse(localStorage.getItem("gameAchievements")) || {
    SPEED_DEMON: { title: "Speed Demon", desc: "Beat any level in under 10 seconds", icon: "⚡", unlocked: false },
    STAR_COLLECTOR: { title: "Star Collector", desc: "Earn 25 total stars", icon: "⭐", unlocked: false },
    STAR_MASTER: { title: "Cosmic Master", desc: "Collect all 150 stars!", icon: "🌟", unlocked: false },
    GRAVITY_WARPER: { title: "Gravity Warper", desc: "Paint 50 splatters total", icon: "🎨", unlocked: false },
    PERFECT_RUN: { title: "Perfectionist", desc: "Get 3 stars on Level 1", icon: "🏆", unlocked: false }
};

// Simple tracker for total splatters shot across all sessions
let totalSplattersShot = parseInt(localStorage.getItem("totalSplattersShot") || "0");

// Progression & Storage
let unlockedLevels = parseInt(localStorage.getItem("paintGravity_unlockedLevels")) || 1;
let levelStarsData = JSON.parse(localStorage.getItem("paintGravity_starsData")) || {}; 
let resetConfirm = false;
let paintAmmo = 0;

let levelData = JSON.parse(localStorage.getItem("gameProgress")) || {};
let levelStartTime = 0;
let levelBestTimes = JSON.parse(localStorage.getItem("levelBestTimes")) || {};
function unlockNextLevel(completedLevel, starsEarned) {
    if (typeof levelData === "undefined" || !levelData) {
        window.levelData = JSON.parse(localStorage.getItem("gameProgress")) || { 
            1: { unlocked: true, stars: 0, bestTime: null } 
        };
    }

    // Calculate completion time
    let timeTaken = levelStartTime ? parseFloat(((Date.now() - levelStartTime) / 1000).toFixed(2)) : null;

    // Call inside unlockNextLevel(completedLevel, starsEarned):
timeTaken = levelStartTime ? parseFloat(((Date.now() - levelStartTime) / 1000).toFixed(2)) : null;

// 🏆 Trigger achievement checks!
checkAchievements(completedLevel, timeTaken, starsEarned);


    // Initialize level entry if it doesn't exist
    if (!levelData[completedLevel]) {
        levelData[completedLevel] = { unlocked: true, stars: 0, bestTime: null };
    }

    // Update stars (keep highest)
    levelData[completedLevel].stars = Math.max(levelData[completedLevel].stars || 0, starsEarned);

    // Update best time (keep lowest non-null time)
    if (timeTaken !== null) {
        if (!levelData[completedLevel].bestTime || timeTaken < levelData[completedLevel].bestTime) {
            levelData[completedLevel].bestTime = timeTaken;
        }
    }

    // Unlock next level
    let maxLvl = typeof MAX_LEVELS !== "undefined" ? MAX_LEVELS : 50;
    let nextLevel = completedLevel + 1;

    if (nextLevel <= maxLvl) {
        if (!levelData[nextLevel]) {
            levelData[nextLevel] = { unlocked: true, stars: 0, bestTime: null };
        } else {
            levelData[nextLevel].unlocked = true;
        }

        if (typeof unlockedLevels !== "undefined") {
            unlockedLevels = Math.max(unlockedLevels, nextLevel);
        }
    }

    // Save to LocalStorage
    try {
        localStorage.setItem("gameProgress", JSON.stringify(levelData));
    } catch (e) {
        console.warn("Could not save progress:", e);
    }
}
function getTotalStarsEarned() {
    if (typeof levelData === "undefined" || !levelData) return 0;
    
    let total = 0;
    for (let level in levelData) {
        if (levelData[level] && levelData[level].stars) {
            total += levelData[level].stars;
        }
    }
    return total;
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

// Track mouse positioning variables safely globally
canvas.mouseX = 0;
canvas.mouseY = 0;

window.addEventListener("keydown", e => keys[e.key] = true);
window.addEventListener("keyup", e => keys[e.key] = false);

function drawAchievementsMenu() {
    // 1. Background & Header
    ctx.fillStyle = "#0a0310"; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#12081f";
    ctx.fillRect(180, 15, canvas.width - 360, 60);
    ctx.strokeStyle = "#00f5d4";
    ctx.lineWidth = 2;
    ctx.strokeRect(180, 15, canvas.width - 360, 60);

    ctx.fillStyle = "#00f5d4";
    ctx.font = "bold 24px monospace";
    ctx.textAlign = "center";
    ctx.fillText("HONORS & ACHIEVEMENTS", canvas.width / 2, 52);

    // Back to Menu Button
    ctx.fillStyle = "#160726"; 
    ctx.strokeStyle = "#ff007f"; 
    ctx.lineWidth = 2;
    ctx.fillRect(20, 20, 130, 36); 
    ctx.strokeRect(20, 20, 130, 36);
    ctx.fillStyle = "#ff007f"; 
    ctx.font = "bold 12px monospace";
    ctx.fillText("◄ MAIN MENU", 85, 43);

    // 2. Draw Achievement Cards
    let keys = Object.keys(achievements);
    let startY = 100;
    let cardW = canvas.width - 120;
    let cardH = 55;
    let gap = 12;

    keys.forEach((key, index) => {
        let ach = achievements[key];
        let y = startY + index * (cardH + gap);
        let x = 60;

        // Custom description string with counter for Gravity Warper
        let descriptionText = ach.desc;
        if (key === "GRAVITY_WARPER") {
            let currentSplatters = Math.min(totalSplattersShot || 0, 50);
            descriptionText = `${ach.desc} (${currentSplatters}/50)`;
        }

        if (ach.unlocked) {
            // --- UNLOCKED CARD STYLE ---
            ctx.fillStyle = "#1d0f2b";
            ctx.fillRect(x, y, cardW, cardH);
            ctx.strokeStyle = "#fee440";
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, cardW, cardH);

            ctx.textAlign = "left";
            ctx.font = "20px monospace";
            ctx.fillText(ach.icon, x + 15, y + 35);

            ctx.fillStyle = "#fee440";
            ctx.font = "bold 16px monospace";
            ctx.fillText(ach.title, x + 50, y + 25);

            ctx.fillStyle = "#ffffff";
            ctx.font = "12px monospace";
            ctx.fillText(descriptionText, x + 50, y + 43);

            ctx.textAlign = "right";
            ctx.fillStyle = "#39ff14";
            ctx.font = "bold 12px monospace";
            ctx.fillText("UNLOCKED ✓", x + cardW - 20, y + 33);
        } else {
            // --- LOCKED CARD STYLE ---
            ctx.fillStyle = "#12081f";
            ctx.fillRect(x, y, cardW, cardH);
            ctx.strokeStyle = "#34495e";
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, cardW, cardH);

            ctx.textAlign = "left";
            ctx.fillStyle = "#4a5568";
            ctx.font = "20px monospace";
            ctx.fillText("🔒", x + 15, y + 35);

            ctx.font = "bold 16px monospace";
            ctx.fillText(ach.title, x + 50, y + 25);

            ctx.font = "12px monospace";
            ctx.fillText(descriptionText, x + 50, y + 43);

            ctx.textAlign = "right";
            ctx.font = "bold 12px monospace";
            ctx.fillText("LOCKED", x + cardW - 20, y + 33);
        }
    });

    ctx.textAlign = "left"; // Reset alignment
}

function checkAchievements(levelNum, timeTaken, starsEarned) {
    let unlockedNew = false;

    // 1. Speed Demon (Beat level in < 10s)
    if (timeTaken && timeTaken < 10.0 && !achievements.SPEED_DEMON.unlocked) {
        achievements.SPEED_DEMON.unlocked = true;
        unlockedNew = true;
    }

    // 2. Star Milestones
    let totalStars = 0;
    if (typeof levelData !== "undefined") {
        for (let lvl in levelData) {
            totalStars += (levelData[lvl].stars || 0);
        }
    }

    if (totalStars >= 25 && !achievements.STAR_COLLECTOR.unlocked) {
        achievements.STAR_COLLECTOR.unlocked = true;
        unlockedNew = true;
    }

    if (totalStars >= 150 && !achievements.STAR_MASTER.unlocked) {
        achievements.STAR_MASTER.unlocked = true;
        unlockedNew = true;
    }

    // 3. Perfect Run (3 Stars on Level 1)
    if (levelNum === 1 && starsEarned === 3 && !achievements.PERFECT_RUN.unlocked) {
        achievements.PERFECT_RUN.unlocked = true;
        unlockedNew = true;
    }

    // 4. Gravity Warper (50 Splatters Shot)
    if (totalSplattersShot >= 50 && !achievements.GRAVITY_WARPER.unlocked) {
        achievements.GRAVITY_WARPER.unlocked = true;
        unlockedNew = true;
    }

    // Save achievements if any unlocked
    if (unlockedNew) {
        try {
            localStorage.setItem("gameAchievements", JSON.stringify(achievements));
        } catch (e) {
            console.warn("Could not save achievements:", e);
        }
    }
}

function updatePlayer() {
    player.isWalking = false;

    // 1. Set Facing Direction and Walking State based on Active Gravity
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

    // Reset grounded check before movement & collision checks
    player.onGround = false;

    // First check platform collisions from previous frame position to verify if player is on the ground
    platforms.forEach(p => {
        if (currentGravity === GRAVITY.DOWN && player.y + player.height === p.y && player.x + player.width > p.x && player.x < p.x + p.w) {
            player.onGround = true;
        } else if (currentGravity === GRAVITY.UP && player.y === p.y + p.h && player.x + player.width > p.x && player.x < p.x + p.w) {
            player.onGround = true;
        } else if (currentGravity === GRAVITY.LEFT && player.x === p.x + p.w && player.y + player.height > p.y && player.y < p.y + p.h) {
            player.onGround = true;
        } else if (currentGravity === GRAVITY.RIGHT && player.x + player.width === p.x && player.y + player.height > p.y && player.y < p.y + p.h) {
            player.onGround = true;
        }
    });

    // 2. Apply Gravity Acceleration and Movement Inputs
    switch (currentGravity) {
        case GRAVITY.DOWN:
            player.vy += gravityStrength;
            if (keys["a"] || keys["ArrowLeft"]) player.vx = -player.speed;
            else if (keys["d"] || keys["ArrowRight"]) player.vx = player.speed;
            else player.vx = 0;

            if ((keys["w"] || keys["ArrowUp"] || keys[" "]) && player.onGround) { 
                player.vy = -player.jumpForce; 
                player.onGround = false;
            }
            break;

        case GRAVITY.UP:
            player.vy -= gravityStrength;
            if (keys["a"] || keys["ArrowLeft"]) player.vx = -player.speed;
            else if (keys["d"] || keys["ArrowRight"]) player.vx = player.speed;
            else player.vx = 0;

            if ((keys["s"] || keys["ArrowDown"] || keys[" "]) && player.onGround) { 
                player.vy = player.jumpForce; 
                player.onGround = false;
            }
            break;

        case GRAVITY.LEFT:
            player.vx -= gravityStrength;
            if (keys["w"] || keys["ArrowUp"]) player.vy = -player.speed;
            else if (keys["s"] || keys["ArrowDown"]) player.vy = player.speed;
            else player.vy = 0;

            if ((keys["d"] || keys["ArrowRight"] || keys[" "]) && player.onGround) { 
                player.vx = player.jumpForce; 
                player.onGround = false;
            }
            break;

        case GRAVITY.RIGHT:
            player.vx += gravityStrength;
            if (keys["w"] || keys["ArrowUp"]) player.vy = -player.speed;
            else if (keys["s"] || keys["ArrowDown"]) player.vy = player.speed;
            else player.vy = 0;

            if ((keys["a"] || keys["ArrowLeft"] || keys[" "]) && player.onGround) { 
                player.vx = -player.jumpForce; 
                player.onGround = false;
            }
            break;
    }

    // Apply Velocity
    player.x += player.vx;
    player.y += player.vy;

    // 👻 RECORD PLAYER MOVEMENT FRAME-BY-FRAME FOR GHOST REPLAY
  if (typeof currentRecordedRun !== "undefined" && Array.isArray(currentRecordedRun)) {
    currentRecordedRun.push({ 
        x: Math.round(player.x * 10) / 10, 
        y: Math.round(player.y * 10) / 10 
    });
}
    
    // Smooth camera target update
    if (typeof canvas !== "undefined" && canvas) {
        cameraX += ((player.x - canvas.width / 2) - cameraX) * 0.1;
    }

    // 3. Platform Collision Resolution & Ground State Detection
    platforms.forEach(p => {
        if (player.x < p.x + p.w && player.x + player.width > p.x && player.y < p.y + p.h && player.y + player.height > p.y) {
            let overlapX = Math.min((player.x + player.width) - p.x, (p.x + p.w) - player.x);
            let overlapY = Math.min((player.y + player.height) - p.y, (p.y + p.h) - player.y);

            if (overlapX < overlapY) {
                if (player.vx > 0 && player.x < p.x) { 
                    player.x = p.x - player.width; 
                    player.vx = 0; 
                    if (currentGravity === GRAVITY.RIGHT) player.onGround = true; 
                } 
                else if (player.vx < 0 && player.x > p.x) { 
                    player.x = p.x + p.w; 
                    player.vx = 0; 
                    if (currentGravity === GRAVITY.LEFT) player.onGround = true; 
                }
            } else {
                if (player.vy > 0 && player.y < p.y) { 
                    player.y = p.y - player.height; 
                    player.vy = 0; 
                    if (currentGravity === GRAVITY.DOWN) player.onGround = true; 
                } 
                else if (player.vy < 0 && player.y > p.y) { 
                    player.y = p.y + p.h; 
                    player.vy = 0; 
                    if (currentGravity === GRAVITY.UP) player.onGround = true; 
                }
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

    // 🚩 FLAG COLLISION WITH BEST TIME & GHOST SAVING
    if (
        player.x < (flag.x + (flag.width || 20)) &&
        player.x + player.width > flag.x &&
        player.y < (flag.y + (flag.height || 40)) &&
        player.y + player.height > flag.y
    ) {
        player.vx = 0;
        player.vy = 0;

        let starsCollected = (Array.isArray(starsInLevel)) ? starsInLevel.filter(s => s.collected).length : 0;
        
        // Calculate completion time in seconds
        let completionTime = levelStartTime ? parseFloat(((Date.now() - levelStartTime) / 1000).toFixed(2)) : 0;

        try {
            // Check if this run beat the level's previous best time
            let currentBest = typeof levelBestTimes !== "undefined" ? levelBestTimes[currentLevel] : undefined;
            if (currentBest === undefined || completionTime < currentBest) {
                // Save ghost frame data to localStorage for this level
                if (typeof currentRecordedRun !== "undefined") {
                    localStorage.setItem(`paintGravity_ghost_lvl_${currentLevel}`, JSON.stringify(currentRecordedRun));
                }
            }

            // Save Stars & Best Time
            if (typeof saveLevelStars === "function") {
                saveLevelStars(currentLevel, starsCollected);
            }
            if (typeof saveBestTime === "function") {
                saveBestTime(currentLevel, completionTime);
            }

            // Unlock next level
            if (typeof unlockNextLevel === "function") {
                unlockNextLevel(currentLevel, starsCollected);
            } else if (currentLevel + 1 > unlockedLevels) {
                unlockedLevels = currentLevel + 1;
                localStorage.setItem("paintGravity_unlockedLevels", unlockedLevels);
            }

            let maxLvl = typeof MAX_LEVELS !== "undefined" ? MAX_LEVELS : 50;

            if (currentLevel >= maxLvl) {
                if (typeof STATES !== "undefined" && STATES.LEVEL_MENU) {
                    currentGameState = STATES.LEVEL_MENU;
                }
            } else {
                currentLevel++;
                levelStartTime = Date.now();
                loadLevel(currentLevel);
            }
        } catch (err) {
            alert("🚨 CRASH DETECTED IN UNLOCK/LOADLEVEL 🚨\n\nError: " + err.message);
        }
        return;
    }

    // Out-of-bounds reset check
    if (typeof canvas !== "undefined" && canvas) {
        if (player.y > canvas.height + 50 || player.x < -50 || player.x > canvas.width + 50 || player.y < -50) {
            loadLevel(currentLevel);
        }
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
// Constantly update mouse coordinates as the player moves the cursor
canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
});
canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // --- 1. START SCREEN ---
    if (currentGameState === STATES.START_SCREEN) {
        let btnW = 220, btnH = 50;
        let btnX = (canvas.width - btnW) / 2;

        if (mouseX >= btnX && mouseX <= btnX + btnW && mouseY >= 230 && mouseY <= 230 + btnH) {
            currentGameState = STATES.LEVEL_MENU;
        }

        if (mouseX >= btnX && mouseX <= btnX + btnW && mouseY >= 300 && mouseY <= 300 + btnH) {
            currentGameState = STATES.ACHIEVEMENTS;
        }
    } 

    // --- 2. ACHIEVEMENTS MENU ---
    else if (currentGameState === STATES.ACHIEVEMENTS) {
        if (mouseX >= 20 && mouseX <= 150 && mouseY >= 20 && mouseY <= 56) {
            currentGameState = STATES.START_SCREEN;
        }
    }

    // --- 3. LEVEL SELECT MENU ---
    else if (currentGameState === STATES.LEVEL_MENU) {
        // Clicked "◄ MAIN MENU"
        if (mouseX >= 20 && mouseX <= 140 && mouseY >= 20 && mouseY <= 56) {
            resetConfirm = false;
            currentGameState = STATES.START_SCREEN;
            return;
        }

// Clicked "RESET DATA"
        if (mouseX >= 660 && mouseX <= 780 && mouseY >= 40 && mouseY <= 70) {
            if (!resetConfirm) { 
                resetConfirm = true; 
            } else { 
                // 1. Reset in-memory game variables
                unlockedLevels = 1; 
                levelStarsData = {}; 
                levelBestTimes = {};
                totalSplattersShot = 0;

                // Reset levelData objects if present
                if (typeof levelData !== "undefined") {
                    for (let lvl in levelData) {
                        levelData[lvl].unlocked = (parseInt(lvl) === 1);
                        levelData[lvl].stars = 0;
                    }
                }

                // Reset achievements if present
                if (typeof achievements !== "undefined") {
                    for (let key in achievements) {
                        achievements[key].unlocked = false;
                    }
                }

                // 2. Clear stored values from browser localStorage permanently
                localStorage.removeItem("gameProgress"); // Removes the progress key causing the state restore
                localStorage.removeItem("paintGravity_unlockedLevels");
                localStorage.removeItem("paintGravity_starsData");
                localStorage.removeItem("paintGravity_bestTimes");
                localStorage.removeItem("totalSplattersShot");
                localStorage.removeItem("gameAchievements");

                // Clear any stored ghost runs for all levels
                for (let i = 1; i <= MAX_LEVELS; i++) {
                    localStorage.removeItem(`paintGravity_ghost_lvl_${i}`);
                }

                // Write fresh starting defaults back to localStorage
                localStorage.setItem("paintGravity_unlockedLevels", 1);
                localStorage.setItem("paintGravity_starsData", JSON.stringify({}));
                localStorage.setItem("totalSplattersShot", 0);

                resetConfirm = false; 
            }
            return;
        }

        if (!(mouseX >= 660 && mouseX <= 780 && mouseY >= 40 && mouseY <= 70)) { 
            resetConfirm = false; 
        }

        // Level Grid Selection Checks (10 per row)
        let startX = 60, startY = 120;
        let btnSize = 50, gap = 18;
        
        for (let i = 0; i < MAX_LEVELS; i++) {
            let col = i % 10; 
            let row = Math.floor(i / 10);
            let x = startX + col * (btnSize + gap); 
            let y = startY + row * (btnSize + gap);
            
            if (mouseX >= x && mouseX <= x + btnSize && mouseY >= y && mouseY <= y + btnSize) {
                let lvlSelected = i + 1;
                
                let isUnlocked = (lvlSelected <= unlockedLevels) || 
                                 (typeof levelData !== "undefined" && levelData[lvlSelected] && levelData[lvlSelected].unlocked);

                if (isUnlocked) { 
                    selectedLevelForPopup = lvlSelected;

                    // Load ghost data for this level if available
                    let savedGhost = localStorage.getItem(`paintGravity_ghost_lvl_${selectedLevelForPopup}`);
                    activeGhostData = savedGhost ? JSON.parse(savedGhost) : null;

                    currentGameState = STATES.LEVEL_POPUP; // Open level popup modal
                }
            }
        }
    }
    // --- 4. LEVEL POPUP MODAL ---
    else if (currentGameState === STATES.LEVEL_POPUP) {
        let popupW = 320, popupH = 220;
        let popupX = (canvas.width - popupW) / 2;
        let popupY = (canvas.height - popupH) / 2;

        // Button dimensions matching drawLevelPopup() exactly:
        let btnW = 240;
        let btnH = 40;
        let playBtnX = popupX + 40;
        
        let playBtnY = popupY + 80;   // Play button Y position
        let ghostBtnY = popupY + 135; // Race Ghost button Y position

        // Clicked "PLAY LEVEL"
        if (mouseX >= playBtnX && mouseX <= playBtnX + btnW && mouseY >= playBtnY && mouseY <= playBtnY + btnH) {
            isGhostActive = false;
            currentLevel = selectedLevelForPopup;
            levelStartTime = Date.now();
            currentRecordedRun = [];
            loadLevel(currentLevel);
            currentGameState = STATES.PLAYING;
            return;
        }

        // Clicked "RACE GHOST" (only if ghost data exists)
        if (activeGhostData && mouseX >= playBtnX && mouseX <= playBtnX + btnW && mouseY >= ghostBtnY && mouseY <= ghostBtnY + btnH) {
            isGhostActive = true;
            currentLevel = selectedLevelForPopup;
            levelStartTime = Date.now();
            currentRecordedRun = [];
            loadLevel(currentLevel);
            currentGameState = STATES.PLAYING;
            return;
        }

        // Clicked outside popup to close
        if (mouseX < popupX || mouseX > popupX + popupW || mouseY < popupY || mouseY > popupY + popupH) {
            currentGameState = STATES.LEVEL_MENU;
        }
    }

    // --- 5. GAMEPLAY ---
    else if (currentGameState === STATES.PLAYING) {
        if (paintAmmo <= 0) { 
            levelStartTime = Date.now();
            currentRecordedRun = [];
            loadLevel(currentLevel); 
            return; 
        } 
        
        const angle = Math.atan2(
            mouseY - (player.y + player.height / 2), 
            mouseX - (player.x + player.width / 2)
        );

        paintBalls.push({ 
            x: player.x + player.width / 2, 
            y: player.y + player.height / 2, 
            vx: Math.cos(angle) * 8, 
            vy: Math.sin(angle) * 8, 
            color: selectedColor, 
            evaporated: false 
        });
        
        paintAmmo--;

        totalSplattersShot = (totalSplattersShot || 0) + 1;
        localStorage.setItem("totalSplattersShot", totalSplattersShot);
    }
});

function update() {
    if (currentGameState === STATES.PLAYING) {
        updatePlayer(); // 1. Move player first
        currentRecordedRun.push({ x: player.x, y: player.y }); // 2. Record new position
        checkWinCondition(); // 3. Check if new position hit the flag
    }
}
function checkWinCondition() {
    if (player.x < flag.x + flag.width && player.x + player.width > flag.x &&
        player.y < flag.y + flag.height && player.y + player.height > flag.y) {

        let timeTaken = parseFloat(((Date.now() - levelStartTime) / 1000).toFixed(2));
        let starsEarned = starsInLevel.filter(s => s.collected).length;
        let previousBest = levelBestTimes[currentLevel];

        // Save ghost only if it's a new best time or first completion
        if (previousBest === undefined || timeTaken < previousBest) {
            localStorage.setItem(`paintGravity_ghost_lvl_${currentLevel}`, JSON.stringify(currentRecordedRun));
        }

        saveBestTime(currentLevel, timeTaken);
        saveLevelStars(currentLevel, starsEarned);

        if (isGhostActive) {
            achievementsData.ghostHunter = true;
        }

        if (currentLevel >= unlockedLevels) {
            unlockedLevels = Math.min(currentLevel + 1, MAX_LEVELS);
            localStorage.setItem("paintGravity_unlockedLevels", unlockedLevels);
        }

        checkAchievements();
        currentGameState = STATES.LEVEL_MENU;
    }
}

// FEATURE 1: UPDATED WITH PAINT SPLAT OVERWRITING
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
                let overwroteExisting = false;

                // Check if paintball hits inside an existing splatter hitbox
                for (let j = 0; j < paintSplatters.length; j++) {
                    let splat = paintSplatters[j];
                    let dist = Math.hypot(b.x - splat.x, b.y - splat.y);
                    
                    if (dist < splat.hitboxSize) { 
                        splat.color = b.color; // Swap old color with new color!
                        splat.dripLen = 0;     // Reset drip animation
                        overwroteExisting = true;
                        break;
                    }
                }

                // If no splatter was nearby, add a brand new one
                if (!overwroteExisting) {
                    paintSplatters.push({ x: b.x, y: b.y, radius: 25, hitboxSize: 35, color: b.color, dripLen: 0 });
                }
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

// FEATURE 2: VISUAL TRAJECTORY LINE DRAWING FUNCTION
function drawTrajectoryLine() {
    // Only draw trajectory line while actually playing
    if (currentGameState !== STATES.PLAYING) return;

    // 1. Find player center position
    let playerCenterX = player.x + (player.width || 20) / 2;
    let playerCenterY = player.y + (player.height || 32) / 2;

    // 2. Calculate continuous angle using global mouse coordinates
    const angle = Math.atan2(mouseY - playerCenterY, mouseX - playerCenterX);
    const stepSize = 4; // Raycast accuracy step size
    const dx = Math.cos(angle) * stepSize;
    const dy = Math.sin(angle) * stepSize;

    let rayX = playerCenterX;
    let rayY = playerCenterY;
    let hitWall = false;

    // 3. Step forward until ray hits a platform or canvas edge
    while (!hitWall) {
        rayX += dx;
        rayY += dy;

        // Check Canvas Boundary Collisions
        if (rayX <= 0 || rayX >= canvas.width || rayY <= 0 || rayY >= canvas.height) {
            hitWall = true;
            break;
        }

        // Check Platform Collisions
        if (typeof platforms !== "undefined") {
            for (let i = 0; i < platforms.length; i++) {
                let p = platforms[i];
                if (rayX >= p.x && rayX <= p.x + p.w && rayY >= p.y && rayY <= p.y + p.h) {
                    hitWall = true;
                    break;
                }
            }
        }
    }

    // 4. Draw Dotted Trajectory Line from Player to Collision Point
    ctx.save();
    ctx.strokeStyle = selectedColor || "#00f5d4";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]); // Dotted style
    
    // Glowing Laser Effect
    ctx.shadowBlur = 10;
    ctx.shadowColor = selectedColor || "#00f5d4";

    ctx.beginPath();
    ctx.moveTo(playerCenterX, playerCenterY);
    ctx.lineTo(rayX, rayY);
    ctx.stroke();

    // 5. Draw Target Splatter Marker at the impact point
    ctx.fillStyle = selectedColor || "#00f5d4";
    ctx.beginPath();
    ctx.arc(rayX, rayY, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function loadLevel(level) {
    currentLevel = level;
    currentRecordedRun = []; // Resets path on death/load
    // 1. Reset Player Properties & Motion
    player.x = 40; 
    player.y = 480; 
    player.vx = 0; 
    player.vy = 0;
    player.facing = "right";
    player.isWalking = false;
    player.walkFrame = 0;
    player.onGround = false;

    currentGravity = GRAVITY.DOWN; 
    cameraX = 0;

    // 2. Clear Entity Arrays
    paintBalls = []; 
    paintSplatters = []; 
    spikes = []; 
    plants = []; 
    starsInLevel = []; 
    waterErasers = []; 
    hazmatDroppers = []; 
    hazardDroplets = [];

    // 3. Set Ammo and Default Flag Size
    paintAmmo = level === 1 ? 8 : (level === 2 ? 6 : 5); 
    if (typeof flag !== "undefined") {
        flag.width = 20;
        flag.height = 40;
    }

    // Base Ceiling and Floor
    platforms = [
        { x: 0, y: 560, w: 800, h: 40 },
        { x: 0, y: 0, w: 800, h: 40 }
    ];

    // --- LEVEL 1 ---
    if (level === 1) {
        platforms.push(
            { x: 220, y: 300, w: 50, h: 260 }, 
            { x: 390, y: 40, w: 50, h: 320 }, 
            { x: 550, y: 250, w: 120, h: 25 }, 
            { x: 700, y: 450, w: 100, h: 25 }
        );
        spikes.push({ x: 290, y: 540, w: 20, h: 20 }, { x: 510, y: 540, w: 20, h: 20 });
        flag.x = 740; flag.y = 400;
        starsInLevel.push(
            { x: 180, y: 500, collected: false }, 
            { x: 360, y: 120, collected: false }, 
            { x: 600, y: 200, collected: false }
        );
    } 
    // --- LEVEL 2 ---
    else if (level === 2) {
        platforms.push(
            { x: 150, y: 160, w: 50, h: 400 }, 
            { x: 340, y: 40, w: 50, h: 420 }, 
            { x: 520, y: 160, w: 50, h: 400 }, 
            { x: 650, y: 400, w: 150, h: 25 }
        );
        for (let i = 0; i < 5; i++) spikes.push({ x: 220 + (i * 60), y: 540, w: 20, h: 20 });
        flag.x = 710; flag.y = 350;
        starsInLevel.push(
            { x: 100, y: 100, collected: false }, 
            { x: 450, y: 500, collected: false }, 
            { x: 600, y: 100, collected: false }
        );
    } 
    // --- LEVEL 3+ ---
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
                let starYOffset = -30; 

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

        // Safe loop bound to prevent infinite freeze on missing stars
        for (let i = starsInLevel.length; i < 3; i++) {
            starsInLevel.push({ x: 200 + (i * 150), y: 240, collected: false });
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

    // 4. Plant Generation Loop
    let maxPlants = 12 + Math.min(level, 10); 
    let canvasW = (typeof canvas !== "undefined" && canvas) ? canvas.width : 800;
    let spacingWidth = canvasW / maxPlants;
    let colors = ["#00f5d4", "#7b2cbf", "#ff007f", "#39ff14", "#fee440"];

    for (let i = 0; i < maxPlants; i++) {
        let plantX = (i * spacingWidth) + (Math.random() * 15 - 7); 
        let decorationType = Math.floor(Math.random() * 4) + 1;
        let wallSide = Math.random() < 0.5 ? "left" : "right";
        let finalY = 560;

        if (decorationType === 3 || decorationType === 4) {
            plantX = wallSide === "left" ? 80 : 720; 
            finalY = 100 + (Math.random() * 360); 
        }
        plants.push({ 
            x: plantX, 
            y: finalY, 
            type: decorationType, 
            side: wallSide, 
            height: Math.random() * 25 + 20, 
            width: Math.random() * 8 + 12, 
            color: colors[Math.floor(Math.random() * colors.length)] 
        });
    }

    // 5. Initialize Timer
    levelStartTime = Date.now();
}

function drawStartScreen() {
    // 1. Dark Neon Background
    ctx.fillStyle = "#07020d";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Animated Floating Paint Particles
    menuParticles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around screen edges
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });

    // 3. Main Title with Neon Glow & Shadow
    let time = Date.now() * 0.003;
    let titleYOffset = Math.sin(time) * 4; // Floating effect for title

    ctx.save();
    ctx.textAlign = "center";

    // Title Outer Glow
    ctx.shadowBlur = 25;
    ctx.shadowColor = "#00f5d4";
    ctx.fillStyle = "#00f5d4";
    ctx.font = "900 38px 'Courier New', monospace";
    ctx.fillText("PAINT & GRAVITY", canvas.width / 2, 130 + titleYOffset);

    // Subtitle Glow
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#ff007f";
    ctx.fillStyle = "#ff70a6";
    ctx.font = "bold 14px monospace";
    ctx.fillText("✦ COLOR THE WORLD // DEFY GRAVITY ✦", canvas.width / 2, 165 + titleYOffset);
    ctx.restore();

    // 4. Stylish Buttons Layout
    let btnW = 220, btnH = 50;
    let btnX = (canvas.width - btnW) / 2;

    // --- BUTTON 1: SELECT LEVEL ---
    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#00f5d4";
    ctx.fillStyle = "#120822";
    ctx.strokeStyle = "#00f5d4";
    ctx.lineWidth = 2.5;

    ctx.fillRect(btnX, 230, btnW, btnH);
    ctx.strokeRect(btnX, 230, btnW, btnH);

    ctx.fillStyle = "#00f5d4";
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "center";
    ctx.fillText("▶ SELECT LEVEL", canvas.width / 2, 262);
    ctx.restore();

    // --- BUTTON 2: ACHIEVEMENTS ---
    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#fee440";
    ctx.fillStyle = "#120822";
    ctx.strokeStyle = "#fee440";
    ctx.lineWidth = 2.5;

    ctx.fillRect(btnX, 300, btnW, btnH);
    ctx.strokeRect(btnX, 300, btnW, btnH);

    ctx.fillStyle = "#fee440";
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "center";
    ctx.fillText("🏆 ACHIEVEMENTS", canvas.width / 2, 332);
    ctx.restore();

    // 5. Decorative Bottom Accent Bar
    ctx.save();
    ctx.strokeStyle = "#390053";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(100, 500);
    ctx.lineTo(canvas.width - 100, 500);
    ctx.stroke();
    ctx.restore();

    ctx.textAlign = "left"; // Reset alignment
}

function drawLevelPopup() {
    drawLevelMenu(); // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let popW = 320, popH = 220;
    let popX = (canvas.width - popW) / 2;
    let popY = (canvas.height - popH) / 2;

    ctx.fillStyle = "#12081f";
    ctx.strokeStyle = "#00f5d4";
    ctx.lineWidth = 3;
    ctx.fillRect(popX, popY, popW, popH);
    ctx.strokeRect(popX, popY, popW, popH);

    ctx.fillStyle = "#00f5d4";
    ctx.font = "bold 20px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`LEVEL ${selectedLevelForPopup}`, canvas.width / 2, popY + 35);

    let best = levelBestTimes[selectedLevelForPopup];
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px monospace";
    ctx.fillText(best !== undefined ? `BEST TIME: ${best}s` : "NOT CLEARED YET", canvas.width / 2, popY + 60);

    // PLAY LEVEL BUTTON
    ctx.fillStyle = "#160726";
    ctx.strokeStyle = "#00f5d4";
    ctx.lineWidth = 2;
    ctx.fillRect(popX + 40, popY + 80, 240, 40);
    ctx.strokeRect(popX + 40, popY + 80, 240, 40);
    ctx.fillStyle = "#00f5d4";
    ctx.font = "bold 14px monospace";
    ctx.fillText("PLAY LEVEL", canvas.width / 2, popY + 105);

    // PLAY WITH GHOST BUTTON
    let hasGhost = localStorage.getItem(`paintGravity_ghost_lvl_${selectedLevelForPopup}`) !== null;
    if (hasGhost) {
        ctx.fillStyle = "#160726";
        ctx.strokeStyle = "#ff007f";
        ctx.fillRect(popX + 40, popY + 135, 240, 40);
        ctx.strokeRect(popX + 40, popY + 135, 240, 40);
        ctx.fillStyle = "#ff007f";
        ctx.font = "bold 14px monospace";
        ctx.fillText("👻 PLAY WITH GHOST", canvas.width / 2, popY + 160);
    } else {
        ctx.fillStyle = "#0a0310";
        ctx.strokeStyle = "#4a3b5c";
        ctx.fillRect(popX + 40, popY + 135, 240, 40);
        ctx.strokeRect(popX + 40, popY + 135, 240, 40);
        ctx.fillStyle = "#4a3b5c";
        ctx.font = "bold 12px monospace";
        ctx.fillText("🔒 GHOST LOCKED", canvas.width / 2, popY + 160);
    }

    ctx.fillStyle = "#888888";
    ctx.font = "10px monospace";
    ctx.fillText("Click outside box to cancel", canvas.width / 2, popY + 200);
}

function drawLevelMenu() {
    // 1. Background
    ctx.fillStyle = "#0a0310";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Header Box & Title
    ctx.fillStyle = "#12081f";
    ctx.fillRect(180, 15, canvas.width - 360, 60);
    ctx.strokeStyle = "#00f5d4";
    ctx.lineWidth = 2;
    ctx.strokeRect(180, 15, canvas.width - 360, 60);

    ctx.fillStyle = "#00f5d4";
    ctx.font = "bold 24px monospace";
    ctx.textAlign = "center";
    ctx.fillText("SELECT LEVEL", canvas.width / 2, 52);

    // 3. Main Menu Button (Top Left)
    ctx.fillStyle = "#160726";
    ctx.strokeStyle = "#ff007f";
    ctx.lineWidth = 2;
    ctx.fillRect(20, 20, 120, 36);
    ctx.strokeRect(20, 20, 120, 36);
    ctx.fillStyle = "#ff007f";
    ctx.font = "bold 12px monospace";
    ctx.fillText("◄ MAIN MENU", 80, 43);

    // 4. RESET DATA BUTTON & WARNING DISPLAY
    ctx.save();
    let resetX = 660, resetY = 40, resetW = 120, resetH = 30;

    if (typeof resetConfirm !== "undefined" && resetConfirm) {
        ctx.fillStyle = "#ff0055";
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.fillRect(resetX, resetY, resetW, resetH);
        ctx.strokeRect(resetX, resetY, resetW, resetH);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "center";
        ctx.fillText("CONFIRM RESET?", resetX + resetW / 2, resetY + 19);

        ctx.fillStyle = "rgba(255, 0, 85, 0.9)";
        ctx.fillRect(100, 8, 540, 24);
        ctx.strokeStyle = "#ffffff";
        ctx.strokeRect(100, 8, 540, 24);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px monospace";
        ctx.fillText("⚠️ WARNING: THIS WILL WIPE ALL LEVEL PROGRESS & ACHIEVEMENTS!", 370, 24);
    } else {
        ctx.fillStyle = "#1e0b2b";
        ctx.strokeStyle = "#ff0055";
        ctx.lineWidth = 2;
        ctx.fillRect(resetX, resetY, resetW, resetH);
        ctx.strokeRect(resetX, resetY, resetW, resetH);

        ctx.fillStyle = "#ff0055";
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "center";
        ctx.fillText("RESET DATA", resetX + resetW / 2, resetY + 19);
    }
    ctx.restore();

    // 5. Render Level Grid
    let startX = 60, startY = 120;
    let btnSize = 50, gap = 18;
    let totalStarsEarned = 0;

    for (let i = 0; i < MAX_LEVELS; i++) {
        let lvlNum = i + 1;
        let col = i % 10;
        let row = Math.floor(i / 10);
        let x = startX + col * (btnSize + gap);
        let y = startY + row * (btnSize + gap);

        // Calculate stars earned
        let starsEarned = 0;
        if (typeof levelStarsData !== "undefined" && levelStarsData[lvlNum] !== undefined) {
            starsEarned = levelStarsData[lvlNum];
        } else if (typeof levelData !== "undefined" && levelData[lvlNum] && levelData[lvlNum].stars) {
            starsEarned = levelData[lvlNum].stars;
        }

        totalStarsEarned += starsEarned;

        // Level Unlock Check
        let isUnlocked = (lvlNum <= unlockedLevels) || 
                         (typeof levelData !== "undefined" && levelData[lvlNum] && levelData[lvlNum].unlocked);

        if (isUnlocked) {
            // Unlocked Level Button
            ctx.fillStyle = "#190a2a";
            ctx.strokeStyle = "#00f5d4";
            ctx.lineWidth = 2;
            ctx.fillRect(x, y, btnSize, btnSize);
            ctx.strokeRect(x, y, btnSize, btnSize);

            // Level Number (Adjusted Y position up slightly)
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 14px monospace";
            ctx.textAlign = "center";
            ctx.fillText(lvlNum, x + btnSize / 2, y + 18);

            // Level Stars Visual (Adjusted Y position)
            let starStr = "★".repeat(starsEarned) + "☆".repeat(3 - starsEarned);
            ctx.fillStyle = "#fee440";
            ctx.font = "9px monospace";
            ctx.fillText(starStr, x + btnSize / 2, y + 31);

            // Best Time Display (Adjusted Y position to bottom edge)
            let bestTime = (typeof levelBestTimes !== "undefined") ? levelBestTimes[lvlNum] : undefined;
            if (bestTime !== undefined) {
                ctx.fillStyle = "#00f5d4";
                ctx.font = "bold 8px monospace";
                ctx.fillText(`${bestTime}s`, x + btnSize / 2, y + 43);
            } else {
                ctx.fillStyle = "#666666";
                ctx.font = "8px monospace";
                ctx.fillText("--", x + btnSize / 2, y + 43);
            }
        } else {
            // Locked Level Button
            ctx.fillStyle = "#0d0515";
            ctx.strokeStyle = "#342246";
            ctx.lineWidth = 1;
            ctx.fillRect(x, y, btnSize, btnSize);
            ctx.strokeRect(x, y, btnSize, btnSize);

            ctx.fillStyle = "#4a3b5c";
            ctx.font = "16px monospace";
            ctx.textAlign = "center";
            ctx.fillText("🔒", x + btnSize / 2, y + 32);
        }
    }

    // 6. Dynamic Total Stars Footer
    let maxStars = (typeof MAX_LEVELS !== "undefined" ? MAX_LEVELS : 50) * 3;

    ctx.fillStyle = "#fee440";
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`TOTAL STARS: ${totalStarsEarned} / ${maxStars} ★`, canvas.width / 2, 570);

    ctx.textAlign = "left"; // Reset alignment
}

function saveBestTime(lvlNum, timeInSeconds) {
    let currentBest = levelBestTimes[lvlNum];
    
    // Save if there is no record yet, or if the new time is faster
    if (currentBest === undefined || timeInSeconds < currentBest) {
        levelBestTimes[lvlNum] = timeInSeconds;
        localStorage.setItem("paintGravity_bestTimes", JSON.stringify(levelBestTimes));
    }
}
function saveLevelStars(lvlNum, starsEarned) {
    if (typeof levelStarsData === "undefined" || !levelStarsData) {
        levelStarsData = {};
    }

    // Only update if the new star count is higher than the previous record
    let currentRecord = levelStarsData[lvlNum] || 0;
    if (starsEarned > currentRecord) {
        levelStarsData[lvlNum] = starsEarned;
        localStorage.setItem("paintGravity_starsData", JSON.stringify(levelStarsData));
    }

    // Sync with levelData if present
    if (typeof levelData !== "undefined" && levelData[lvlNum]) {
        levelData[lvlNum].stars = Math.max(levelData[lvlNum].stars || 0, starsEarned);
    }
}

function drawGameSpace() {
    ctx.fillStyle = "#0c0512"; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // --- 1. PARALLAX BACKGROUND LAYERS ---
    // Far Layer (0.25)
    ctx.fillStyle = "#150a1f";
    ctx.fillRect(0 - (cameraX * 0.25), 0, 160, 200); 
    ctx.fillRect(160 - (cameraX * 0.25), 0, 240, 120); 
    ctx.fillRect(400 - (cameraX * 0.25), 0, 200, 80); 
    ctx.fillRect(600 - (cameraX * 0.25), 0, 200, 160);

    // Mid Layer (0.5)
    ctx.fillStyle = "#1d0f2b";
    ctx.fillRect(0 - (cameraX * 0.5), 0, 80, 560); 
    ctx.fillRect(80 - (cameraX * 0.5), 120, 40, 300); 
    ctx.fillRect(120 - (cameraX * 0.5), 200, 40, 160); 
    ctx.fillRect(720 - (cameraX * 0.5), 0, 80, 560); 
    ctx.fillRect(680 - (cameraX * 0.5), 160, 40, 240);

    // Close Details Layer (0.75)
    ctx.fillStyle = "#251436";
    ctx.fillRect(300 - (cameraX * 0.75), 80, 8, 20); 
    ctx.fillRect(308 - (cameraX * 0.75), 100, 8, 30); 
    ctx.fillRect(550 - (cameraX * 0.75), 140, 8, 40);

    // --- 2. DECORATIVE PLANTS ---
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

    // --- 3. PLATFORMS & HAZARDS ---
    platforms.forEach(p => {
        ctx.fillStyle = "#2c1930"; ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = "#201124";
        for (let bx = p.x; bx < p.x + p.w; bx += 16) ctx.fillRect(bx, p.y, 2, p.h);
        for (let by = p.y; by < p.y + p.h; by += 12) ctx.fillRect(p.x, by, p.w, 2);
        ctx.fillStyle = "#5c336b"; ctx.fillRect(p.x, p.y, p.w, 3);
    });

    waterErasers.forEach(w => {
        ctx.fillStyle = "rgba(0, 191, 255, 0.35)"; ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.fillStyle = "#00bfff"; ctx.fillRect(w.x - 2, w.y, 2, w.h); ctx.fillRect(w.x + w.w, w.y, 2, w.h);
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        for (let wy = w.y + 10; wy < w.y + w.h; wy += 35) {
            let xOffset = Math.sin((Date.now() / 300) + wy) * (w.w / 3);
            ctx.fillRect(w.x + (w.w / 2) + xOffset, wy, 3, 3);
        }
    });

    hazmatDroppers.forEach(drop => {
        ctx.fillStyle = "#4a5568"; ctx.fillRect(drop.x, drop.y, drop.w, drop.h);
        ctx.fillStyle = "#39ff14"; ctx.fillRect(drop.x + 8, drop.y + drop.h - 4, drop.w - 16, 4);
    });
    hazardDroplets.forEach(d => {
        ctx.fillStyle = "#39ff14"; ctx.fillRect(d.x, d.y, 6, 8); ctx.fillRect(d.x + 1, d.y - 2, 4, 2);
    });

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

    ctx.save();
    let flagGlowSize = 25 + Math.sin(Date.now() / 200) * 10;
    ctx.shadowColor = "#fee440"; ctx.shadowBlur = flagGlowSize;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(flag.x, flag.y, 4, flag.height); 
    ctx.fillStyle = "#fee440"; ctx.beginPath();
    ctx.moveTo(flag.x + 4, flag.y); ctx.lineTo(flag.x + 28, flag.y + 10); ctx.lineTo(flag.x + 4, flag.y + 20); ctx.closePath(); ctx.fill();
    ctx.restore();

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

    // Safely draw trajectory line if defined
    if (typeof drawTrajectoryLine === "function") {
        drawTrajectoryLine();
    }

    // --- 4. GHOST, ASTRONAUT & GUN RENDERING ---

    // Draw Ghost (if active and data exists)
    if (typeof isGhostActive !== "undefined" && isGhostActive && activeGhostData && currentRecordedRun.length < activeGhostData.length) {
        let ghostFrame = activeGhostData[currentRecordedRun.length];
        let pw = player.width || 20;
        let ph = player.height || 32;

        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = "#00f5d4";
        ctx.fillRect(ghostFrame.x, ghostFrame.y, pw, ph);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        ctx.fillText("👻 GHOST", ghostFrame.x + pw / 2, ghostFrame.y - 4);
        ctx.restore();
    }

    // Draw Player Astronaut & Gun
    ctx.save();
    
    let centerX = player.x + (player.width || 20) / 2; 
    let centerY = player.y + (player.height || 32) / 2;
    
    // Fall back to global mouseX / mouseY tracking
    let targetX = (typeof mouseX !== "undefined") ? mouseX : ((canvas.mouseX !== undefined) ? canvas.mouseX : centerX); 
    let targetY = (typeof mouseY !== "undefined") ? mouseY : ((canvas.mouseY !== undefined) ? canvas.mouseY : centerY);

    ctx.translate(centerX, centerY);

    let gravityAngle = 0;
    switch (currentGravity) {
        case GRAVITY.UP: gravityAngle = Math.PI; ctx.rotate(Math.PI); break;
        case GRAVITY.LEFT: gravityAngle = Math.PI / 2; ctx.rotate(Math.PI / 2); break;
        case GRAVITY.RIGHT: gravityAngle = -Math.PI / 2; ctx.rotate(-Math.PI / 2); break;
        default: gravityAngle = 0; ctx.rotate(0); break;
    }

    let pw = player.width || 20; 
    let ph = player.height || 32; 
    let px = -pw / 2; 
    let py = -ph / 2;
    let legOffset = Math.floor(Math.sin(player.walkFrame || 0) * 5);
    
    // Suit & Body
    ctx.fillStyle = "#ccd1d9";
    if (player.facing === "right") ctx.fillRect(px - 3, py + 12, 6, 22); else ctx.fillRect(px + pw - 3, py + 12, 6, 22);
    ctx.fillStyle = "#e6e9ed"; ctx.fillRect(px + 3, py + 12, pw - 6, 20);
    ctx.fillStyle = "#ff3333"; ctx.fillRect(px + 10, py + 16, 4, 4);
    ctx.fillStyle = "#2f3542"; ctx.fillRect(px + 6, py + 16, 3, 5);
    
    // Legs
    ctx.fillStyle = "#aab2bd";
    if (player.isWalking) { 
        ctx.fillRect(px + 4, py + 32, 6, 8 + legOffset); 
        ctx.fillRect(px + pw - 10, py + 32, 6, 8 - legOffset); 
    } else { 
        ctx.fillRect(px + 4, py + 32, 6, 10); 
        ctx.fillRect(px + pw - 10, py + 32, 6, 10); 
    }
    
    // Helmet
    ctx.fillStyle = "#e6e9ed"; ctx.fillRect(px + 4, py, pw - 8, 12); ctx.fillRect(px + 2, py + 2, pw - 4, 10);
    ctx.fillStyle = "#1c2024";
    if (player.facing === "right") ctx.fillRect(px + 12, py + 3, 14, 8); else ctx.fillRect(px + 4, py + 3, 14, 8);
    ctx.fillStyle = "#ffffff";
    if (player.facing === "right") ctx.fillRect(px + 20, py + 5, 2, 2); else ctx.fillRect(px + 6, py + 5, 2, 2);

    // Aiming Arm & Gun
    ctx.save();
    let absoluteAimAngle = Math.atan2(targetY - centerY, targetX - centerX);
    if (isNaN(absoluteAimAngle)) absoluteAimAngle = 0;
    
    let relativeAimAngle = absoluteAimAngle - gravityAngle;
    let armX = player.facing === "right" ? (px + 14) : (px + pw - 14); 
    let armY = py + 20;
    
    ctx.translate(armX, armY); 
    ctx.rotate(relativeAimAngle);
    if (Math.cos(absoluteAimAngle) < 0) ctx.scale(1, -1);

    ctx.fillStyle = "#5d6a7a"; ctx.fillRect(0, -3, 14, 6); ctx.fillRect(2, 2, 3, 5); 
    ctx.fillStyle = selectedColor || "#00f5d4"; ctx.fillRect(1, -7, 7, 4); ctx.fillStyle = "#aab2bd"; ctx.fillRect(0, -8, 9, 1);
    ctx.fillStyle = "#3a414c"; ctx.fillRect(12, -3, 2, 6);
    ctx.restore();
    
    ctx.fillStyle = "#ccd1d9";
    if (player.facing === "right") ctx.fillRect(px + 10, py + 18, 6, 5); else ctx.fillRect(px + pw - 16, py + 18, 6, 5);
    
    ctx.restore();

    // --- 5. PROJECTILES & HUD OVERLAYS ---
    paintBalls.forEach(b => { ctx.fillStyle = b.color; ctx.fillRect(b.x - 3, b.y - 3, 6, 6); });

    ctx.save();
    ctx.font = "15px monospace";
    let canvasW = canvas.width || 800;

    // TOP ROW: LEFT ALIGNED (Level, Shots, Selected Paint)
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`LVL: ${currentLevel}  |  SHOTS: ${paintAmmo}`, 20, 28);

    ctx.fillStyle = selectedColor || "#ffffff";
    ctx.fillText(`PAINT: ${(selectedColor || "").toUpperCase()}`, 210, 28);

    // TOP ROW: RIGHT ALIGNED (Timer, Stars, Controls)
    ctx.textAlign = "right";
    ctx.fillStyle = "#aab2bd";
    ctx.fillText("R: RESET | ESC: MENU", canvasW - 20, 28);

    ctx.fillStyle = "#fee440";
    let starsCollectedCount = starsInLevel.filter(s => s.collected).length;
    let starString = "★".repeat(starsCollectedCount) + "☆".repeat(3 - starsCollectedCount);
    ctx.fillText(`STARS: ${starString}`, canvasW - 220, 28);

    let elapsedTime = levelStartTime ? ((Date.now() - levelStartTime) / 1000).toFixed(2) : "0.00";
    ctx.fillStyle = "#00f5d4";
    ctx.fillText(`⏱️ ${elapsedTime}s`, canvasW - 360, 28);

    // Ghost HUD Indicator
    if (isGhostActive && activeGhostData) {
        let ghostFrameIndex = currentRecordedRun.length;
        if (ghostFrameIndex < activeGhostData.length) {
            ctx.fillStyle = "#00f5d4";
            ctx.fillText("👻 GHOST RACING", canvasW - 500, 28);
        } else {
            ctx.fillStyle = "#ff007f";
            ctx.fillText("👻 GHOST FINISHED", canvasW - 500, 28);
        }
    }
    // SECOND ROW: Gravity Keys & Level Hazards
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff"; 
    ctx.fillText("GRAVITY KEY:", 20, 52);
    ctx.fillStyle = "#00f5d4"; ctx.fillText("1:Blue(Up)", 135, 52);
    ctx.fillStyle = "#ff007f"; ctx.fillText("2:Red(Down)", 235, 52);
    ctx.fillStyle = "#fee440"; ctx.fillText("3:Yellow(Left)", 345, 52);
    ctx.fillStyle = "#39ff14"; ctx.fillText("4:Green(Right)", 475, 52);

    if (currentLevel >= 15) { ctx.fillStyle = "#00bfff"; ctx.fillText("💧 WATER FIELD", 610, 52); }
    if (currentLevel >= 25) { ctx.fillStyle = "#39ff14"; ctx.fillText("⚠️ HAZMAT SYSTEM", 610, 72); }

    ctx.restore();

    // --- 6. LEVEL 1 TUTORIAL ---
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
            ctx.fillText("GRAVITY REVERSED!", 260, 210); ctx.fillStyle = "#ffffff"; ctx.fillText("You are walking on the ceiling now.", 260, 230); ctx.fillStyle = "#fee440"; ctx.fillText("Press 2 to switch back to RED paint,", 260, 250); ctx.fillText("and shoot it to land safely past gaps.", 260, 270);
        }
        ctx.restore();
    }
}

function gameLoop() {
    if (currentGameState === STATES.START_SCREEN) {
        drawStartScreen();
    } else if (currentGameState === STATES.LEVEL_MENU) {
        drawLevelMenu();
    } else if (currentGameState === STATES.LEVEL_POPUP) {
        drawLevelPopup(); // Note: Your drawLevelPopup already calls drawLevelMenu() inside it!
    } else if (currentGameState === STATES.ACHIEVEMENTS) {
        drawAchievementsMenu();
    } else if (currentGameState === STATES.PLAYING) {
        updatePlayer();
        updatePaintballs();
        drawGameSpace();
    }
    
    requestAnimationFrame(gameLoop);
}

gameLoop();


