import type { VercelRequest, VercelResponse } from '@vercel/node';

interface HighScore {
  score: number;
  time: number;
  explored: number;
  fragments: number;
  difficulty: string;
  date: string;
}

// Configuration
const GIST_ID = process.env.GIST_ID || 'YOUR_GIST_ID';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GIST_FILENAME = 'unmask-city-scores.json';
const MAX_SCORES = 100; // Store top 100 globally

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate GitHub token
  if (!GITHUB_TOKEN) {
    console.error('GITHUB_TOKEN not configured');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const newScore: HighScore = req.body;

    // Basic validation
    if (!newScore.score || !newScore.time || !newScore.difficulty) {
      return res.status(400).json({ error: 'Invalid score data' });
    }

    // Anti-cheat: Basic sanity checks
    if (newScore.score < 0 || newScore.score > 50000) {
      return res.status(400).json({ error: 'Score out of valid range' });
    }
    if (newScore.time < 10 || newScore.time > 3600) {
      return res.status(400).json({ error: 'Time out of valid range' });
    }
    if (newScore.explored < 0 || newScore.explored > 100) {
      return res.status(400).json({ error: 'Explored % out of valid range' });
    }

    // Fetch current gist
    const gistResponse = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!gistResponse.ok) {
      throw new Error(`Failed to fetch gist: ${gistResponse.status}`);
    }

    const gist = await gistResponse.json();
    const currentContent = gist.files[GIST_FILENAME]?.content || '[]';
    let scores: HighScore[] = JSON.parse(currentContent);

    // Add new score
    scores.push(newScore);

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    // Keep only top MAX_SCORES
    scores = scores.slice(0, MAX_SCORES);

    // Update gist
    const updateResponse = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: {
          [GIST_FILENAME]: {
            content: JSON.stringify(scores, null, 2),
          },
        },
      }),
    });

    if (!updateResponse.ok) {
      throw new Error(`Failed to update gist: ${updateResponse.status}`);
    }

    return res.status(200).json({
      success: true,
      rank: scores.findIndex(s => s.score === newScore.score && s.date === newScore.date) + 1,
      totalScores: scores.length,
    });

  } catch (error) {
    console.error('Error submitting score:', error);
    return res.status(500).json({
      error: 'Failed to submit score',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
