// Game constants
const PLAYER_RADIUS = 10;
const PLAYER_SPEED = 3;
const TAGGER_SPEED = 3.5;
const DASH_SPEED = 6;
const DASH_COOLDOWN = 3000;
const GAME_DURATION = 60000;
const COUNTDOWN_DURATION = 3000;
const K_FACTOR = 32; // ELO K-factor

// Colors
const COLORS = {
    runner: '#00a8ff',  // Bright blue
    tagger: '#ff4757',  // Bright red
    walls: '#a4b0be',   // Light gray
    background: '#f1f2f6' // Light background
};

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
    countdownInterval: null,
    keys: {
        w: false,
        a: false,
        s: false,
        d: false,
        space: false
    }
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
    
    const baseQueueTime = 10; // Reduced from 30 to 10 seconds
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

function findSafeSpawnLocation() {
    const canvas = document.getElementById('gameCanvas');
    let x, y;
    let isSafe = false;
    
    while (!isSafe) {
        x = Math.random() * (canvas.width - 100) + 50;
        y = Math.random() * (canvas.height - 100) + 50;
        
        // Check if position is safe (not in wall and not too close to other players)
        isSafe = !checkWallCollision(x, y);
        
        // Check distance from other players
        if (isSafe) {
            isSafe = !gameState.players.some(player => {
                const distance = Math.hypot(player.x - x, player.y - y);
                return distance < PLAYER_RADIUS * 4; // Minimum distance between players
            });
        }
    }
    
    return { x, y };
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
    
    // Calculate total players and team sizes
    const totalPlayers = gameState.gameMode * 2;
    const taggersPerTeam = gameState.gameMode;
    const runnersPerTeam = gameState.gameMode;
    
    // Randomly assign human player's role
    const isHumanTagger = Math.random() < 0.5;
    
    // Add human player
    const humanSpawn = findSafeSpawnLocation();
    gameState.players.push({
        x: humanSpawn.x,
        y: humanSpawn.y,
        isTagger: isHumanTagger,
        isHuman: true,
        isActive: true,
        lastDash: 0,
        color: isHumanTagger ? COLORS.tagger : COLORS.runner,
        rating: playerData[`rating${gameState.gameMode}v${gameState.gameMode}`],
        targetX: 0,
        targetY: 0,
        lastDecision: 0,
        lastDirectionChange: 0,
        currentDirection: { x: 0, y: 0 },
        predictionError: 0
    });
    
    // Add AI players
    const remainingTaggers = taggersPerTeam - (isHumanTagger ? 1 : 0);
    const remainingRunners = runnersPerTeam - (isHumanTagger ? 0 : 1);
    
    // Add tagger AIs
    for (let i = 0; i < remainingTaggers; i++) {
        const aiSpawn = findSafeSpawnLocation();
        gameState.players.push({
            x: aiSpawn.x,
            y: aiSpawn.y,
            isTagger: true,
            isHuman: false,
            isActive: true,
            lastDash: 0,
            color: COLORS.tagger,
            targetX: 0,
            targetY: 0,
            lastDecision: 0,
            lastDirectionChange: 0,
            currentDirection: { x: 0, y: 0 },
            predictionError: 0,
            rating: playerData[`rating${gameState.gameMode}v${gameState.gameMode}`] + (Math.random() * 100 - 50)
        });
    }
    
    // Add runner AIs
    for (let i = 0; i < remainingRunners; i++) {
        const aiSpawn = findSafeSpawnLocation();
        gameState.players.push({
            x: aiSpawn.x,
            y: aiSpawn.y,
            isTagger: false,
            isHuman: false,
            isActive: true,
            lastDash: 0,
            color: COLORS.runner,
            targetX: 0,
            targetY: 0,
            lastDecision: 0,
            lastDirectionChange: 0,
            currentDirection: { x: 0, y: 0 },
            predictionError: 0,
            rating: playerData[`rating${gameState.gameMode}v${gameState.gameMode}`] + (Math.random() * 100 - 50)
        });
    }

    setupKeyboardListeners();
}

function setupKeyboardListeners() {
    document.addEventListener('keydown', (e) => {
        switch(e.key.toLowerCase()) {
            case 'w': gameState.keys.w = true; break;
            case 'a': gameState.keys.a = true; break;
            case 's': gameState.keys.s = true; break;
            case 'd': gameState.keys.d = true; break;
            case ' ': gameState.keys.space = true; break;
        }
    });

    document.addEventListener('keyup', (e) => {
        switch(e.key.toLowerCase()) {
            case 'w': gameState.keys.w = false; break;
            case 'a': gameState.keys.a = false; break;
            case 's': gameState.keys.s = false; break;
            case 'd': gameState.keys.d = false; break;
            case ' ': gameState.keys.space = false; break;
        }
    });
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
    // Calculate movement
    let dx = 0;
    let dy = 0;
    
    if (gameState.keys.w) dy -= 1;
    if (gameState.keys.s) dy += 1;
    if (gameState.keys.a) dx -= 1;
    if (gameState.keys.d) dx += 1;
    
    // Normalize diagonal movement
    if (dx !== 0 && dy !== 0) {
        const length = Math.sqrt(dx * dx + dy * dy);
        dx /= length;
        dy /= length;
    }
    
    // Apply dash
    const speed = gameState.keys.space && Date.now() - player.lastDash > DASH_COOLDOWN
        ? DASH_SPEED
        : player.isTagger ? TAGGER_SPEED : PLAYER_SPEED;
    
    if (gameState.keys.space && Date.now() - player.lastDash > DASH_COOLDOWN) {
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
    if (Date.now() - player.lastDecision < 100 + Math.random() * 50) return;
    player.lastDecision = Date.now();
    
    if (player.isTagger) {
        updateTaggerAI(player);
    } else {
        updateRunnerAI(player);
    }
}

function findPathToTarget(startX, startY, targetX, targetY, player) {
    // Get all walls and players as obstacles
    const obstacles = [...gameState.walls];
    gameState.players.forEach(p => {
        if (p !== player && p.isActive) {
            obstacles.push({
                x: p.x - PLAYER_RADIUS * 2,
                y: p.y - PLAYER_RADIUS * 2,
                width: PLAYER_RADIUS * 4,
                height: PLAYER_RADIUS * 4
            });
        }
    });
    
    // Try direct path first
    if (!checkObstacleCollision(targetX, targetY, obstacles)) {
        return { x: targetX, y: targetY };
    }
    
    // If direct path is blocked, try to find a way around
    const angle = Math.atan2(targetY - startY, targetX - startX);
    const distance = Math.hypot(targetX - startX, targetY - startY);
    
    // Try different angles to find a clear path
    for (let offset = -Math.PI/2; offset <= Math.PI/2; offset += Math.PI/8) {
        const testAngle = angle + offset;
        const testX = startX + Math.cos(testAngle) * distance;
        const testY = startY + Math.sin(testAngle) * distance;
        
        if (!checkObstacleCollision(testX, testY, obstacles)) {
            return { x: testX, y: testY };
        }
    }
    
    // If no clear path found, move towards target while avoiding obstacles
    return {
        x: startX + Math.cos(angle) * PLAYER_SPEED,
        y: startY + Math.sin(angle) * PLAYER_SPEED
    };
}

function checkObstacleCollision(x, y, obstacles) {
    return obstacles.some(obstacle => {
        return x + PLAYER_RADIUS > obstacle.x &&
               x - PLAYER_RADIUS < obstacle.x + obstacle.width &&
               y + PLAYER_RADIUS > obstacle.y &&
               y - PLAYER_RADIUS < obstacle.y + obstacle.height;
    });
}

function updateTaggerAI(player) {
    // Add human-like delay
    if (Date.now() - player.lastDecision < 100 + Math.random() * 50) return;
    player.lastDecision = Date.now();
    
    // Find nearest runner
    let nearestRunner = null;
    let minDistance = Infinity;
    
    gameState.players.forEach(target => {
        if (target.isActive && !target.isTagger) {
            const distance = Math.hypot(target.x - player.x, target.y - player.y);
            if (distance < minDistance) {
                minDistance = distance;
                nearestRunner = target;
            }
        }
    });
    
    if (nearestRunner) {
        // Predict runner's movement
        const predictedX = nearestRunner.x + nearestRunner.currentDirection.x * 50;
        const predictedY = nearestRunner.y + nearestRunner.currentDirection.y * 50;
        
        // Add some prediction error to make it more realistic
        player.predictionError = Math.min(1, player.predictionError + 0.1);
        const errorX = (Math.random() - 0.5) * 100 * player.predictionError;
        const errorY = (Math.random() - 0.5) * 100 * player.predictionError;
        
        // Find path to predicted position
        const path = findPathToTarget(
            player.x, 
            player.y, 
            predictedX + errorX, 
            predictedY + errorY,
            player
        );
        
        // Calculate direction to next path point
        const dx = path.x - player.x;
        const dy = path.y - player.y;
        const distance = Math.hypot(dx, dy);
        
        if (distance > 0) {
            // Add human-like movement patterns
            if (Date.now() - player.lastDirectionChange > 500 + Math.random() * 1000) {
                player.currentDirection = {
                    x: dx / distance,
                    y: dy / distance
                };
                player.lastDirectionChange = Date.now();
            }
            
            // Blend current direction with new direction for smoother movement
            const blendFactor = 0.1;
            player.currentDirection.x = player.currentDirection.x * (1 - blendFactor) + (dx / distance) * blendFactor;
            player.currentDirection.y = player.currentDirection.y * (1 - blendFactor) + (dy / distance) * blendFactor;
            
            // Normalize direction
            const length = Math.hypot(player.currentDirection.x, player.currentDirection.y);
            player.currentDirection.x /= length;
            player.currentDirection.y /= length;
            
            // Apply movement with some randomness
            const speed = TAGGER_SPEED;
            const randomFactor = 0.9 + Math.random() * 0.2;
            
            const newX = player.x + player.currentDirection.x * speed * randomFactor;
            const newY = player.y + player.currentDirection.y * speed * randomFactor;
            
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
            
            // Strategic dash when close to target
            if (minDistance < 100 && Math.random() < 0.05 && Date.now() - player.lastDash > DASH_COOLDOWN) {
                player.lastDash = Date.now();
                player.x += player.currentDirection.x * DASH_SPEED;
                player.y += player.currentDirection.y * DASH_SPEED;
            }
        }
    }
}

function updateRunnerAI(player) {
    // Add human-like delay
    if (Date.now() - player.lastDecision < 100 + Math.random() * 50) return;
    player.lastDecision = Date.now();
    
    // Find nearest tagger
    let nearestTagger = null;
    let minDistance = Infinity;
    
    gameState.players.forEach(target => {
        if (target.isActive && target.isTagger) {
            const distance = Math.hypot(target.x - player.x, target.y - player.y);
            if (distance < minDistance) {
                minDistance = distance;
                nearestTagger = target;
            }
        }
    });
    
    if (nearestTagger) {
        // Predict tagger's movement
        const predictedX = nearestTagger.x + nearestTagger.currentDirection.x * 50;
        const predictedY = nearestTagger.y + nearestTagger.currentDirection.y * 50;
        
        // Calculate direction away from predicted position
        const dx = player.x - predictedX;
        const dy = player.y - predictedY;
        const distance = Math.hypot(dx, dy);
        
        // Find nearest wall for cover
        let nearestWall = null;
        let wallDistance = Infinity;
        
        gameState.walls.forEach(wall => {
            const wallCenterX = wall.x + wall.width / 2;
            const wallCenterY = wall.y + wall.height / 2;
            const dist = Math.hypot(wallCenterX - player.x, wallCenterY - player.y);
            if (dist < wallDistance) {
                wallDistance = dist;
                nearestWall = wall;
            }
        });
        
        // If tagger is close, try to get behind a wall
        if (distance < 200 && nearestWall) {
            const wallDirX = nearestWall.x + nearestWall.width / 2 - player.x;
            const wallDirY = nearestWall.y + nearestWall.height / 2 - player.y;
            const wallDist = Math.hypot(wallDirX, wallDirY);
            
            // Blend movement between away from tagger and towards wall
            const blendFactor = Math.min(1, 200 / distance);
            const finalDirX = (dx / distance) * (1 - blendFactor) + (wallDirX / wallDist) * blendFactor;
            const finalDirY = (dy / distance) * (1 - blendFactor) + (wallDirY / wallDist) * blendFactor;
            
            // Normalize final direction
            const finalDist = Math.hypot(finalDirX, finalDirY);
            const normalizedDirX = finalDirX / finalDist;
            const normalizedDirY = finalDirY / finalDist;
            
            // Add human-like movement patterns
            if (Date.now() - player.lastDirectionChange > 500 + Math.random() * 1000) {
                player.currentDirection = {
                    x: normalizedDirX,
                    y: normalizedDirY
                };
                player.lastDirectionChange = Date.now();
            }
            
            // Blend current direction with new direction for smoother movement
            const blendFactor2 = 0.1;
            player.currentDirection.x = player.currentDirection.x * (1 - blendFactor2) + normalizedDirX * blendFactor2;
            player.currentDirection.y = player.currentDirection.y * (1 - blendFactor2) + normalizedDirY * blendFactor2;
            
            // Normalize direction
            const length = Math.hypot(player.currentDirection.x, player.currentDirection.y);
            player.currentDirection.x /= length;
            player.currentDirection.y /= length;
            
            // Apply movement
            const speed = PLAYER_SPEED;
            const randomFactor = 0.8 + Math.random() * 0.4;
            
            const newX = player.x + player.currentDirection.x * speed * randomFactor;
            const newY = player.y + player.currentDirection.y * speed * randomFactor;
            
            // Keep within map bounds with some margin
            const margin = 50;
            if (newX > margin && newX < 800 - margin && newY > margin && newY < 600 - margin) {
                if (!checkWallCollision(newX, player.y)) {
                    player.x = newX;
                }
                if (!checkWallCollision(player.x, newY)) {
                    player.y = newY;
                }
            }
        } else {
            // Move away from tagger but stay within map bounds
            const speed = PLAYER_SPEED;
            const randomFactor = 0.8 + Math.random() * 0.4;
            
            // Add human-like movement patterns
            if (Date.now() - player.lastDirectionChange > 500 + Math.random() * 1000) {
                player.currentDirection = {
                    x: dx / distance,
                    y: dy / distance
                };
                player.lastDirectionChange = Date.now();
            }
            
            // Blend current direction with new direction for smoother movement
            const blendFactor = 0.1;
            player.currentDirection.x = player.currentDirection.x * (1 - blendFactor) + (dx / distance) * blendFactor;
            player.currentDirection.y = player.currentDirection.y * (1 - blendFactor) + (dy / distance) * blendFactor;
            
            // Normalize direction
            const length = Math.hypot(player.currentDirection.x, player.currentDirection.y);
            player.currentDirection.x /= length;
            player.currentDirection.y /= length;
            
            const newX = player.x + player.currentDirection.x * speed * randomFactor;
            const newY = player.y + player.currentDirection.y * speed * randomFactor;
            
            // Keep within map bounds with some margin
            const margin = 50;
            if (newX > margin && newX < 800 - margin && newY > margin && newY < 600 - margin) {
                if (!checkWallCollision(newX, player.y)) {
                    player.x = newX;
                }
                if (!checkWallCollision(player.x, newY)) {
                    player.y = newY;
                }
            }
        }
        
        // Keep player in bounds
        player.x = Math.max(PLAYER_RADIUS, Math.min(800 - PLAYER_RADIUS, player.x));
        player.y = Math.max(PLAYER_RADIUS, Math.min(600 - PLAYER_RADIUS, player.y));
        
        // Emergency dash when tagger is very close
        if (distance < 50 && Math.random() < 0.1 && Date.now() - player.lastDash > DASH_COOLDOWN) {
            player.lastDash = Date.now();
            player.x += player.currentDirection.x * DASH_SPEED;
            player.y += player.currentDirection.y * DASH_SPEED;
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
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw walls
    ctx.fillStyle = COLORS.walls;
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

function calculateELOChange(playerRating, opponentRating, isWinner) {
    const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
    const actualScore = isWinner ? 1 : 0;
    return Math.round(K_FACTOR * (actualScore - expectedScore));
}

function endGame() {
    clearInterval(gameState.gameInterval);
    gameState.isRunning = false;
    
    const activeRunners = gameState.players.filter(p => !p.isTagger && p.isActive).length;
    const runnersWin = activeRunners > 0;
    
    // Get human player and their opponent
    const humanPlayer = gameState.players.find(p => p.isHuman);
    const opponent = gameState.players.find(p => !p.isHuman);
    
    if (humanPlayer && opponent) {
        // Calculate ELO change
        const isHumanWinner = (runnersWin && !humanPlayer.isTagger) || (!runnersWin && humanPlayer.isTagger);
        const ratingChange = calculateELOChange(humanPlayer.rating, opponent.rating, isHumanWinner);
        
        // Update ratings
        const ratingKey = `rating${gameState.gameMode}v${gameState.gameMode}`;
        playerData[ratingKey] += ratingChange;
        
        // Update stats
        if (isHumanWinner) {
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
}

function returnToMenu() {
    location.reload();
}

// Initialize game
loadPlayerData();
updateStats(); 
