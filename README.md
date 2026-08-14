# Pose-a-Cat 🐱

A tiny, no-build, static website: it watches your webcam, and when you strike
a pose you've taught it, it reveals the matching cat image — like the
Instagram pose-matching filters, but running entirely in your browser.

**No server, no backend, no build step.** It's just `index.html` + `style.css`
+ `app.js`, so it runs great on GitHub Pages (or literally any static host).

## How it works

1. Your browser loads [MoveNet](https://www.tensorflow.org/hub/tutorials/movenet)
   (via TensorFlow.js, pulled from a CDN) — a small ML model that finds body
   keypoints (shoulders, elbows, wrists, hips, etc.) in each webcam frame.
2. **You calibrate**: for each cat image, you strike a pose and hit "Capture
   pose." The app records your body keypoints, normalized relative to your
   shoulders (so it doesn't matter how close you are to the camera or where
   you're standing).
3. **Live matching**: every frame, your current pose is compared against all
   the poses you calibrated. Whichever one is closest — if it's close enough —
   gets revealed on screen, the same way the Instagram filter does it.
4. Everything happens on-device. Nothing is uploaded anywhere — there's no
   server to send it to.

## Using your own cat images (recommended!)

Right now the site ships with 5 simple placeholder cat doodles so you can try
it immediately. To swap in your own images:

1. Drop your image files into the `images/` folder (`.jpg`, `.png`, `.webp`,
   `.gif` all work).
2. Open `poses-config.js` and update the `src` (and `label`, if you like) for
   each entry to point at your files:

   ```js
   const POSE_SLOTS = [
     { id: "cat1", label: "Surprised Cat", src: "images/my-cat-1.jpg" },
     { id: "cat2", label: "Cool Cat",      src: "images/my-cat-2.jpg" },
     // ...add or remove as many as you want
   ];
   ```
3. Reload the page. Calibration is saved per `id`, so as long as you keep the
   same ids your old calibration carries over — but if it's a new pose for a
   new image, just re-calibrate it (takes 3 seconds).

You can have as few or as many pose slots as you want — just add or remove
entries in that array.

## Running it locally

Because it needs camera access, browsers require either **HTTPS** or
**localhost**. You can't just double-click `index.html` (the `file://`
protocol blocks camera access in most browsers) — instead, serve the folder:

```bash
# from inside this folder
python3 -m http.server 8000
# then open http://localhost:8000 in your browser
```

(Any static server works — `npx serve`, VS Code's "Live Server" extension,
etc.)

## Deploying to GitHub Pages

1. Create a new GitHub repository (or use an existing one) and push this
   folder's contents to it:

   ```bash
   git init
   git add .
   git commit -m "Pose-a-Cat site"
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

- **Sensitivity slider**: controls how close your live pose needs to be to a
  calibrated pose to count as a match. Lower it if matches feel too strict,
  raise it if random poses are triggering matches too easily.
- **Show skeleton**: toggles the on-screen keypoint overlay, handy while
  calibrating so you can see what the model is actually tracking.
- **Reset all calibrations**: clears every saved pose (click once to arm it,
  click again within 3 seconds to confirm).

## Notes & limitations

- Works best with your upper body clearly visible and both shoulders in
  frame — that's what the matching is anchored to.
- One person at a time (MoveNet here is running in single-pose mode).
- Calibration is stored in your browser's `localStorage`, per device/browser
  — it won't follow you to a different computer or browser automatically.
- If you want tighter or more forgiving matching logic, the comparison lives
  in `app.js` in the `poseSimilarity()` function — it's a simple average
  normalized-distance calculation, easy to tweak.
