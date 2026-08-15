// ---------------------------------------------------------------------------
// POSE SLOTS CONFIG
// ---------------------------------------------------------------------------
// This is the ONLY file you need to edit to use your own cat images.
//
// Each entry is one "slot": a picture, plus a pose that unlocks it. The pose
// itself is NOT defined here — it lives in calibrated-poses.json, which you
// generate once by clicking "⚙ Calibrate poses" on the site, striking each
// pose, and hitting "Export poses". That file ships with the site, so
// regular visitors never have to calibrate anything themselves.
//
// To use your own images:
//   1. Drop your image files into this folder (jpg/png/webp/gif all work) —
//      currently pointing at the img/ folder.
//   2. Replace the `src` values below with your file names.
//   3. Optionally rename the `label` for each one.
//   4. Reload the page and re-calibrate the affected pose(s), then export
//      again (calibration is tied to the slot `id`, so unrelated poses carry
//      over automatically as long as you keep their ids unchanged).
//
// You can have as few or as many slots as you like — just add/remove entries.
// ---------------------------------------------------------------------------

const POSE_SLOTS = [
  { id: "cat1", label: "Idle Cat",    src: "img/cat-idle.png" },
  { id: "cat2", label: "Punch Cat",   src: "img/cat-punch.gif" },
  { id: "cat3", label: "Stretch Cat", src: "img/cat-stretch.gif" },
  { id: "cat4", label: "Fight Cat",   src: "img/cat-fight.jpeg" },
  { id: "cat5", label: "Sad Cat",     src: "img/cat-sad.jpg" },
  { id: "cat6", label: "Cute Cat",    src: "img/cat-cute.jpg" },
  { id: "cat7", label: "Karate Cat",  src: "img/cat-fight-2.jpg" },
  { id: "cat8", label: "Scuba Cat",   src: "img/cat-scuba.gif" },
  { id: "cat9", label: "Karate Cat",  src: "img/karate-cat.jpg"}
];

// (The `images/` folder still has 5 placeholder doodles if you ever want
// extras or examples — feel free to ignore or delete that folder.)
