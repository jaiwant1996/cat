// ---------------------------------------------------------------------------
// POSE SLOTS CONFIG
// ---------------------------------------------------------------------------
// This is the ONLY file you need to edit to use your own cat images.
//
// Each entry is one "slot": a picture, plus a calibrated pose that unlocks it.
// The pose itself is NOT defined here — you capture it live in the browser
// (see the "Calibrate" button under each card). This file just lists which
// images exist and what to call them.
//
// To use your own images:
//   1. Drop your image files into this folder (jpg/png/webp/gif all work) —
//      currently pointing at the img/ folder.
//   2. Replace the `src` values below with your file names.
//   3. Optionally rename the `label` for each one.
//   4. Reload the page and re-calibrate each pose (calibration is tied to the
//      slot id, so it will carry over automatically if you keep the same ids).
//
// You can have as few or as many slots as you like — just add/remove entries.
// ---------------------------------------------------------------------------

const POSE_SLOTS = [
  { id: "cat1", label: "Idle Cat",    src: "img/cat-idle.png" },
  { id: "cat2", label: "Punch Cat",   src: "img/cat-punch.gif" },
  { id: "cat3", label: "Stretch Cat", src: "img/cat-stretch.gif" },
  { id: "cat4", label: "Tongue Cat",  src: "img/cat-tongie.jpeg" },
];

// (The `images/` folder still has 5 placeholder doodles if you ever want
// extras or examples — feel free to ignore or delete that folder.)
