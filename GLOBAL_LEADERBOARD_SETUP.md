# Global Leaderboard Setup

This guide explains how to set up the global leaderboard using GitHub Gist.

## Step 1: Create a GitHub Gist

1. Go to https://gist.github.com/
2. Create a **public** gist with:
   - Filename: `unmask-city-scores.json`
   - Content: `[]` (empty array)
3. Copy the gist ID from the URL (e.g., `https://gist.github.com/username/abc123def456` → ID is `abc123def456`)
4. Update `src/game/GlobalLeaderboardManager.ts`:
   ```typescript
   private static readonly GIST_ID = 'YOUR_GIST_ID'; // Replace with your gist ID
   ```

## Step 2: Create a GitHub Personal Access Token

1. Go to https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Give it a name: "Unmask City Leaderboard"
4. Select scopes: **Only `gist`** (no other permissions needed)
5. Click "Generate token"
6. **Copy the token** (you won't see it again!)

## Step 3: Deploy with Vercel (Free)

### Option A: Using Vercel (Recommended)

1. Install Vercel CLI (optional):
   ```bash
   npm install -g vercel
   ```

2. Create `api/submit-score.ts`:
   ```typescript
   // Already created in this repo
   ```

3. Deploy:
   ```bash
   # Login to Vercel
   vercel login

   # Deploy
   vercel

   # Add environment variable
   vercel env add GITHUB_TOKEN
   # Paste your GitHub token when prompted
   # Select all environments (production, preview, development)

   # Deploy to production
   vercel --prod
   ```

4. Your API endpoint will be: `https://your-project.vercel.app/api/submit-score`

### Option B: Using Netlify

1. Create `netlify/functions/submit-score.ts` (similar to Vercel)
2. Add `GITHUB_TOKEN` environment variable in Netlify dashboard
3. Deploy via Netlify CLI or connect your GitHub repo

## Step 4: Test the Leaderboard

1. Run your game locally: `npm run dev`
2. Complete a game
3. Check the gist - you should see your score added
4. Refresh the start screen - global scores should appear

## Security Notes

- The GitHub token is stored as an environment variable (never in code)
- Anyone can read scores (public gist)
- Only your serverless function can write (has the token)
- No user authentication - scores are anonymous

## Rate Limits

- **GitHub API**: 5000 requests/hour (with token)
- **Gist read**: Unlimited (public CDN)
- For a game jam, this is more than enough!

## Alternative: Read-Only Global Leaderboard

If you don't want to set up the serverless function:

1. Just use the gist for **reading** scores
2. You manually update the gist after each game jam session
3. Players see global scores but can't submit

To enable read-only mode:
- Comment out the `submitScore()` call in `Game.ts`
- Global scores still display on start screen
