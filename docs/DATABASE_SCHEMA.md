# Firebase Realtime Database Schema

## Structure

```
/lobbies
  /{lobbyId}
    - createdAt: timestamp
    - hostId: string (player ID)
    - gameMode: "standard" | "elimination" | "common_hand"
    - status: "waiting" | "active" | "finished"
    - maxPlayers: 10
    - players
      /{playerId}
        - name: string
        - joinedAt: timestamp
        - isHost: boolean
        - isConnected: boolean
        - diceCount: number (starts at 5)
        - isEliminated: boolean
    - gameState (exists only when status = "active")
      - currentTurn: playerId
      - currentBid: {quantity: number, face: number, playerId: string} | null
      - roundNumber: number
      - lastAction: {type: string, playerId: string, timestamp: number}
    - playerSecrets (private - only accessible by owner)
      /{playerId}
        - dice: [number] (array of 1-6)
    - history
      - {pushId}: {type: string, data: object, timestamp: number}
```

## Security Considerations

- Players can only read their own dice
- Only host can start the game
- Only current turn player can make moves
- Max 10 players enforced by rules
- Prevent joining active/finished games
