// Firebase Configuration is loaded from config.js
// If you don't have config.js, copy config.template.js to config.js and fill in your values

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

// Application State
let currentUser = null;
let currentLobbyId = null;
let currentLobbyRef = null;
let playerName = "";
let isHost = false;
let unsubscribers = [];

// DOM Elements
const screens = {
    mainMenu: document.getElementById('main-menu'),
    lobby: document.getElementById('lobby-screen'),
    game: document.getElementById('game-screen')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    authenticateAnonymously();
});

// Authentication
function authenticateAnonymously() {
    const authStatus = document.getElementById('auth-status');
    authStatus.textContent = 'Connecting...';

    auth.signInAnonymously()
        .then((userCredential) => {
            currentUser = userCredential.user;
            authStatus.textContent = 'Connected';
            console.log('Authenticated:', currentUser.uid);
        })
        .catch((error) => {
            authStatus.textContent = 'Connection failed';
            console.error('Auth error:', error);
        });
}

// Event Listeners Setup
function setupEventListeners() {
    // Main Menu
    document.getElementById('create-lobby-btn').addEventListener('click', createLobby);
    document.getElementById('join-lobby-btn').addEventListener('click', joinLobby);

    // Lobby Screen
    document.getElementById('start-game-btn').addEventListener('click', startGame);
    document.getElementById('leave-lobby-btn').addEventListener('click', leaveLobby);
    document.getElementById('copy-code-btn').addEventListener('click', copyLobbyCode);
    document.getElementById('game-mode-select').addEventListener('change', updateGameMode);

    // Game Screen
    document.getElementById('make-bid-btn').addEventListener('click', makeBid);
    document.getElementById('call-bluff-btn').addEventListener('click', callBluff);
    document.getElementById('leave-game-btn').addEventListener('click', leaveGame);

    // Allow Enter key to join lobby
    document.getElementById('lobby-code').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') joinLobby();
    });
    document.getElementById('player-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') createLobby();
    });
}

// Lobby Creation
async function createLobby() {
    const nameInput = document.getElementById('player-name');
    playerName = nameInput.value.trim();

    if (!playerName) {
        alert('Please enter your name');
        return;
    }

    if (!currentUser) {
        alert('Not connected. Please wait...');
        return;
    }

    try {
        // Generate lobby code
        const lobbyCode = generateLobbyCode();
        currentLobbyId = lobbyCode;

        // Create lobby in database
        const lobbyRef = database.ref(`lobbies/${lobbyCode}`);

        await lobbyRef.set({
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            hostId: currentUser.uid,
            gameMode: 'standard',
            status: 'waiting',
            maxPlayers: 10
        });

        // Add host as first player
        await lobbyRef.child(`players/${currentUser.uid}`).set({
            name: playerName,
            joinedAt: firebase.database.ServerValue.TIMESTAMP,
            isHost: true,
            isConnected: true,
            diceCount: 5,
            isEliminated: false
        });

        isHost = true;
        currentLobbyRef = lobbyRef;

        // Set up disconnect handler
        setupDisconnectHandler();

        // Enter lobby
        enterLobby();

    } catch (error) {
        console.error('Error creating lobby:', error);
        alert('Failed to create lobby: ' + error.message);
    }
}

// Join Existing Lobby
async function joinLobby() {
    const nameInput = document.getElementById('player-name');
    const codeInput = document.getElementById('lobby-code');

    playerName = nameInput.value.trim();
    const lobbyCode = codeInput.value.trim().toUpperCase();

    if (!playerName) {
        alert('Please enter your name');
        return;
    }

    if (!lobbyCode) {
        alert('Please enter a lobby code');
        return;
    }

    if (!currentUser) {
        alert('Not connected. Please wait...');
        return;
    }

    try {
        currentLobbyId = lobbyCode;
        const lobbyRef = database.ref(`lobbies/${lobbyCode}`);

        // Check if lobby exists
        const snapshot = await lobbyRef.once('value');
        if (!snapshot.exists()) {
            alert('Lobby not found');
            return;
        }

        const lobbyData = snapshot.val();

        // Check if lobby is waiting
        if (lobbyData.status !== 'waiting') {
            alert('This game has already started');
            return;
        }

        // Check player count
        const playerCount = lobbyData.players ? Object.keys(lobbyData.players).length : 0;
        if (playerCount >= 10) {
            alert('Lobby is full (max 10 players)');
            return;
        }

        // Check if already in lobby
        if (lobbyData.players && lobbyData.players[currentUser.uid]) {
            alert('You are already in this lobby');
        }

        // Join lobby
        await lobbyRef.child(`players/${currentUser.uid}`).set({
            name: playerName,
            joinedAt: firebase.database.ServerValue.TIMESTAMP,
            isHost: false,
            isConnected: true,
            diceCount: 5,
            isEliminated: false
        });

        isHost = false;
        currentLobbyRef = lobbyRef;

        // Set up disconnect handler
        setupDisconnectHandler();

        // Enter lobby
        enterLobby();

    } catch (error) {
        console.error('Error joining lobby:', error);
        alert('Failed to join lobby: ' + error.message);
    }
}

// Enter Lobby Screen
function enterLobby() {
    // Update UI
    document.getElementById('current-lobby-code').textContent = currentLobbyId;

    // Show/hide game mode selector for host
    const gameModeSelect = document.getElementById('game-mode-select');
    gameModeSelect.disabled = !isHost;

    // Show/hide start button for host
    document.getElementById('start-game-btn').style.display = isHost ? 'block' : 'none';

    // Switch screen
    switchScreen('lobby');

    // Set up real-time listeners
    listenToLobby();
}

// Listen to Lobby Changes
function listenToLobby() {
    if (!currentLobbyRef) return;

    // Listen to players
    const playersRef = currentLobbyRef.child('players');
    const playersListener = playersRef.on('value', (snapshot) => {
        const players = snapshot.val() || {};
        updatePlayersList(players);

        // Check if all players disconnected
        const connectedPlayers = Object.values(players).filter(p => p.isConnected);
        if (connectedPlayers.length === 0) {
            // All players disconnected
            cleanupLobby();
        }
    });

    unsubscribers.push(() => playersRef.off('value', playersListener));

    // Listen to status changes
    const statusListener = currentLobbyRef.child('status').on('value', (snapshot) => {
        const status = snapshot.val();
        if (status === 'active') {
            // Game has started
            enterGame();
        } else if (status === 'finished') {
            // Game finished
            handleGameFinished();
        }
    });

    unsubscribers.push(() => currentLobbyRef.child('status').off('value', statusListener));

    // Listen to host
    const hostListener = currentLobbyRef.child('hostId').on('value', (snapshot) => {
        const hostId = snapshot.val();
        if (hostId) {
            // Update host display
            playersRef.child(hostId).once('value', (hostSnapshot) => {
                const hostData = hostSnapshot.val();
                if (hostData) {
                    document.getElementById('lobby-host').textContent = hostData.name;
                }
            });
        }
    });

    unsubscribers.push(() => currentLobbyRef.child('hostId').off('value', hostListener));

    // Listen to game mode
    const gameModeListener = currentLobbyRef.child('gameMode').on('value', (snapshot) => {
        const mode = snapshot.val();
        if (mode) {
            document.getElementById('game-mode-select').value = mode;
        }
    });

    unsubscribers.push(() => currentLobbyRef.child('gameMode').off('value', gameModeListener));
}

// Update Players List Display
function updatePlayersList(players) {
    const playersList = document.getElementById('players-list');
    const playerCount = Object.keys(players).length;

    // Update count
    document.getElementById('player-count').textContent = `${playerCount}/10`;

    // Clear list
    playersList.innerHTML = '';

    // Add players
    Object.entries(players).forEach(([playerId, player]) => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-item';
        if (playerId === currentUser.uid) {
            playerDiv.classList.add('you');
        }

        const playerInfo = document.createElement('div');
        playerInfo.className = 'player-info';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'player-name';
        nameSpan.textContent = player.name;

        if (player.isHost) {
            const hostBadge = document.createElement('span');
            hostBadge.className = 'host-badge';
            hostBadge.textContent = '👑 Host';
            nameSpan.appendChild(hostBadge);
        }

        if (playerId === currentUser.uid) {
            const youBadge = document.createElement('span');
            youBadge.className = 'you-badge';
            youBadge.textContent = '(You)';
            nameSpan.appendChild(youBadge);
        }

        const statusSpan = document.createElement('span');
        statusSpan.className = `player-status ${player.isConnected ? 'connected' : 'disconnected'}`;
        statusSpan.textContent = player.isConnected ? '🟢' : '🔴';

        playerInfo.appendChild(nameSpan);
        playerDiv.appendChild(playerInfo);
        playerDiv.appendChild(statusSpan);

        playersList.appendChild(playerDiv);
    });
}

// Start Game (Host Only)
async function startGame() {
    if (!isHost || !currentLobbyRef) return;

    try {
        // Check minimum players
        const playersSnapshot = await currentLobbyRef.child('players').once('value');
        const players = playersSnapshot.val();
        const playerIds = Object.keys(players);

        if (playerIds.length < 2) {
            alert('Need at least 2 players to start');
            return;
        }

        // Initialize game state
        const gameState = {
            currentTurn: playerIds[0],
            currentBid: null,
            roundNumber: 1,
            lastAction: {
                type: 'game_start',
                playerId: currentUser.uid,
                timestamp: Date.now()
            }
        };

        // Roll dice for all players
        for (const playerId of playerIds) {
            const dice = rollDice(5);
            await currentLobbyRef.child(`playerSecrets/${playerId}/dice`).set(dice);
        }

        // Update game state and status
        await currentLobbyRef.child('gameState').set(gameState);
        await currentLobbyRef.child('status').set('active');

        // Add to history
        await currentLobbyRef.child('history').push({
            type: 'game_start',
            data: { startedBy: playerName },
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });

    } catch (error) {
        console.error('Error starting game:', error);
        alert('Failed to start game: ' + error.message);
    }
}

// Enter Game Screen
function enterGame() {
    switchScreen('game');
    listenToGame();
}

// Listen to Game State
function listenToGame() {
    if (!currentLobbyRef) return;

    // Listen to game state
    const gameStateListener = currentLobbyRef.child('gameState').on('value', (snapshot) => {
        const gameState = snapshot.val();
        if (gameState) {
            updateGameUI(gameState);
        }
    });

    unsubscribers.push(() => currentLobbyRef.child('gameState').off('value', gameStateListener));

    // Listen to your dice
    const diceListener = currentLobbyRef.child(`playerSecrets/${currentUser.uid}/dice`).on('value', (snapshot) => {
        const dice = snapshot.val();
        if (dice) {
            displayYourDice(dice);
        }
    });

    unsubscribers.push(() => currentLobbyRef.child(`playerSecrets/${currentUser.uid}/dice`).off('value', diceListener));

    // Listen to players
    const playersListener = currentLobbyRef.child('players').on('value', (snapshot) => {
        const players = snapshot.val();
        if (players) {
            updateGamePlayersList(players);
            updateTotalDice(players);
        }
    });

    unsubscribers.push(() => currentLobbyRef.child('players').off('value', playersListener));

    // Listen to history
    const historyListener = currentLobbyRef.child('history').limitToLast(10).on('value', (snapshot) => {
        const history = [];
        snapshot.forEach((child) => {
            history.push(child.val());
        });
        updateGameLog(history);
    });

    unsubscribers.push(() => currentLobbyRef.child('history').off('value', historyListener));
}

// Update Game UI
function updateGameUI(gameState) {
    // Update round
    document.getElementById('round-number').textContent = gameState.roundNumber;

    // Update turn status
    const turnStatus = document.getElementById('turn-status');
    const makeBidBtn = document.getElementById('make-bid-btn');
    const callBluffBtn = document.getElementById('call-bluff-btn');

    const isYourTurn = gameState.currentTurn === currentUser.uid;

    if (isYourTurn) {
        turnStatus.textContent = "It's your turn!";
        turnStatus.className = 'turn-indicator your-turn';
        makeBidBtn.disabled = false;
        callBluffBtn.disabled = gameState.currentBid === null;
    } else {
        // Get current player name
        currentLobbyRef.child(`players/${gameState.currentTurn}`).once('value', (snapshot) => {
            const player = snapshot.val();
            if (player) {
                turnStatus.textContent = `${player.name}'s turn`;
            }
        });
        turnStatus.className = 'turn-indicator';
        makeBidBtn.disabled = true;
        callBluffBtn.disabled = true;
    }

    // Update current bid
    const currentBidDiv = document.getElementById('current-bid');
    if (gameState.currentBid) {
        currentLobbyRef.child(`players/${gameState.currentBid.playerId}`).once('value', (snapshot) => {
            const player = snapshot.val();
            if (player) {
                currentBidDiv.innerHTML = `
                    <div class="bid-display">
                        <div class="bid-value">${gameState.currentBid.quantity} × ${getDiceFace(gameState.currentBid.face)}</div>
                        <div class="bid-player">by ${player.name}</div>
                    </div>
                `;
            }
        });

        // Update min bid inputs
        document.getElementById('bid-quantity').min = gameState.currentBid.quantity;
        document.getElementById('bid-quantity').value = gameState.currentBid.quantity + 1;
    } else {
        currentBidDiv.innerHTML = '<span class="no-bid">No bids yet</span>';
        document.getElementById('bid-quantity').min = 1;
        document.getElementById('bid-quantity').value = 1;
    }
}

// Display Your Dice
function displayYourDice(dice) {
    const diceContainer = document.getElementById('your-dice');
    diceContainer.innerHTML = '';

    dice.forEach(value => {
        const die = document.createElement('div');
        die.className = 'die';
        die.textContent = getDiceFace(value);
        diceContainer.appendChild(die);
    });
}

// Update Game Players List
function updateGamePlayersList(players) {
    const list = document.getElementById('game-players-list');
    list.innerHTML = '';

    Object.entries(players).forEach(([playerId, player]) => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'game-player-item';

        if (playerId === currentUser.uid) {
            playerDiv.classList.add('you');
        }

        if (player.isEliminated) {
            playerDiv.classList.add('eliminated');
        }

        const nameSpan = document.createElement('span');
        nameSpan.className = 'player-name';
        nameSpan.textContent = player.name;

        const diceSpan = document.createElement('span');
        diceSpan.className = 'player-dice-count';
        diceSpan.textContent = `🎲 ${player.diceCount}`;

        playerDiv.appendChild(nameSpan);
        playerDiv.appendChild(diceSpan);

        list.appendChild(playerDiv);
    });
}

// Update Total Dice Count
function updateTotalDice(players) {
    const total = Object.values(players)
        .filter(p => !p.isEliminated)
        .reduce((sum, p) => sum + p.diceCount, 0);

    document.getElementById('total-dice').textContent = total;
}

// Update Game Log
function updateGameLog(history) {
    const log = document.getElementById('game-log');
    log.innerHTML = '';

    history.forEach(entry => {
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        logEntry.textContent = formatLogEntry(entry);
        log.appendChild(logEntry);
    });

    // Scroll to bottom
    log.scrollTop = log.scrollHeight;
}

// Format Log Entry
function formatLogEntry(entry) {
    switch (entry.type) {
        case 'game_start':
            return `🎮 Game started by ${entry.data.startedBy}`;
        case 'bid':
            return `🎲 ${entry.data.playerName} bid ${entry.data.quantity} × ${getDiceFace(entry.data.face)}`;
        case 'bluff_call':
            return `⚠️ ${entry.data.callerName} called bluff!`;
        case 'bluff_result':
            return `${entry.data.success ? '✓' : '✗'} ${entry.data.message}`;
        default:
            return JSON.stringify(entry.data);
    }
}

// Make Bid
async function makeBid() {
    if (!currentLobbyRef) return;

    try {
        const quantity = parseInt(document.getElementById('bid-quantity').value);
        const face = parseInt(document.getElementById('bid-face').value);

        // Get current game state
        const gameStateSnapshot = await currentLobbyRef.child('gameState').once('value');
        const gameState = gameStateSnapshot.val();

        if (gameState.currentTurn !== currentUser.uid) {
            alert("It's not your turn!");
            return;
        }

        // Validate bid
        if (gameState.currentBid) {
            const currentBid = gameState.currentBid;
            if (quantity < currentBid.quantity || (quantity === currentBid.quantity && face <= currentBid.face)) {
                alert('Bid must be higher than the current bid');
                return;
            }
        }

        // Get next player
        const playersSnapshot = await currentLobbyRef.child('players').once('value');
        const players = playersSnapshot.val();
        const playerIds = Object.keys(players).filter(id => !players[id].isEliminated);
        const currentIndex = playerIds.indexOf(currentUser.uid);
        const nextIndex = (currentIndex + 1) % playerIds.length;
        const nextPlayerId = playerIds[nextIndex];

        // Update game state
        await currentLobbyRef.child('gameState').update({
            currentBid: {
                quantity,
                face,
                playerId: currentUser.uid
            },
            currentTurn: nextPlayerId,
            lastAction: {
                type: 'bid',
                playerId: currentUser.uid,
                timestamp: Date.now()
            }
        });

        // Add to history
        await currentLobbyRef.child('history').push({
            type: 'bid',
            data: {
                playerName,
                quantity,
                face
            },
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });

    } catch (error) {
        console.error('Error making bid:', error);
        alert('Failed to make bid: ' + error.message);
    }
}

// Call Bluff
async function callBluff() {
    if (!currentLobbyRef) return;

    try {
        const gameStateSnapshot = await currentLobbyRef.child('gameState').once('value');
        const gameState = gameStateSnapshot.val();

        if (gameState.currentTurn !== currentUser.uid) {
            alert("It's not your turn!");
            return;
        }

        if (!gameState.currentBid) {
            alert('No bid to call!');
            return;
        }

        // Add to history
        await currentLobbyRef.child('history').push({
            type: 'bluff_call',
            data: {
                callerName: playerName
            },
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });

        // This is where you'd implement the bluff resolution logic
        // For now, we'll just alert - you'll need to implement server-side validation
        alert('Bluff calling needs server-side validation via Cloud Functions. Coming soon!');

        // TODO: Call Cloud Function to resolve bluff
        // The function should:
        // 1. Count all dice matching the bid
        // 2. Determine if bid was accurate
        // 3. Make loser lose a die
        // 4. Check for elimination
        // 5. Start new round with new dice

    } catch (error) {
        console.error('Error calling bluff:', error);
        alert('Failed to call bluff: ' + error.message);
    }
}

// Leave Lobby
function leaveLobby() {
    if (confirm('Are you sure you want to leave?')) {
        cleanupLobby();
    }
}

// Leave Game
function leaveGame() {
    if (confirm('Are you sure you want to leave the game?')) {
        cleanupLobby();
    }
}

// Cleanup Lobby
function cleanupLobby() {
    // Unsubscribe from all listeners
    unsubscribers.forEach(unsub => unsub());
    unsubscribers = [];

    // Remove player from database
    if (currentLobbyRef && currentUser) {
        currentLobbyRef.child(`players/${currentUser.uid}`).remove();
    }

    // Reset state
    currentLobbyId = null;
    currentLobbyRef = null;
    isHost = false;

    // Return to main menu
    switchScreen('mainMenu');
}

// Handle Game Finished
function handleGameFinished() {
    alert('Game finished!');
    cleanupLobby();
}

// Setup Disconnect Handler
function setupDisconnectHandler() {
    if (!currentLobbyRef || !currentUser) return;

    const playerRef = currentLobbyRef.child(`players/${currentUser.uid}`);

    // Set connected status
    playerRef.child('isConnected').set(true);

    // On disconnect, mark as disconnected
    playerRef.child('isConnected').onDisconnect().set(false);

    // Optional: Remove player after some time of disconnection
    // playerRef.onDisconnect().remove();
}

// Utility Functions
function generateLobbyCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function rollDice(count) {
    const dice = [];
    for (let i = 0; i < count; i++) {
        dice.push(Math.floor(Math.random() * 6) + 1);
    }
    return dice;
}

function getDiceFace(value) {
    const faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    return faces[value - 1] || value;
}

function switchScreen(screenName) {
    Object.keys(screens).forEach(key => {
        screens[key].classList.remove('active');
    });
    screens[screenName].classList.add('active');
}

function copyLobbyCode() {
    const code = document.getElementById('current-lobby-code').textContent;
    navigator.clipboard.writeText(code).then(() => {
        alert('Lobby code copied to clipboard!');
    });
}

function updateGameMode() {
    if (!isHost || !currentLobbyRef) return;

    const mode = document.getElementById('game-mode-select').value;
    currentLobbyRef.child('gameMode').set(mode);
}
