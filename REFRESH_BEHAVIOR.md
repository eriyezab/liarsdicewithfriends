# Refresh/Reconnect Behavior

## How It Works Now

### During Lobby (Status = "waiting")
When you refresh the page while in the lobby:

1. **On Disconnect:**
   - Player is completely removed from the lobby
   - Other players see you leave

2. **On Refresh/Rejoin:**
   - Automatically re-adds you to the lobby
   - Other players see you join again
   - **Looks like you left and rejoined instantly**

3. **Edge Cases:**
   - If lobby is now full → Shows "Lobby is full" message
   - If game started while you were gone → Shows "Game has started" message
   - Clears session and returns to main menu

### During Active Game (Status = "active")
When you refresh during an active game:

1. **On Disconnect:**
   - Player stays in the game
   - Just marked as `isConnected: false`
   - Other players see your connection status indicator

2. **On Refresh/Rejoin:**
   - Updates `isConnected: true`
   - Returns to game screen
   - **No disruption to gameplay**
   - Dice and game state preserved

## Database Rules Updated

Players can now:
- ✅ Create new player entry (first join)
- ✅ Update own player entry (reconnect during game)
- ✅ Cannot join if lobby is in "waiting" and player already exists
- ✅ Can update status if player already exists (reconnecting)

## User Experience

### Lobby Scenario
```
You: Join lobby
[Refresh page]
You: Automatically back in lobby
Other players: See you leave → rejoin (instant)
```

### Game Scenario
```
You: Playing game
[Refresh page]
You: Back in game, same state
Other players: Your status briefly shows disconnected → connected
Game: Continues normally
```

## Important Notes

1. **Anonymous Auth Persistence**: Firebase Anonymous Auth now persists across refreshes with LOCAL persistence mode

2. **User ID Check**: System verifies that the Firebase user ID matches before attempting to rejoin

3. **Session Timeout**: If your anonymous session expires (browser cleared data), you'll get "Session expired" message

4. **Host Status**: If you were the host and refresh during lobby, you rejoin but are no longer host (security measure)

## Testing

1. **Test Lobby Refresh:**
   - Join a lobby
   - Refresh page (Cmd+Shift+R)
   - Should auto-rejoin

2. **Test Game Refresh:**
   - Start a game
   - Refresh page
   - Should return to game screen with same dice

3. **Test Multi-Player:**
   - Player 1 joins lobby
   - Player 2 joins lobby
   - Player 1 refreshes
   - Player 2 should see Player 1 leave → rejoin
