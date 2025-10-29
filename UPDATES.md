# Recent Updates

## Persistence & URL-Based Lobbies ✅

### What's New

1. **URL-Based Lobbies**
   - Lobby URL format: `http://localhost:5002/#lobby/ABC123`
   - Copy button now copies the full shareable link
   - Share the link directly with friends

2. **Auto-Rejoin on Refresh**
   - Refresh the page → automatically rejoins your lobby
   - Works as long as the lobby still exists
   - Preserves your player name and host status

3. **Session Persistence**
   - Uses localStorage to save your session
   - Survives page refreshes
   - Clears when you explicitly leave a lobby

### How It Works

**Creating a Lobby:**
- Create lobby → URL updates to `#lobby/ABC123`
- Copy button gives you the full URL
- Send to friends so they can join directly

**Joining via URL:**
- Friend clicks your link → auto-fills lobby code
- Or just paste the code manually

**Refreshing:**
- Refresh while in lobby → auto-rejoins
- Refresh while in game → returns to game screen
- Lobby gone? → Returns to main menu

## Bluff Resolution (Cloud Functions) ✅

The Cloud Function is now implemented in JavaScript and running locally!

### IMPORTANT: Clear Browser Cache

If you're seeing the old "not implemented" message:

**Hard Refresh:**
- **Mac:** `Cmd + Shift + R`
- **Windows/Linux:** `Ctrl + Shift + R`
- **Or:** Open DevTools (F12) → Right-click reload → "Empty Cache and Hard Reload"

### Testing Bluff Resolution

1. Create/join lobby and start game
2. Make some bids
3. Click "Call Bluff!"
4. Should see:
   - Alert with actual dice count
   - Winner/loser determination
   - Dice counts update
   - New round starts
   - Game log updates

### Local Emulator

The function runs at: `http://localhost:5001`

Frontend automatically uses the local emulator when on localhost.

## Files Changed

- `public/app.js` - Added persistence, auto-rejoin, URL management
- `functions/index.js` - New JavaScript Cloud Function
- `functions/package.json` - New Node.js dependencies
- `firebase.json` - Updated for Node.js functions

## Next Steps

1. **Hard refresh your browser** to get the latest code
2. **Test the new features:**
   - Create a lobby
   - Copy the URL
   - Open in incognito to join
   - Refresh both pages (should stay in lobby)
   - Play until you can call bluff
3. **Deploy to production** when ready:
   ```bash
   firebase deploy
   ```
