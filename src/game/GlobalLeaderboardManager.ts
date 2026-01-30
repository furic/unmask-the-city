import { HighScore } from './HighScoreManager';

export class GlobalLeaderboardManager {
  // You'll need to create a public gist and put its ID here
  private static readonly GIST_ID = '31a13bcc5f6460710249fc2e88094252'; // TODO: Replace with actual gist ID
  private static readonly GIST_FILENAME = 'unmask-city-scores.json';

  // For writes, we'll use a serverless function
  private static readonly API_ENDPOINT = '/api/submit-score'; // Vercel/Netlify function

  /**
   * Fetch global leaderboard from public gist
   */
  static async fetchGlobalScores(): Promise<HighScore[]> {
    try {
      const url = `https://gist.githubusercontent.com/raw/${this.GIST_ID}/${this.GIST_FILENAME}`;
      const response = await fetch(url, {
        cache: 'no-cache',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Failed to fetch global leaderboard:', error);
      return [];
    }
  }

  /**
   * Submit score to global leaderboard via serverless function
   */
  static async submitScore(score: HighScore): Promise<boolean> {
    try {
      // First check if API endpoint exists (for local dev)
      if (!this.API_ENDPOINT.startsWith('http') && window.location.hostname === 'localhost') {
        console.log('Skipping global submit on localhost');
        return false;
      }

      const response = await fetch(this.API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(score),
      });

      if (!response.ok) {
        throw new Error(`Failed to submit: ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error('Failed to submit score to global leaderboard:', error);
      return false;
    }
  }

  /**
   * Get top N scores from global leaderboard
   */
  static async getTopGlobalScores(count: number = 10): Promise<HighScore[]> {
    const scores = await this.fetchGlobalScores();
    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, count);
  }

  /**
   * Merge local and global scores, return top N
   */
  static async getMergedLeaderboard(localScores: HighScore[], count: number = 10): Promise<HighScore[]> {
    const globalScores = await this.fetchGlobalScores();
    const allScores = [...localScores, ...globalScores];

    // Remove duplicates (same score + time + difficulty)
    const uniqueScores = allScores.filter((score, index, self) =>
      index === self.findIndex(s =>
        s.score === score.score &&
        s.time === score.time &&
        s.difficulty === score.difficulty
      )
    );

    return uniqueScores
      .sort((a, b) => b.score - a.score)
      .slice(0, count);
  }
}
