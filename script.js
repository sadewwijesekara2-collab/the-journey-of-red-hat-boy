'use strict';

(() => {
  const game = document.getElementById('game');
  const player = document.getElementById('player');
  const scoreElement = document.getElementById('score');
  const startScreen = document.getElementById('startScreen');
  const endScreen = document.getElementById('endScreen');
  const winScreen = document.getElementById('winScreen');
  const endScore = document.getElementById('endScore');
  const winFinalScore = document.getElementById('winFinalScore');

  const sounds = {
    run: new Audio('sounds/run.mp3'),
    jump: new Audio('sounds/jump.mp3'),
    dead: new Audio('sounds/dead.mp3'),
    cheer: new Audio('sounds/kids_cheering.mp3')
  };
  sounds.run.loop = true;
  sounds.run.volume = 0.35;

  const RUN_FRAMES = 8;
  const JUMP_FRAMES = 12;
  const DEAD_FRAMES = 10;
  const WIN_SCORE = 500;
  // The ground line is part of the supplied background artwork.
  // These coordinates are measured from background/background.png (1366 x 683).
  const BACKGROUND_WIDTH = 1366;
  const BACKGROUND_HEIGHT = 683;
  const GROUND_LINE_Y = 542;
  const PLAYER_TRANSPARENT_BOTTOM_RATIO = 63 / 569; // transparent padding in Run (1).png
  // flame.gif contains transparent padding below its visible pixels.
  const FLAME_VISIBLE_BOTTOM_RATIO = 769 / 933;
  const FLAME_VISIBLE_TOP_RATIO = 129 / 933;
  const FLAME_VISIBLE_LEFT_RATIO = 95 / 505;
  const FLAME_VISIBLE_RIGHT_RATIO = 408 / 505;
  const JUMP_DURATION = 850;
  const JUMP_HEIGHT = 190;

  let state = 'ready';
  let score = 0;
  let lastFrameTime = 0;
  let animationFrameId = null;
  let lastRunFrame = 0;
  let lastJumpFrame = 0;
  let jumpStartedAt = 0;
  let isJumping = false;
  let obstacles = [];
  let nextObstacleIn = 1.5;
  let scoreAccumulator = 0;
  let deathStartedAt = 0;


  function alignSpritesToGround() {
    // Match CSS background-size: cover and background-position: center bottom.
    const scale = Math.max(
      game.clientWidth / BACKGROUND_WIDTH,
      game.clientHeight / BACKGROUND_HEIGHT
    );
    const groundBottom = (BACKGROUND_HEIGHT - GROUND_LINE_Y) * scale;
    game.style.setProperty('--ground-bottom', `${groundBottom}px`);

    // Run sprites contain transparent pixels below the character's feet.
    // Compensate for that padding so the visible feet touch the artwork's grass line.
    const playerHeight = player.getBoundingClientRect().height;
    const transparentBottom = playerHeight * PLAYER_TRANSPARENT_BOTTOM_RATIO;
    player.style.bottom = `${Math.max(0, groundBottom - transparentBottom)}px`;
  }

  function playSound(sound) {
    sound.currentTime = 0;
    const promise = sound.play();
    if (promise && typeof promise.catch === 'function') promise.catch(() => {});
  }

  function stopSound(sound) {
    sound.pause();
    sound.currentTime = 0;
  }

  function showOnly(screen) {
    [startScreen, endScreen, winScreen].forEach((element) => {
      element.hidden = element !== screen;
    });
  }

  function resetGame() {
    if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
    obstacles.forEach((obstacle) => obstacle.element.remove());
    obstacles = [];
    score = 0;
    scoreAccumulator = 0;
    nextObstacleIn = 1.5;
    isJumping = false;
    jumpStartedAt = 0;
    lastRunFrame = 0;
    lastJumpFrame = 0;
    lastFrameTime = 0;
    alignSpritesToGround();
    player.style.transform = 'translateY(0)';
    player.src = 'sprites/Run (1).png';
    scoreElement.textContent = '0';
    stopSound(sounds.run);
    stopSound(sounds.jump);
    stopSound(sounds.dead);
    stopSound(sounds.cheer);
  }

  function startGame() {
    if (state === 'playing') return;
    resetGame();
    state = 'playing';
    showOnly(null);
    playSound(sounds.run);
    animationFrameId = requestAnimationFrame(gameLoop);
  }

  function jump() {
    if (state !== 'playing' || isJumping) return;
    isJumping = true;
    jumpStartedAt = performance.now();
    playSound(sounds.jump);
  }

  function createObstacle() {
    const element = document.createElement('div');
    element.className = 'block';
    element.setAttribute('aria-hidden', 'true');
    game.appendChild(element);
    // Move the image canvas down by its transparent bottom padding so the
    // visible tip/base of the flame sits exactly on the grass/ground line.
    const flameHeight = element.getBoundingClientRect().height;
    const groundBottom = Number.parseFloat(getComputedStyle(game).getPropertyValue('--ground-bottom')) || 0;
    const transparentBottom = flameHeight * (1 - FLAME_VISIBLE_BOTTOM_RATIO);
    element.style.bottom = `${groundBottom - transparentBottom}px`;
    obstacles.push({ element, x: game.clientWidth });
    nextObstacleIn = 1.25 + Math.random() * 1.15;
  }

  function rectanglesOverlap(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }

  function getPlayerHitbox() {
    const rect = player.getBoundingClientRect();
    // Ignore transparent padding in the character PNG. This makes collision
    // match the visible body instead of the full image canvas.
    return {
      left: rect.left + rect.width * (249 / 669),
      right: rect.left + rect.width * (532 / 669),
      top: rect.top + rect.height * (42 / 569),
      bottom: rect.top + rect.height * (506 / 569)
    };
  }

  function getFlameHitbox(element) {
    const rect = element.getBoundingClientRect();
    // Use the visible flame area and a slightly forgiving central width.
    // The lower edge aligns with the ground; the transparent canvas is ignored.
    return {
      left: rect.left + rect.width * FLAME_VISIBLE_LEFT_RATIO,
      right: rect.left + rect.width * FLAME_VISIBLE_RIGHT_RATIO,
      top: rect.top + rect.height * FLAME_VISIBLE_TOP_RATIO,
      bottom: rect.top + rect.height * FLAME_VISIBLE_BOTTOM_RATIO
    };
  }

  function updatePlayer(now) {
    if (isJumping) {
      const elapsed = now - jumpStartedAt;
      const progress = Math.min(elapsed / JUMP_DURATION, 1);
      const height = Math.sin(progress * Math.PI) * JUMP_HEIGHT;
      player.style.transform = `translateY(${-height}px)`;
      const frame = Math.min(JUMP_FRAMES, Math.floor(progress * JUMP_FRAMES) + 1);
      if (now - lastJumpFrame > 65) {
        player.src = `sprites/Jump (${frame}).png`;
        lastJumpFrame = now;
      }
      if (progress >= 1) {
        isJumping = false;
        player.style.transform = 'translateY(0)';
        player.src = 'sprites/Run (1).png';
        stopSound(sounds.jump);
        playSound(sounds.run);
      }
    } else if (now - lastRunFrame > 100) {
      const frame = Math.floor(now / 100) % RUN_FRAMES + 1;
      player.src = `sprites/Run (${frame}).png`;
      lastRunFrame = now;
    }
  }

  function finishGame(won) {
    if (state !== 'playing') return;
    state = won ? 'won' : 'dead';
    stopSound(sounds.run);
    stopSound(sounds.jump);
    if (won) {
      winFinalScore.textContent = String(score);
      showOnly(winScreen);
      playSound(sounds.cheer);
      return;
    }
    playSound(sounds.dead);
    deathStartedAt = performance.now();
  }

  function updateDeath(now) {
    const frame = Math.min(DEAD_FRAMES, Math.floor((now - deathStartedAt) / 90) + 1);
    player.src = `sprites/Dead (${frame}).png`;
    if (frame >= DEAD_FRAMES) {
      endScore.textContent = String(score);
      showOnly(endScreen);
      state = 'gameover';
      if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    } else {
      animationFrameId = requestAnimationFrame(gameLoop);
    }
  }

  function gameLoop(now) {
    if (state === 'dead') {
      updateDeath(now);
      return;
    }
    if (state !== 'playing') return;

    const delta = lastFrameTime ? Math.min((now - lastFrameTime) / 1000, 0.05) : 0;
    lastFrameTime = now;
    updatePlayer(now);

    scoreAccumulator += delta;
    if (scoreAccumulator >= 0.1) {
      const points = Math.floor(scoreAccumulator / 0.1);
      score += points;
      scoreAccumulator -= points * 0.1;
      scoreElement.textContent = String(score);
      if (score >= WIN_SCORE) {
        score = WIN_SCORE;
        scoreElement.textContent = String(score);
        finishGame(true);
        return;
      }
    }

    nextObstacleIn -= delta;
    if (nextObstacleIn <= 0) createObstacle();

    const playerRect = getPlayerHitbox();
    for (let index = obstacles.length - 1; index >= 0; index -= 1) {
      const obstacle = obstacles[index];
      obstacle.x -= 360 * delta;
      obstacle.element.style.left = `${obstacle.x}px`;
      if (obstacle.x + obstacle.element.offsetWidth < 0) {
        obstacle.element.remove();
        obstacles.splice(index, 1);
        continue;
      }
      if (rectanglesOverlap(playerRect, getFlameHitbox(obstacle.element))) {
        finishGame(false);
        animationFrameId = requestAnimationFrame(gameLoop);
        return;
      }
    }

    animationFrameId = requestAnimationFrame(gameLoop);
  }

  document.getElementById('startButton').addEventListener('click', startGame);
  document.getElementById('retryButton').addEventListener('click', startGame);
  document.getElementById('playAgainButton').addEventListener('click', startGame);

  document.addEventListener('keydown', (event) => {
    if (event.code === 'Space' || event.code === 'ArrowUp') {
      event.preventDefault();
      if (state === 'ready') startGame();
      else jump();
    } else if (event.code === 'Enter' && state === 'ready') {
      startGame();
    }
  });

  // Allow a tap/click on the game area to jump on touch devices.
  game.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button, .overlay')) return;
    jump();
  });

  showOnly(startScreen);
  if (player.complete) alignSpritesToGround();
  else player.addEventListener('load', alignSpritesToGround, { once: true });
  window.addEventListener('resize', alignSpritesToGround);
})();
