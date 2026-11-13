# Working rules for Claude sessions

Forest Discovery is a lightweight browser game about wandering through an old forest that feels alive. Plain JavaScript, Canvas 2D, Web Audio. No engine, no build step, no runtime dependencies. Live at https://koetsuji.github.io/forest-discovery/.

## Read first

1. All of docs/: game-brief.md, architecture.md, wind-system.md, art-guide.md, sound-and-feel.md, roadmap.md.
2. docs/devlog.md and docs/decisions.md, to see where the last session stopped.

docs/ is the source of truth. If it disagrees with any other copy, docs/ wins.

## Who decides

- Claude decides technical choices, structure, tuning, wording and order of work. Decide, log the decision and the reason in docs/decisions.md, move on.
- The owner decides: spending money or Sprite AI tokens, the identity of the game (name, mood, story, the look of the wanderer, the style anchor), going over a budget in docs/architecture.md, deleting work, anything published outside this repo and its Pages site.
- Ask at most three questions at a time, each with a recommendation. With no answer, take the most reasonable reading, say which one, and continue with what does not depend on it.

## How to work

- Stay inside the current milestone in docs/roadmap.md. Fire, collecting and creatures are not part of the base. Never block them: check "Extension points" in docs/architecture.md before any structural change.
- Small commits with clear messages, pushed to main. Every push goes live.
- Never push what was not seen running. Run the checks below and look at the screenshots.
- Stay inside the budgets. No new dependency, framework, build step or external request without asking the owner.
- Everything standing in the world comes from generated sprites (docs/art-guide.md). Stand-ins must look like stand-ins.
- Every interactive thing answers back with motion and sound (docs/sound-and-feel.md). Feel is part of done.
- The interface shell uses Vercel's Geist design system.
- Keep the documents true: when a decision changes a file in docs/, update it in the same commit.
- End every session by updating docs/devlog.md and docs/roadmap.md.
- No long dashes anywhere: not in text for the owner, not in the game, not in code.
- Talk to the owner bottom line first, and short. When the owner has to do something, give one step with its check and wait for the result.

## Privacy

The repo and the site are public. The owner is "koetsuji". No real name and no email address in commits, files, credits or the page. No analytics, no tracking.

## Checks before every push

    node tools/check.mjs

It runs the checks from docs/architecture.md, in order:

1. `node --test`: rng and world determinism, wind math, save migration, and guards on the repo (relative paths, no outside requests, no long dashes).
2. `node tools/screenshot.mjs`: a local server plus headless Chrome load the game with a fixed seed and clock, press the buttons, and write screenshots to out/shots/. Open them and look.
3. The same run fails if the browser console shows a warning or an error.
4. `node tools/size-report.mjs`: the budgets.

If a session cannot run a browser, it says so in its report and in docs/devlog.md, and does not push what it has not seen.

## Useful commands

    node tools/serve.mjs            play locally at http://127.0.0.1:8080/forest-discovery/
    node tools/sync-preloads.mjs    after adding or removing a module in src/
    node tools/size-report.mjs --files

Screenshot URLs take `?seed=7&t=12.5&freeze=1&title=0`: a seed, a moment on the simulation clock, time held still, and no title screen.
