# Liar's Dice Frontend Setup Guide

## What I've Built For You

I've created a complete frontend application with:

1. **Lobby System**
   - Create new lobbies with unique 6-character codes
   - Join existing lobbies using codes
   - Max 10 players per lobby
   - Host controls (select game mode, start game)
   - Real-time player list updates
   - Connection status indicators

2. **Game Interface**
   - Dice display (your dice are private)
   - Bid controls with validation
   - Turn indicator
   - Player list with dice counts
   - Game log with history
   - Current bid display

3. **Database Structure**
   - Secure database rules enforcing max players, turn order, etc.
   - Player secrets (dice) only readable by owner
   - Real-time synchronization for all game state

## Setup Steps

### 1. Get Your Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: `liarsdicewithfriends`
3. Click the gear icon (⚙️) > Project settings
4. Scroll down to "Your apps" section
5. Click "Add app" > Web (</>) if you haven't already
6. Copy the `firebaseConfig` object

### 2. Update Firebase Configuration

Open `public/app.js` and replace the placeholder config (lines 2-9):

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",  // Replace these values
    authDomain: "liarsdicewithfriends.firebaseapp.com",
    databaseURL: "https://liarsdicewithfriends-default-rtdb.firebaseio.com",
    projectId: "liarsdicewithfriends",
    storageBucket: "liarsdicewithfriends.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

### 3. Enable Firebase Services

#### Enable Authentication
1. In Firebase Console, go to Authentication
2. Click "Get Started"
3. Go to "Sign-in method" tab
4. Enable "Anonymous" authentication
5. Save

#### Enable Realtime Database
1. In Firebase Console, go to Realtime Database
2. Click "Create Database"
3. Choose your location
4. Start in "locked mode" (we have custom rules already)

#### Deploy Database Rules
```bash
firebase deploy --only database
```

### 4. Test Locally

```bash
# Option 1: Use Firebase Hosting emulator
firebase serve

# Option 2: Use any local web server
# Python 3
cd public && python3 -m http.server 8000

# Node.js
npx http-server public -p 8000
```

Open `http://localhost:5000` (Firebase) or `http://localhost:8000` (other servers)

### 5. Deploy to Firebase Hosting

```bash
# Deploy everything
firebase deploy

# Or just deploy hosting
firebase deploy --only hosting
```

Your app will be live at: `https://liarsdicewithfriends.web.app`

## How to Use the App

### Creating a Lobby
1. Enter your name
2. Click "Create New Lobby"
3. Share the 6-character code with friends
4. Wait for players to join
5. (Host only) Select game mode
6. (Host only) Click "Start Game" when ready

### Joining a Lobby
1. Enter your name
2. Enter the lobby code
3. Click "Join Lobby"
4. Wait for host to start

### Playing the Game
1. View your dice (others can't see them)
2. When it's your turn:
   - Make a bid (must be higher than current)
   - OR call bluff on the previous bid
3. Watch the game log for updates
4. Play until someone wins!

## What Still Needs to Be Done

### CRITICAL: Bluff Resolution (Server-Side)

Currently, the "Call Bluff" button alerts that server validation is needed. You need to implement a Cloud Function to:

1. Reveal all players' dice
2. Count dice matching the bid
3. Determine if the bid was accurate or a bluff
4. Make the loser lose a die
5. Check for elimination (0 dice)
6. Check for winner (last player standing)
7. Start a new round with new dice

**Example Cloud Function** (add to `functions/main.py`):

```python
from firebase_functions import https_fn, options
from firebase_admin import db
import random

@https_fn.on_call()
def resolve_bluff(req: https_fn.CallableRequest) -> dict:
    """
    Resolve a bluff call and determine winner/loser
    """
    lobby_id = req.data.get('lobbyId')
    caller_id = req.auth.uid

    # Get lobby ref
    lobby_ref = db.reference(f'lobbies/{lobby_id}')
    lobby_data = lobby_ref.get()

    # Get current bid
    current_bid = lobby_data['gameState']['currentBid']
    bid_quantity = current_bid['quantity']
    bid_face = current_bid['face']
    bidder_id = current_bid['playerId']

    # Count all dice
    player_secrets = lobby_data.get('playerSecrets', {})
    total_count = 0

    for player_id, secrets in player_secrets.items():
        dice = secrets.get('dice', [])
        # Count matching face (1s are wild in some variants)
        total_count += dice.count(bid_face)

    # Determine if bid was accurate
    bid_was_accurate = total_count >= bid_quantity

    # Loser is bidder if inaccurate, caller if accurate
    loser_id = bidder_id if not bid_was_accurate else caller_id

    # Update loser's dice count
    players_ref = lobby_ref.child('players')
    loser_data = players_ref.child(loser_id).get()
    new_dice_count = loser_data['diceCount'] - 1

    players_ref.child(loser_id).update({'diceCount': new_dice_count})

    # Check for elimination
    if new_dice_count == 0:
        players_ref.child(loser_id).update({'isEliminated': True})

    # Check for winner (only one player left)
    active_players = [p for p in lobby_data['players'].values() if not p.get('isEliminated')]

    if len(active_players) == 1:
        # Game over!
        lobby_ref.update({'status': 'finished'})
        return {
            'success': True,
            'gameOver': True,
            'winner': active_players[0]['name']
        }

    # Start new round - roll new dice for all active players
    for player_id in lobby_data['players'].keys():
        player = lobby_data['players'][player_id]
        if not player.get('isEliminated'):
            dice_count = player['diceCount']
            new_dice = [random.randint(1, 6) for _ in range(dice_count)]
            lobby_ref.child(f'playerSecrets/{player_id}/dice').set(new_dice)

    # Reset game state
    active_player_ids = [pid for pid, p in lobby_data['players'].items() if not p.get('isEliminated')]
    next_turn = active_player_ids[0]  # Or choose loser to start

    lobby_ref.child('gameState').update({
        'currentBid': None,
        'currentTurn': next_turn,
        'roundNumber': lobby_data['gameState']['roundNumber'] + 1
    })

    # Add to history
    lobby_ref.child('history').push({
        'type': 'bluff_result',
        'data': {
            'success': not bid_was_accurate,
            'loser': loser_data['name'],
            'actualCount': total_count,
            'bidCount': bid_quantity
        },
        'timestamp': db.ServerValue.TIMESTAMP
    })

    return {
        'success': True,
        'gameOver': False,
        'actualCount': total_count,
        'bidWasAccurate': bid_was_accurate
    }
```

**Then update `public/app.js` callBluff function** (around line 555):

```javascript
// Replace the TODO section with:
const callBluffFunction = firebase.functions().httpsCallable('resolve_bluff');
const result = await callBluffFunction({ lobbyId: currentLobbyId });

if (result.data.gameOver) {
    alert(`Game Over! ${result.data.winner} wins!`);
} else {
    alert(`Actual count: ${result.data.actualCount}. Bid was ${result.data.bidWasAccurate ? 'accurate' : 'a bluff'}!`);
}
```

### Other Improvements

1. **Better Error Handling**
   - Handle network disconnections
   - Retry failed operations
   - Show loading states

2. **Game Variants**
   - Implement "Common Hand" mode
   - Optional: 1s as wild dice

3. **UI Polish**
   - Animations for dice rolls
   - Sound effects
   - Confetti for winner
   - Better mobile responsiveness

4. **Features**
   - Chat system
   - Player avatars
   - Game history/statistics
   - Rejoin after disconnect

## File Structure Created

```
liarsdicewithfriends/
├── public/
│   ├── index.html          # Main HTML with all screens
│   ├── app.js              # All game logic and Firebase integration
│   └── styles.css          # Complete styling
├── database.rules.json     # Security rules
├── firebase.json           # Updated with hosting config
├── DATABASE_SCHEMA.md      # Database structure documentation
└── SETUP_GUIDE.md          # This file
```

## Troubleshooting

### Players can't join
- Check Firebase Authentication is enabled
- Check database rules are deployed
- Check lobby code is correct (case-sensitive)

### Game won't start
- Need at least 2 players
- Only host can start game

### Dice don't show
- Check Firebase config is correct
- Check browser console for errors
- Verify Realtime Database is enabled

### Disconnection issues
- Check `isConnected` status in database
- Verify disconnect handlers are working
- May need to implement reconnection logic

## Next Steps

1. Add your Firebase config
2. Test locally
3. Implement bluff resolution Cloud Function
4. Deploy and share with friends!

Need help? Check the Firebase documentation or reach out!
