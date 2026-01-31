import { Game, DifficultySettings } from './game/Game';
import { HighScoreManager } from './game/HighScoreManager';
import { GlobalLeaderboardManager } from './game/GlobalLeaderboardManager';

// Difficulty presets
const DIFFICULTIES: Record<string, DifficultySettings> = {
  dev: {
    citySize: 200,
    fragmentCount: 1,
    buildingDensity: 0.3,
    fogClearRadius: 50,
  },
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

// Check if running on localhost
const IS_LOCALHOST = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

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

// Loading tips that cycle during initialization
const LOADING_TIPS = [
  'The fog remembers all who have explored before...',
  'Buildings hide secrets in their shadows...',
  'Sprint wisely, stamina is precious...',
  'Parks restore your energy faster...',
  'Rare fragments glow brighter than common ones...',
  'Look for hidden fragments that only reveal themselves nearby...',
  'The city changes as day turns to night...',
];

// Wait for DOM
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('game-container');
  if (!container) {
    console.error('Game container not found');
    return;
  }

  // Loading screen elements
  const loadingScreen = document.getElementById('loading-screen');
  const loadingBar = document.getElementById('loading-bar');
  const loadingTip = document.getElementById('loading-tip');

  // Simulate loading progress with steps
  const loadingSteps = [
    { progress: 20, delay: 100 },
    { progress: 40, delay: 200 },
    { progress: 60, delay: 300 },
    { progress: 80, delay: 400 },
    { progress: 100, delay: 500 },
  ];

  // Update loading tip periodically
  let tipIndex = 0;
  const tipInterval = setInterval(() => {
    if (loadingTip) {
      tipIndex = (tipIndex + 1) % LOADING_TIPS.length;
      loadingTip.textContent = LOADING_TIPS[tipIndex];
    }
  }, 2000);

  let selectedDifficulty = 'normal';
  let game: Game | null = null;

  // Show dev difficulty button on localhost only
  if (IS_LOCALHOST) {
    const devBtn = document.getElementById('dev-btn');
    if (devBtn) {
      devBtn.classList.remove('hidden');
    }
  }

  // Animate loading bar while game initializes
  const animateLoading = () => {
    let stepIndex = 0;
    const nextStep = () => {
      if (stepIndex < loadingSteps.length) {
        const step = loadingSteps[stepIndex];
        if (loadingBar) {
          loadingBar.style.width = `${step.progress}%`;
        }
        stepIndex++;
        setTimeout(nextStep, step.delay);
      } else {
        // Loading complete - hide loading screen
        clearInterval(tipInterval);
        if (loadingScreen) {
          loadingScreen.classList.add('hidden');
          // Remove from DOM after transition
          setTimeout(() => {
            loadingScreen.style.display = 'none';
          }, 500);
        }
      }
    };
    nextStep();
  };

  // Start loading animation
  animateLoading();

  // Initialize game immediately for preview mode
  const settings = DIFFICULTIES[selectedDifficulty];
  game = new Game(container, settings, selectedDifficulty);
  game.startPreview();

  // Load and display leaderboard for default difficulty
  updateLeaderboard(selectedDifficulty);

  // Info modal handlers
  const infoBtn = document.getElementById('info-btn');
  const infoModal = document.getElementById('info-modal');
  const infoClose = document.getElementById('info-close');

  if (infoBtn && infoModal && infoClose) {
    infoBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Don't trigger start screen click
      infoModal.classList.add('show');
    });

    infoClose.addEventListener('click', (e) => {
      e.stopPropagation(); // Don't bubble to start screen
      e.preventDefault();
      infoModal.classList.remove('show');
    });

    // Close modal when clicking outside content
    infoModal.addEventListener('click', (e) => {
      e.stopPropagation(); // Don't bubble to start screen
      if (e.target === infoModal) {
        infoModal.classList.remove('show');
      }
    });
  }

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

      // Recreate game with new difficulty settings for preview
      if (game) {
        game.stopPreview();
        game.dispose();
      }
      const newSettings = DIFFICULTIES[selectedDifficulty];
      game = new Game(container, newSettings, selectedDifficulty);
      game.startPreview();
    });
  });

  // Start screen click handler
  const startScreen = document.getElementById('start-screen');
  if (startScreen) {
    startScreen.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // Only start game if clicking directly on start screen background or specific text elements
      // Ignore clicks on any buttons or interactive elements
      if (target.tagName === 'BUTTON' ||
          target.closest('button') ||
          target.closest('.difficulty-selector') ||
          target.closest('.leaderboard')) {
        return;
      }

      startScreen.classList.add('hidden');
      document.getElementById('hud')?.classList.remove('hidden');

      // Stop preview and start actual game
      if (game) {
        game.stopPreview();
        game.start();
      }
    });
  }

  // Play again button
  const playAgainBtn = document.getElementById('play-again');
  if (playAgainBtn) {
    playAgainBtn.addEventListener('click', () => {
      document.getElementById('win-screen')!.style.display = 'none';
      document.getElementById('hud')?.classList.add('hidden');
      // Update leaderboard for current difficulty before restarting
      updateLeaderboard(selectedDifficulty);
      // Show start screen
      startScreen?.classList.remove('hidden');
      if (game) {
        game.restart();
        // Start preview mode again
        game.startPreview();
      }
    });
  }
});
