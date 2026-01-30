import { Game, DifficultySettings } from './game/Game';
import { HighScoreManager } from './game/HighScoreManager';
import { GlobalLeaderboardManager } from './game/GlobalLeaderboardManager';

// Difficulty presets
const DIFFICULTIES: Record<string, DifficultySettings> = {
  easy: {
    citySize: 300,
    fragmentCount: 5,
    buildingDensity: 0.5,
    fogClearRadius: 35,
  },
  normal: {
    citySize: 400,
    fragmentCount: 7,
    buildingDensity: 0.7,
    fogClearRadius: 25,
  },
  hard: {
    citySize: 500,
    fragmentCount: 10,
    buildingDensity: 0.8,
    fogClearRadius: 18,
  },
};

// Function to update leaderboard display for a specific difficulty
async function updateLeaderboard(difficulty: string = 'normal') {
  const leaderboardList = document.getElementById('leaderboard-list');
  if (!leaderboardList) return;

  // Show loading state
  leaderboardList.innerHTML = '<div class="leaderboard-empty">Loading...</div>';

  try {
    // Fetch merged global + local scores
    const localScores = HighScoreManager.getScores();
    const allScores = await GlobalLeaderboardManager.getMergedLeaderboard(localScores, 100);

    // Filter by selected difficulty and take top 5
    const topScores = allScores
      .filter(s => s.difficulty === difficulty)
      .slice(0, 5);

    if (topScores.length === 0) {
      leaderboardList.innerHTML = `<div class="leaderboard-empty">No ${difficulty} scores yet. Be the first!</div>`;
      return;
    }

    leaderboardList.innerHTML = topScores
      .map((entry, index) => {
        const minutes = Math.floor(entry.time / 60);
        const seconds = Math.floor(entry.time % 60);
        const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        return `
          <div class="leaderboard-entry">
            <span class="leaderboard-rank">#${index + 1}</span>
            <div class="leaderboard-stats">
              <div class="leaderboard-score">${entry.score} pts</div>
              <div class="leaderboard-details">
                ${timeStr} • ${entry.explored.toFixed(0)}%
              </div>
            </div>
          </div>
        `;
      })
      .join('');
  } catch (error) {
    console.error('Failed to load leaderboard:', error);
    // Fallback to local scores
    const localScores = HighScoreManager.getScores()
      .filter(s => s.difficulty === difficulty)
      .slice(0, 5);

    if (localScores.length > 0) {
      leaderboardList.innerHTML = localScores
        .map((entry, index) => {
          const minutes = Math.floor(entry.time / 60);
          const seconds = Math.floor(entry.time % 60);
          const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

          return `
            <div class="leaderboard-entry">
              <span class="leaderboard-rank">#${index + 1}</span>
              <div class="leaderboard-stats">
                <div class="leaderboard-score">${entry.score} pts</div>
                <div class="leaderboard-details">
                  ${timeStr} • ${entry.explored.toFixed(0)}% (local)
                </div>
              </div>
            </div>
          `;
        })
        .join('');
    } else {
      leaderboardList.innerHTML = `<div class="leaderboard-empty">No ${difficulty} scores yet. Be the first!</div>`;
    }
  }
}

// Wait for DOM
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('game-container');
  if (!container) {
    console.error('Game container not found');
    return;
  }

  let selectedDifficulty = 'normal';
  let game: Game | null = null;

  // Load and display leaderboard for default difficulty
  updateLeaderboard(selectedDifficulty);

  // Difficulty button handlers
  const difficultyBtns = document.querySelectorAll('.difficulty-btn');
  const difficultyInfo = document.getElementById('difficulty-info');

  const updateDifficultyInfo = (difficulty: string) => {
    const settings = DIFFICULTIES[difficulty];
    if (difficultyInfo && settings) {
      difficultyInfo.textContent = `${settings.fragmentCount} fragments • ${settings.citySize}m city`;
    }
  };

  difficultyBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // Don't trigger start screen click

      // Update selection
      difficultyBtns.forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');

      selectedDifficulty = btn.getAttribute('data-difficulty') || 'normal';
      updateDifficultyInfo(selectedDifficulty);

      // Update leaderboard to show scores for selected difficulty
      updateLeaderboard(selectedDifficulty);
    });
  });

  // Start screen click handler
  const startScreen = document.getElementById('start-screen');
  if (startScreen) {
    startScreen.addEventListener('click', (e) => {
      // Ignore clicks on difficulty buttons
      if ((e.target as HTMLElement).classList.contains('difficulty-btn')) {
        return;
      }

      startScreen.classList.add('hidden');
      document.getElementById('hud')?.classList.remove('hidden');

      // Initialize game with selected difficulty
      const settings = DIFFICULTIES[selectedDifficulty];
      game = new Game(container, settings, selectedDifficulty);
      game.start();
    });
  }

  // Play again button
  const playAgainBtn = document.getElementById('play-again');
  if (playAgainBtn) {
    playAgainBtn.addEventListener('click', () => {
      document.getElementById('win-screen')!.style.display = 'none';
      // Update leaderboard for current difficulty before restarting
      updateLeaderboard(selectedDifficulty);
      // Show start screen
      startScreen?.classList.remove('hidden');
      if (game) {
        game.restart();
      }
    });
  }
});
