# Fell For It Again FC — League Scorecard

A static scorecard for a 5-player FIFA/EA FC club-team league: round-robin season, auto-computed standings, and a knockout bracket seeded from the table.

## Use it

Open the live page (GitHub Pages) or `index.html` locally. No install, no backend.

1. **Roster** — enter each manager's name, club, and star rating, then generate the season fixtures.
2. **Fixtures** — enter scores as matches are played.
3. **Table** — standings update automatically (Pts, then GD, then GF).
4. **Knockout** — seed a bracket from the current table (top 4 go to semis) and fill in results as you play.

## Data

Everything is saved to `localStorage` in your browser only — nothing is synced between devices automatically. Use the **Data** tab to export your progress as JSON and share it with the group, or import someone else's export.

## Files

- `index.html` — structure
- `style.css` — pitch/scoreboard visual design
- `script.js` — roster, scheduling, standings, and bracket logic
