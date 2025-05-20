// Game constants
const PLAYER_RADIUS = 10;
const PLAYER_SPEED = 3;
const TAGGER_SPEED = 3.5;
const DASH_SPEED = 6;
const DASH_COOLDOWN = 3000;
const GAME_DURATION = 60000;
const COUNTDOWN_DURATION = 3000;

// Game state
let gameState = {
    players: [],
    walls: [],
    gameMode: 1,
    isRunning: false,
    gameTime: 0,
    countdown: 3,
    queueTime: 0,
    queueInterval: null,
    gameInterval: null,
    countdownInterval: null
};

// Player data
let playerData = {
    rating1v1: 1000,
    rating2v2: 1000,
    rating3v3: 1000,
    wins: 0,
    losses: 0
};

// Load saved data
function loadPlayerData() {
    const saved = localStorage.getItem('playerData');
    if (saved) {
        playerData = JSON.parse(saved);
        updateStats();
    }
}

// Save data
function savePlayerData() {
    localStorage.setItem('playerData', JSON.stringify(playerData));
}

// Update stats display
function updateStats() {
    document.getElementById('rating1v1').textContent = Math.round(playerData.rating1v1);
    document.getElementById('rating2v2').textContent = Math.round(playerData.rating2v2);
    document.getElementById('rating3v3').textContent = Math.round(playerData.rating3v3);
}

// Screen management
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// Queue management
function queueGame(mode) {
    gameState.gameMode = mode;
    showScreen('queueScreen');
    gameState.queueTime = 0;
    
    // Simulate queue time based on time of day and MMR
    const hour = new Date().getHours();
    const timeMultiplier = hour >= 18 || hour <= 6 ? 0.5 : 1.5; // Faster queues during peak hours
    const mmr = playerData[`rating${mode}v${mode}`];
    const mmrMultiplier = mmr < 1200 ? 0.7 : mmr > 1800 ? 1.5 : 1;
    
    const baseQueueTime = 30;
    const estimatedTime = Math.round(baseQueueTime * timeMultiplier * mmrMultiplier);
    
    document.getElementById('waitTime').textContent = estimatedTime;
    document.getElementById('queuePlayers').textContent = Math.floor(Math.random() * 100) + 50;
    document.getElementById('timeElapsed').textContent = '0';
    
    gameState.queueInterval = setInterval(() => {
        gameState.queueTime++;
        document.getElementById('timeElapsed').textContent = gameState.queueTime;
        if (gameState.queueTime >= estimatedTime) {
            clearInterval(gameState.queueInterval);
            startGame();
        }
    }, 1000);
}

function cancelQueue() {
    clearInterval(gameState.queueInterval);
    showScreen('homeScreen');
}

// Game initialization
function startGame() {
    showScreen('gameScreen');
    initializeGame();
    startCountdown();
}

function initializeGame() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    canvas.width = 800;
    canvas.height = 600;
    
    // Generate random walls
    gameState.walls = generateWalls();
    
    // Initialize players
    gameState.players = [];
    
    // Add human player (always a runner)
    gameState.players.push({
        x: Math.random() * (canvas.width - 100) + 50,
        y: Math.random() * (canvas.height - 100) + 50,
        isTagger: false,
        isHuman: true,
        isActive: true,
        lastDash: 0,
        color: '#3498db'
    });
    
    // Add AI players
    const totalPlayers = gameState.gameMode * 2;
    for (let i = 1; i < totalPlayers; i++) {
        const isTagger = i < totalPlayers / 2;
        gameState.players.push({
            x: Math.random() * (canvas.width - 100) + 50,
            y: Math.random() * (canvas.height - 100) + 50,
            isTagger: isTagger,
            isHuman: false,
            isActive: true,
            lastDash: 0,
            color: isTagger ? '#e74c3c' : '#3498db',
            targetX: 0,
            targetY: 0,
            lastDecision: 0
        });
    }
}

function generateWalls() {
    const walls = [];
    const numWalls = 10 + Math.floor(Math.random() * 10);
    
    for (let i = 0; i < numWalls; i++) {
        const isHorizontal = Math.random() > 0.5;
        const length = 50 + Math.random() * 150;
        const x = Math.random() * (800 - length);
        const y = Math.random() * (600 - length);
        
        walls.push({
            x: x,
            y: y,
            width: isHorizontal ? length : 20,
            height: isHorizontal ? 20 : length
        });
    }
    
    return walls;
}

// Game loop
function startCountdown() {
    gameState.countdown = 3;
    document.getElementById('gameCountdown').textContent = gameState.countdown;
    
    gameState.countdownInterval = setInterval(() => {
        gameState.countdown--;
        document.getElementById('gameCountdown').textContent = gameState.countdown;
        
        if (gameState.countdown <= 0) {
            clearInterval(gameState.countdownInterval);
            document.getElementById('gameCountdown').style.display = 'none';
            startGameLoop();
        }
    }, 1000);
}

function startGameLoop() {
    gameState.isRunning = true;
    gameState.gameTime = GAME_DURATION;
    
    // Clear any existing intervals
    if (gameState.gameInterval) {
        clearInterval(gameState.gameInterval);
    }
    
    gameState.gameInterval = setInterval(() => {
        updateGame();
        renderGame();
        
        gameState.gameTime -= 1000 / 60; // Update time more frequently
        document.getElementById('gameTimer').textContent = Math.ceil(gameState.gameTime / 1000);
        
        if (gameState.gameTime <= 0 || checkGameEnd()) {
            endGame();
        }
    }, 1000 / 60);
}

function updateGame() {
    // Update human player
    const humanPlayer = gameState.players.find(p => p.isHuman);
    if (humanPlayer && humanPlayer.isActive) {
        updateHumanPlayer(humanPlayer);
    }
    
    // Update AI players
    gameState.players.forEach(player => {
        if (!player.isHuman && player.isActive) {
            updateAIPlayer(player);
        }
    });
    
    // Check for collisions
    checkCollisions();
}

function updateHumanPlayer(player) {
    const keys = {
        w: false,
        a: false,
        s: false,
        d: false,
        space: false
    };
    
    // Handle keyboard input
    document.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'w') keys.w = true;
        if (e.key.toLowerCase() === 'a') keys.a = true;
        if (e.key.toLowerCase() === 's') keys.s = true;
        if (e.key.toLowerCase() === 'd') keys.d = true;
        if (e.key === ' ') keys.space = true;
    });
    
    document.addEventListener('keyup', (e) => {
        if (e.key.toLowerCase() === 'w') keys.w = false;
        if (e.key.toLowerCase() === 'a') keys.a = false;
        if (e.key.toLowerCase() === 's') keys.s = false;
        if (e.key.toLowerCase() === 'd') keys.d = false;
        if (e.key === ' ') keys.space = false;
    });
    
    // Calculate movement
    let dx = 0;
    let dy = 0;
    
    if (keys.w) dy -= 1;
    if (keys.s) dy += 1;
    if (keys.a) dx -= 1;
    if (keys.d) dx += 1;
    
    // Normalize diagonal movement
    if (dx !== 0 && dy !== 0) {
        const length = Math.sqrt(dx * dx + dy * dy);
        dx /= length;
        dy /= length;
    }
    
    // Apply dash
    const speed = keys.space && Date.now() - player.lastDash > DASH_COOLDOWN
        ? DASH_SPEED
        : player.isTagger ? TAGGER_SPEED : PLAYER_SPEED;
    
    if (keys.space && Date.now() - player.lastDash > DASH_COOLDOWN) {
        player.lastDash = Date.now();
    }
    
    // Update position
    const newX = player.x + dx * speed;
    const newY = player.y + dy * speed;
    
    // Check wall collisions
    if (!checkWallCollision(newX, player.y)) {
        player.x = newX;
    }
    if (!checkWallCollision(player.x, newY)) {
        player.y = newY;
    }
    
    // Keep player in bounds
    player.x = Math.max(PLAYER_RADIUS, Math.min(800 - PLAYER_RADIUS, player.x));
    player.y = Math.max(PLAYER_RADIUS, Math.min(600 - PLAYER_RADIUS, player.y));
}

function updateAIPlayer(player) {
    // Add human-like delay
    if (Date.now() - player.lastDecision < 100) return;
    player.lastDecision = Date.now();
    
    // Find nearest target
    let nearestTarget = null;
    let minDistance = Infinity;
    
    gameState.players.forEach(target => {
        if (target.isActive && target.isTagger !== player.isTagger) {
            const distance = Math.hypot(target.x - player.x, target.y - player.y);
            if (distance < minDistance) {
                minDistance = distance;
                nearestTarget = target;
            }
        }
    });
    
    if (nearestTarget) {
        // Calculate direction to target
        const dx = nearestTarget.x - player.x;
        const dy = nearestTarget.y - player.y;
        const distance = Math.hypot(dx, dy);
        
        // Normalize direction
        const dirX = dx / distance;
        const dirY = dy / distance;
        
        // Apply movement
        const speed = player.isTagger ? TAGGER_SPEED : PLAYER_SPEED;
        const newX = player.x + dirX * speed;
        const newY = player.y + dirY * speed;
        
        // Check wall collisions
        if (!checkWallCollision(newX, player.y)) {
            player.x = newX;
        }
        if (!checkWallCollision(player.x, newY)) {
            player.y = newY;
        }
        
        // Keep player in bounds
        player.x = Math.max(PLAYER_RADIUS, Math.min(800 - PLAYER_RADIUS, player.x));
        player.y = Math.max(PLAYER_RADIUS, Math.min(600 - PLAYER_RADIUS, player.y));
        
        // Random dash
        if (Math.random() < 0.01 && Date.now() - player.lastDash > DASH_COOLDOWN) {
            player.lastDash = Date.now();
            player.x += dirX * DASH_SPEED;
            player.y += dirY * DASH_SPEED;
        }
    }
}

function checkWallCollision(x, y) {
    return gameState.walls.some(wall => {
        return x + PLAYER_RADIUS > wall.x &&
               x - PLAYER_RADIUS < wall.x + wall.width &&
               y + PLAYER_RADIUS > wall.y &&
               y - PLAYER_RADIUS < wall.y + wall.height;
    });
}

function checkCollisions() {
    gameState.players.forEach(player => {
        if (!player.isActive) return;
        
        gameState.players.forEach(other => {
            if (!other.isActive || player === other) return;
            
            const distance = Math.hypot(player.x - other.x, player.y - other.y);
            if (distance < PLAYER_RADIUS * 2) {
                if (player.isTagger && !other.isTagger) {
                    other.isActive = false;
                }
            }
        });
    });
}

function checkGameEnd() {
    const activeRunners = gameState.players.filter(p => !p.isTagger && p.isActive).length;
    return activeRunners === 0;
}

function renderGame() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw walls
    ctx.fillStyle = '#666';
    gameState.walls.forEach(wall => {
        ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
    });
    
    // Draw players
    gameState.players.forEach(player => {
        if (player.isActive) {
            // Draw player circle
            ctx.beginPath();
            ctx.arc(player.x, player.y, PLAYER_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = player.color;
            ctx.fill();
            ctx.closePath();
            
            // Draw player indicator if it's the human player
            if (player.isHuman) {
                // Draw arrow above player
                ctx.beginPath();
                ctx.moveTo(player.x, player.y - PLAYER_RADIUS - 15);
                ctx.lineTo(player.x - 10, player.y - PLAYER_RADIUS - 5);
                ctx.lineTo(player.x + 10, player.y - PLAYER_RADIUS - 5);
                ctx.closePath();
                ctx.fillStyle = '#4CAF50';
                ctx.fill();
            }
        }
    });
}

function endGame() {
    clearInterval(gameState.gameInterval);
    gameState.isRunning = false;
    
    const activeRunners = gameState.players.filter(p => !p.isTagger && p.isActive).length;
    const runnersWin = activeRunners > 0;
    
    // Update ratings
    const ratingKey = `rating${gameState.gameMode}v${gameState.gameMode}`;
    const ratingChange = runnersWin ? 25 : -20;
    playerData[ratingKey] += ratingChange;
    
    // Update stats
    if (runnersWin) {
        playerData.wins++;
    } else {
        playerData.losses++;
    }
    
    savePlayerData();
    
    // Show end screen
    document.getElementById('gameResult').textContent = runnersWin ? 'Runners Win!' : 'Taggers Win!';
    document.getElementById('matchDuration').textContent = Math.ceil((GAME_DURATION - gameState.gameTime) / 1000);
    document.getElementById('ratingChange').textContent = `${ratingChange > 0 ? '+' : ''}${ratingChange}`;
    showScreen('endScreen');
}

function returnToMenu() {
    location.reload();
}

// Initialize game
loadPlayerData();
updateStats(); 
