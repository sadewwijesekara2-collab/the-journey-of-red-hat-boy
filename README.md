# The Journey of Red Hat Boy

A small 2D browser game built with HTML, CSS and JavaScript.

## Run the game

1. Extract the project folder.
2. Open `index.html` in a modern web browser.
3. Select **Start Game**.
4. Press **Space** or **Up Arrow** to jump over the flames. On touch devices, tap the game area.

## Ground alignment

The player and flame obstacles are positioned using the ground line in `background/background.png`. The game calculates the background's `cover` scale and adjusts the sprite baseline when the window is resized, so the character's feet stay aligned with the grass across different screen sizes.

## Project files

- `index.html` — game structure
- `style.css` — layout and appearance
- `script.js` — game logic, movement, collision and scoring
- `background/` — background artwork
- `sprites/` — character animations and obstacle artwork
- `sounds/` — sound effects and music
