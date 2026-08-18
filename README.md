# Copy Cat 🐱

A tiny, no-build, static website: it watches your webcam, and when you strike
a pose, it reveals the matching cat image — like the Instagram pose-matching
filters, but running entirely in your browser.

**No server, no backend, no build step.** It's just HTML/CSS/JS, so it runs
great on GitHub Pages (or literally any static host).

**Visitors never have to calibrate anything.** You (the site owner) calibrate
each pose once, export it, and that becomes part of the site. Everyone else
just opens the page, allows the camera, and starts striking poses.

## How it works

1. Your browser loads [MoveNet](https://www.tensorflow.org/hub/tutorials/movenet)
   (via TensorFlow.js, bundled locally in `vendor/`) — a small ML model that
   finds body keypoints (shoulders, elbows, wrists, hips, etc.) in each
   webcam frame. It also loads **MediaPipe Hands**, which tracks each
   finger's position — so matching cares about hand/finger shape (peace
   sign, fist, spread fingers, etc.), not just where your arms are.
2. **You calibrate once, in "setup mode"**: for each cat image, you strike a
   pose and hit "Capture." The app records your body keypoints and finger
   positions together, normalized relative to your shoulders (so it doesn't
   matter how close you are to the camera or where you're standing). Then
   you click **Export poses** to save everything as `calibrated-poses.json`.
3. That JSON file ships with the site. On every future page load — for you
   or anyone else — those poses are loaded automatically, and the site opens
   straight into "play mode": no calibration controls, just the video feed
   and the cat cards.
4. **Live matching**: every frame, the visitor's current pose is compared
   against the saved poses. Whichever one is closest — if it's close enough —
   gets revealed, the same way the Instagram filter does it.
5. Everything happens on-device. Nothing is uploaded anywhere — there's no
   server to send it to.

## Saving your poses (do this once)

1. Run the site locally (see below) and open it in your browser.
2. Since no poses are saved yet, it opens straight into **setup mode**
   automatically (you'll see a banner and Capture/Clear buttons on every
   card). If you ever need to get back here later, click **⚙ Calibrate
   poses** near the "Cat poses" heading.
3. Click **Start Camera**.
4. For each cat card, strike the pose you want linked to it and click
   **Capture** — there's a 3-second countdown, then it grabs your pose.
5. Once all the poses you want are calibrated, click **Export poses (.json)**.
   This downloads `calibrated-poses.json`.
6. Move that downloaded file into this project folder, replacing the empty
   placeholder that's there now.
7. Reload the page. Setup mode turns itself off automatically (poses now
   exist), and the site behaves like a finished product: just video feed +
   cat cards, matching immediately.
8. Deploy (see below) — every visitor gets this same zero-calibration
   experience.

Want to redo or add a pose later? Click **⚙ Calibrate poses** again, capture
away, and export again to update the file. There's also an **Import poses**
button if you want to load a previously exported file back in.

## Using your own cat images

The site currently points at the images in `img/` — see `poses-config.js`
for the current list. To change them:

1. Drop your image files into the `img/` folder (`.jpg`, `.png`, `.webp`,
   `.gif` all work).
2. Open `poses-config.js` and update the `src` (and `label`, if you like) for
   each entry to point at your files:

   ```js
   const POSE_SLOTS = [
     { id: "cat1", label: "Idle Cat",  src: "img/cat-idle.png" },
     { id: "cat2", label: "Punch Cat", src: "img/cat-punch.gif" },
     // ...add or remove as many as you want
   ];
   ```
3. Reload the page and re-calibrate + re-export (see above) — calibration is
   tied to the slot `id`, so unrelated poses carry over automatically as long
   as you keep their ids unchanged.

You can have as few or as many pose slots as you want — just add or remove
entries in that array. (The `images/` folder has 5 placeholder doodles from
an earlier draft — safe to ignore or delete.)

## Running it locally

Because it needs camera access, browsers require either **HTTPS** or
**localhost**. You can't just double-click `index.html` (the `file://`
protocol blocks both camera access and the `fetch()` call that loads your
saved poses) — instead, serve the folder:

```bash
# from inside this folder
python3 -m http.server 8000
# then open http://localhost:8000 in your browser
```

(Any static server works — `npx serve`, VS Code's "Live Server" extension,
etc.)

## Deploying to GitHub Pages

1. Create a new GitHub repository (or use an existing one) and push this
   folder's contents to it — make sure `calibrated-poses.json` (with your
   real exported poses in it) is included:

   ```bash
   git init
   git add .
   git commit -m "Copy Cat site"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```

2. On GitHub, go to your repo → **Settings → Pages**.
3. Under "Build and deployment", set **Source** to "Deploy from a branch",
   pick the **main** branch and **/ (root)** folder, then save.
4. After a minute or two, your site will be live at
   `https://<your-username>.github.io/<your-repo>/`.

GitHub Pages serves everything over HTTPS by default, so camera access will
work there without any extra setup.

## Tuning it

- **Sensitivity slider**: controls how close a live pose needs to be to a
  saved pose to count as a match. Lower it if matches feel too strict, raise
  it if random poses are triggering matches too easily. Visible to everyone,
  no setup mode needed.
- **Show skeleton**: toggles the on-screen keypoint overlay, handy while
  calibrating so you can see what the model is actually tracking.
- **⚙ Calibrate poses**: reveals setup mode (Capture/Clear per card, Export,
  Import, Reset all) — hidden from regular visitors by default.
- **Reset all calibrations** (setup mode only): clears every saved pose in
  this browser session (click once to arm it, click again within 3 seconds
  to confirm). This doesn't touch `calibrated-poses.json` on disk — reload
  the page and the bundled poses come right back. To actually change what's
  shipped, re-export.

## Notes & limitations

- Works best with the upper body clearly visible and both shoulders in
  frame — that's what the matching is anchored to.
- Finger tracking (MediaPipe Hands) is a bonus layer on top of body pose: if
  a visitor's browser can't load it for any reason, the site quietly falls
  back to body-pose-only matching instead of breaking. Poses calibrated
  before this feature shipped still work fine — they just don't have finger
  data baked in. Re-calibrate (**⚙ Calibrate poses** → Capture → Export) to
  add finger precision to a pose.
- One person at a time (MoveNet here is running in single-pose mode; hand
  tracking supports up to two hands).
- Poses load with this precedence: `calibrated-poses.json` (shipped with the
  site) as the base, then anything saved in the current browser's
  `localStorage` layered on top. That local layer is what setup mode edits
  live, before you export it back into the JSON file.
- Because the saved poses are calibrated against one real body and camera
  setup, visitors with very different proportions or camera framing may find
  matching feels a bit strict or loose — the Sensitivity slider is there for
  exactly that.
- If you want tighter or more forgiving matching logic, the comparison lives
  in `app.js` in the `poseSimilarity()` function — it's a simple average
  normalized-distance calculation, easy to tweak.
