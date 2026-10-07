export interface HighScore {
  score: number;
  time: number; // seconds
  explored: number; // percentage
  fragments: number;
  difficulty: string;
  date: string; // ISO string
}

export class HighScoreManager {
  private static readonly STORAGE_KEY = 'unmask-the-city-highscores';
  private static readonly MAX_SCORES = 10;

  static saveScore(score: HighScore): void {
    const scores = this.getScores();
    scores.push(score);

    // Sort by score (descending)
    scores.sort((a, b) => b.score - a.score);

    // Keep only top MAX_SCORES
    const topScores = scores.slice(0, this.MAX_SCORES);

    // Save to localStorage
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(topScores));
  }

  static getScores(): HighScore[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];
      return JSON.parse(stored) as HighScore[];
    } catch (error) {
      console.error('Failed to load high scores:', error);
      return [];
    }
  }

  static getTopScores(count: number = 5): HighScore[] {
    return this.getScores().slice(0, count);
  }

  static clearScores(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  static isHighScore(score: number): boolean {
    const scores = this.getScores();
    if (scores.length < this.MAX_SCORES) return true;
    return score > scores[scores.length - 1].score;
  }

  static getRank(score: number): number {
    const scores = this.getScores();
    const rank = scores.findIndex(s => score > s.score);
    return rank === -1 ? scores.length + 1 : rank + 1;
  }
}
