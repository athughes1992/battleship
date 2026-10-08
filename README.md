# battleship

Play Battleship against an AI in your browser.

**Play it here:** https://athughes1992.github.io/battleship/

## How to play

Rules follow the classic Hasbro/Milton Bradley game.

1. **Place your fleet** on the 10x10 grid: Carrier (5), Battleship (4), Cruiser (3), Submarine (3), Destroyer (2).
   - Click a square to place the highlighted ship. Press **R** (or the Rotate button) to switch between horizontal and vertical.
   - Ships can't go diagonally, overlap, or hang off the grid.
   - Click a placed ship to pick it up and move it, or use **Randomize** to place them all automatically.
2. Choose an **AI difficulty** and press **Start Battle**. A coin flip decides who shoots first.
3. Take turns firing one shot at a time at **Enemy Waters**. After each shot you're told whether it hit or missed, and which ship you hit.
4. When every square of a ship has been hit, it's sunk and its name is announced.
5. The first player to sink all 5 enemy ships wins.

Your win/loss record is saved in your browser (localStorage) only; nothing leaves your computer.

### AI difficulty

| Level  | Strategy |
| ------ | -------- |
| Easy   | Fires at random squares. |
| Normal | Hunt and target: searches in a checkerboard pattern, then attacks the squares around each hit until the ship sinks. |
| Hard   | Probability map: for every square, counts how many ways the remaining ships could fit there, then fires at the most likely square. |

## Run it locally

No build step and no dependencies. Either open `index.html` directly in a browser, or serve the folder:

```sh
python3 -m http.server 8080
# then visit http://localhost:8080
```

## Code layout

- `index.html`: page structure
- `css/style.css`: styling
- `js/game-logic.js`: rules and AI (no DOM code, also loadable in Node)
- `js/ui.js`: rendering and player interaction
- `tests/game-logic.test.js`: unit tests plus AI simulation games

## Tests

Requires Node.js 18+:

```sh
node --test tests/*.test.js
```

The simulation test plays hundreds of games per difficulty and checks that the AI never repeats a shot, always finishes, and that harder levels win in fewer shots.
