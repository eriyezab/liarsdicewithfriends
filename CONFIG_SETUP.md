# Firebase Configuration Setup

## Security Best Practice

Your Firebase configuration is now stored in a separate file that is **NOT tracked by git**.

## File Structure

- `public/config.js` - Your actual Firebase config (gitignored, not committed)
- `public/config.template.js` - Template for others to copy (committed to git)

## For You (Project Owner)

Your `config.js` file is already created with your Firebase credentials. It's safe to use and won't be committed to git.

## For Collaborators

If you're cloning this repo:

1. Copy the template:
   ```bash
   cp public/config.template.js public/config.js
   ```

2. Get Firebase config:
   ```bash
   firebase apps:sdkconfig web
   ```

3. Fill in `public/config.js` with your values

## Important Notes

### Firebase Web API Keys Are Public
Firebase web API keys are designed to be included in client-side code. They are **not secret**. Security is enforced by:
- Database security rules
- Authentication rules
- Firebase App Check (optional)

### What's Protected
Even though the API key is public:
- Users can only read/write data allowed by your database rules
- Authentication prevents unauthorized access
- Rate limiting prevents abuse

### Why Gitignore It Anyway?
Even though Firebase API keys are public, keeping them in a separate file:
- Prevents accidental exposure of other sensitive data
- Makes it easy to use different configs for dev/prod
- Follows security best practices
- Makes it easy for collaborators to use their own Firebase projects

## Testing

To verify your config is loaded correctly:

```bash
# Serve locally
firebase serve

# Open http://localhost:5000
# Check browser console - you should see "Authenticated: <some-uid>"
```

If you see connection errors, check:
1. `public/config.js` exists
2. All fields in config.js are filled in
3. Firebase Authentication is enabled (Anonymous provider)
4. Firebase Realtime Database is created
