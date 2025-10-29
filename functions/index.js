const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {setGlobalOptions} = require("firebase-functions/v2");
const admin = require("firebase-admin");

// Initialize Firebase Admin
admin.initializeApp();

// Set global options
setGlobalOptions({maxInstances: 10});

// Helper to get server timestamp
const getTimestamp = () => Date.now();

/**
 * Resolve a bluff call and determine winner/loser
 */
exports.resolve_bluff = onCall(async (request) => {
  // Validate authentication
  if (!request.auth) {
    throw new HttpsError(
        "unauthenticated",
        "Must be authenticated to call bluff",
    );
  }

  // Get parameters
  const {lobbyId} = request.data;
  const callerId = request.auth.uid;

  if (!lobbyId) {
    throw new HttpsError(
        "invalid-argument",
        "Missing lobbyId",
    );
  }

  // Get database reference
  const db = admin.database();
  const lobbyRef = db.ref(`lobbies/${lobbyId}`);

  try {
    // Get lobby data
    const lobbySnapshot = await lobbyRef.once("value");
    const lobbyData = lobbySnapshot.val();

    if (!lobbyData) {
      throw new HttpsError("not-found", "Lobby not found");
    }

    // Validate caller is in the game
    if (!lobbyData.players || !lobbyData.players[callerId]) {
      throw new HttpsError(
          "permission-denied",
          "You are not in this game",
      );
    }

    // Validate it's caller's turn
    const gameState = lobbyData.gameState || {};
    const currentTurn = gameState.currentTurn;

    if (currentTurn !== callerId) {
      throw new HttpsError(
          "failed-precondition",
          "It's not your turn",
      );
    }

    // Get current bid
    const currentBid = gameState.currentBid;
    if (!currentBid) {
      throw new HttpsError(
          "failed-precondition",
          "No bid to call bluff on",
      );
    }

    const bidQuantity = currentBid.quantity;
    const bidFace = currentBid.face;
    const bidderId = currentBid.playerId;

    // Get all player secrets (dice)
    const playerSecrets = lobbyData.playerSecrets || {};
    const players = lobbyData.players || {};

    // Count all dice matching the bid face
    let totalCount = 0;
    const allDice = {};

    for (const [playerId, secrets] of Object.entries(playerSecrets)) {
      const dice = secrets.dice || [];
      allDice[playerId] = dice;
      // Count dice matching the face value
      totalCount += dice.filter((d) => d === bidFace).length;
    }

    // Determine if bid was accurate
    const bidWasAccurate = totalCount >= bidQuantity;

    // Determine loser
    // If bid was accurate, caller loses; if inaccurate, bidder loses
    const loserId = bidWasAccurate ? callerId : bidderId;
    const loserData = players[loserId];
    const loserName = loserData.name;

    // Get game mode
    const gameMode = lobbyData.gameMode || "standard";

    // Update loser's dice count
    const newDiceCount = loserData.diceCount - 1;
    await lobbyRef.child(`players/${loserId}`).update({
      diceCount: newDiceCount,
    });

    // Check for elimination
    if (newDiceCount === 0 || gameMode === "elimination") {
      await lobbyRef.child(`players/${loserId}`).update({
        isEliminated: true,
      });
    }

    // Get active players (not eliminated)
    const activePlayers = {};
    for (const [pid, player] of Object.entries(players)) {
      const isEliminated = player.isEliminated || false;
      const stillActive = pid !== loserId || newDiceCount > 0;
      if (!isEliminated && stillActive) {
        activePlayers[pid] = player;
      }
    }

    // Check for game winner
    if (Object.keys(activePlayers).length === 1) {
      const winnerId = Object.keys(activePlayers)[0];
      const winnerName = activePlayers[winnerId].name;

      // Update game status to finished
      await lobbyRef.child("status").set("finished");

      // Add to history
      await lobbyRef.child("history").push({
        type: "bluff_result",
        data: {
          callerName: players[callerId].name,
          bidderName: players[bidderId].name,
          bidWasAccurate,
          loserName,
          actualCount: totalCount,
          bidQuantity,
          bidFace,
          allDice,
        },
        timestamp: getTimestamp(),
      });

      await lobbyRef.child("history").push({
        type: "game_over",
        data: {
          winnerName,
        },
        timestamp: getTimestamp(),
      });

      return {
        success: true,
        gameOver: true,
        winner: winnerName,
        actualCount: totalCount,
        bidWasAccurate,
        loserName,
        allDice,
      };
    }

    // Game continues - start new round
    // Roll new dice for all active players
    for (const playerId of Object.keys(activePlayers)) {
      const player = players[playerId];
      // Update dice count if this is the loser
      const diceCount = playerId === loserId ?
        newDiceCount :
        player.diceCount;

      // Roll new dice
      const newDice = Array.from(
          {length: diceCount},
          () => Math.floor(Math.random() * 6) + 1,
      );
      await lobbyRef.child(`playerSecrets/${playerId}/dice`).set(newDice);
    }

    // Determine next turn - loser starts next round
    const nextTurn = loserId;

    // Reset game state for new round
    const roundNumber = gameState.roundNumber || 1;
    await lobbyRef.child("gameState").update({
      currentBid: null,
      currentTurn: nextTurn,
      roundNumber: roundNumber + 1,
      lastAction: {
        type: "bluff_resolved",
        playerId: callerId,
        timestamp: getTimestamp(),
      },
    });

    // Add to history
    await lobbyRef.child("history").push({
      type: "bluff_result",
      data: {
        callerName: players[callerId].name,
        bidderName: players[bidderId].name,
        bidWasAccurate,
        loserName,
        actualCount: totalCount,
        bidQuantity,
        bidFace,
        allDice,
      },
      timestamp: getTimestamp(),
    });

    await lobbyRef.child("history").push({
      type: "new_round",
      data: {
        roundNumber: roundNumber + 1,
        startingPlayer: loserName,
      },
      timestamp: getTimestamp(),
    });

    return {
      success: true,
      gameOver: false,
      actualCount: totalCount,
      bidWasAccurate,
      loserName,
      allDice,
    };
  } catch (error) {
    console.error("Error resolving bluff:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", error.message);
  }
});
