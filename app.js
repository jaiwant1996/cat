'use strict';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// MoveNet's 17 keypoints, in the order the model returns them.
const KEYPOINT_NAMES = [
  'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
  'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
  'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
  'left_knee', 'right_knee', 'left_ankle', 'right_ankle',
];
const LEFT_SHOULDER = 5, RIGHT_SHOULDER = 6;

// Keypoints actually used when comparing two poses for similarity: shoulders,
// elbows, wrists and hips. Deliberately excludes the face (nose/eyes/ears)
// and legs (knees/ankles) — those rarely carry useful signal for the kind of
// "strike a pose" hand/arm gestures this app matches, and including them
// would dilute a real arm movement across 17 mostly-unchanged points.
const COMPARE_KEYPOINT_INDICES = new Set([5, 6, 7, 8, 9, 10, 11, 12]);
const MIN_COMPARE_KEYPOINTS = 4;

// Which pairs of keypoints to connect when drawing the skeleton overlay.
const SKELETON_EDGES = [
  [0, 1], [0, 2], [1, 3], [2, 4],
  [5, 6], [5, 7], [7, 9], [6, 8], [8, 10],
  [5, 11], [6, 12], [11, 12],
  [11, 13], [13, 15], [12, 14], [14, 16],
];

const SCORE_THRESHOLD = 0.3;      // minimum confidence to trust a keypoint
const MATCH_HOLD_FRAMES = 6;      // consecutive good frames before confirming a match
const CLEAR_HOLD_FRAMES = 12;     // consecutive bad frames before clearing a match
const CAPTURE_COUNTDOWN_SEC = 3;  // seconds of countdown before capturing a pose
const CAPTURE_SAMPLE_MS = 700;    // how long to sample frames while capturing
const CALIBRATION_STORAGE_KEY = 'poseCatCalibrations_v1';
const BUNDLED_POSES_URL = 'calibrated-poses.json';

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------
const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const ctx = canvas.getContext('2d');
const videoWrap = document.querySelector('.video-wrap');
const startBtn = document.getElementById('startBtn');
const cameraMsg = document.getElementById('cameraOverlayMsg');
const matchFlash = document.getElementById('matchFlash');
const revealImg = document.getElementById('revealImg');
const revealEmptyState = document.getElementById('revealEmptyState');
const matchMeterFill = document.getElementById('matchMeterFill');
const matchLabel = document.getElementById('matchLabel');
const thresholdInput = document.getElementById('threshold');
const thresholdValue = document.getElementById('thresholdValue');
const resetAllBtn = document.getElementById('resetAllBtn');
const exportBtn = document.getElementById('exportBtn');
const importInput = document.getElementById('importInput');
const importLabel = document.getElementById('importLabel');
const setupToggleBtn = document.getElementById('setupToggleBtn');
const setupBanner = document.getElementById('setupBanner');
const slotsHint = document.getElementById('slotsHint');
const revealEmptyHint = document.getElementById('revealEmptyHint');
const skeletonToggle = document.getElementById('skeletonToggle');
const slotsGrid = document.getElementById('slotsGrid');

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let THRESHOLD = parseFloat(thresholdInput.value);

let detector = null;
let cameraRunning = false;
let detecting = false;

// Populated by init(): bundled poses (shipped with the site, so visitors
// never have to calibrate) merged with anything saved in this browser.
let calibrations = {};

// Setup mode shows the Capture/Clear/Export controls. It defaults to ON only
// when there are no saved poses yet (first-time setup); once poses exist —
// either bundled or from a prior local calibration — it defaults to OFF so
// regular visitors just see the video feed and cat cards.
let setupMode = false;

const matchState = { candidateId: null, candidateFrames: 0, currentMatchId: null, missFrames: 0 };
const capture = { slotId: null, phase: 'idle', samples: [], sampleEndsAt: 0 };

let resetArmed = false;
let resetArmTimer = null;

// ---------------------------------------------------------------------------
// Calibration storage
// ---------------------------------------------------------------------------
function loadCalibrations() {
  try {
    const raw = localStorage.getItem(CALIBRATION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn('Could not read saved calibrations:', e);
    return {};
  }
}

function saveCalibrations() {
  try {
    localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(calibrations));
  } catch (e) {
    console.warn('Could not save calibrations:', e);
  }
}

// The poses shipped with the site (see calibrated-poses.json). This is what
// lets visitors use the app with zero calibration of their own.
async function loadBundledPoses() {
  try {
    const res = await fetch(BUNDLED_POSES_URL, { cache: 'no-store' });
    if (!res.ok) return {};
    const data = await res.json();
    return data && typeof data === 'object' ? data : {};
  } catch (e) {
    console.warn('No bundled calibrated-poses.json yet (expected before first-time setup):', e);
    return {};
  }
}

function exportPoses() {
  const blob = new Blob([JSON.stringify(calibrations, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'calibrated-poses.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function importPosesFromFile(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object') throw new Error('not an object');
    calibrations = { ...calibrations, ...data };
    saveCalibrations();
    refreshAllSlotStatuses();
  } catch (e) {
    console.error('Could not import poses file — is it a calibrated-poses.json export?', e);
  }
}

// ---------------------------------------------------------------------------
// Slot cards (built from POSE_SLOTS in poses-config.js)
// ---------------------------------------------------------------------------
function buildSlots() {
  slotsGrid.innerHTML = '';
  POSE_SLOTS.forEach((slot) => {
    const card = document.createElement('div');
    card.className = 'slot-card';
    card.dataset.slotId = slot.id;

    const img = document.createElement('img');
    img.src = slot.src;
    img.alt = slot.label;
    card.appendChild(img);

    const label = document.createElement('p');
    label.className = 'slot-label';
    label.textContent = slot.label;
    card.appendChild(label);

    const status = document.createElement('p');
    status.className = 'slot-status setup-only';
    status.dataset.role = 'status';
    card.appendChild(status);

    const btnRow = document.createElement('div');
    btnRow.className = 'slot-btn-row setup-only';

    const captureBtn = document.createElement('button');
    captureBtn.type = 'button';
    captureBtn.className = 'btn btn-small';
    captureBtn.dataset.role = 'capture-btn';
    captureBtn.textContent = 'Capture';
    captureBtn.addEventListener('click', () => startCapture(slot.id));
    btnRow.appendChild(captureBtn);

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'btn btn-tiny btn-ghost';
    clearBtn.dataset.role = 'clear-btn';
    clearBtn.textContent = 'Clear';
    clearBtn.addEventListener('click', () => clearCalibration(slot.id));
    btnRow.appendChild(clearBtn);

    card.appendChild(btnRow);
    slotsGrid.appendChild(card);

    refreshSlotStatus(slot.id);
  });
}

function refreshSlotStatus(slotId) {
  const card = slotsGrid.querySelector(`[data-slot-id="${slotId}"]`);
  if (!card) return;
  const status = card.querySelector('[data-role="status"]');
  const has = !!calibrations[slotId];
  status.textContent = has ? 'Calibrated ✓' : 'Not calibrated yet';
  status.classList.toggle('calibrated', has);
  card.classList.toggle('is-matched', matchState.currentMatchId === slotId);
}

function refreshAllSlotStatuses() {
  POSE_SLOTS.forEach((s) => refreshSlotStatus(s.id));
}

function clearCalibration(slotId) {
  delete calibrations[slotId];
  saveCalibrations();
  refreshSlotStatus(slotId);
  if (matchState.currentMatchId === slotId) {
    matchState.currentMatchId = null;
    showEmptyReveal();
  }
}

function setAllCaptureButtonsDisabled(disabled) {
  slotsGrid.querySelectorAll('[data-role="capture-btn"]').forEach((btn) => {
    btn.disabled = disabled;
  });
}

function flashStatusMessage(slotId, message) {
  const card = slotsGrid.querySelector(`[data-slot-id="${slotId}"]`);
  if (!card) return;
  const status = card.querySelector('[data-role="status"]');
  status.textContent = message;
  setTimeout(() => refreshSlotStatus(slotId), 1500);
}

resetAllBtn.addEventListener('click', () => {
  if (!resetArmed) {
    resetArmed = true;
    resetAllBtn.textContent = 'Click again to confirm';
    resetAllBtn.classList.add('btn-armed');
    resetArmTimer = setTimeout(() => {
      resetArmed = false;
      resetAllBtn.textContent = 'Reset all calibrations';
      resetAllBtn.classList.remove('btn-armed');
    }, 3000);
    return;
  }

  clearTimeout(resetArmTimer);
  resetArmed = false;
  resetAllBtn.textContent = 'Reset all calibrations';
  resetAllBtn.classList.remove('btn-armed');

  calibrations = {};
  saveCalibrations();
  refreshAllSlotStatuses();
  matchState.currentMatchId = null;
  showEmptyReveal();
});

exportBtn.addEventListener('click', exportPoses);

importInput.addEventListener('change', () => {
  const file = importInput.files[0];
  if (file) importPosesFromFile(file);
  importInput.value = '';
});

setupToggleBtn.addEventListener('click', () => {
  setupMode = !setupMode;
  updateSetupModeVisibility();
});

// ---------------------------------------------------------------------------
// Setup mode (Capture/Clear/Export controls) vs. play mode (visitors)
// ---------------------------------------------------------------------------
function updateSetupModeVisibility() {
  // CSS (`.setup-only`, `body.setup-mode .setup-only`) handles actually
  // showing/hiding the calibration controls — this just flips the body class.
  document.body.classList.toggle('setup-mode', setupMode);

  setupToggleBtn.textContent = setupMode ? '✓ Done calibrating' : '⚙ Calibrate poses';
  slotsHint.textContent = setupMode
    ? 'Click Capture on a card while striking the pose you want linked to it. Hold still for a second — the countdown grabs your pose automatically. When you’re done, click "Export poses" above to save them into the site for good.'
    : 'Strike one of the poses below in front of your camera!';
  if (revealEmptyHint) {
    revealEmptyHint.textContent = setupMode ? 'Calibrate poses below, then strike one!' : 'Strike one of the poses below!';
  }
}

// ---------------------------------------------------------------------------
// Camera + model setup
// ---------------------------------------------------------------------------
async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    cameraMsg.querySelector('p').textContent =
      'This browser can’t access the camera here (camera access needs HTTPS or localhost).';
    return;
  }

  startBtn.disabled = true;

  if (!detector) {
    startBtn.textContent = 'Loading model…';
    try {
      await tf.setBackend('webgl');
      await tf.ready();
      detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
      );
    } catch (err) {
      console.error('Model load failed:', err);
      cameraMsg.querySelector('p').textContent =
        'Could not load the pose-detection model. Check your internet connection and try again.';
      startBtn.textContent = 'Try again';
      startBtn.disabled = false;
      return;
    }
  }

  try {
    startBtn.textContent = 'Requesting camera…';

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    video.srcObject = stream;

    await new Promise((resolve) => {
      video.onloadedmetadata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        videoWrap.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
        resolve();
      };
    });
    await video.play();

    cameraRunning = true;
    cameraMsg.classList.add('hidden');
    detectFrame();
  } catch (err) {
    console.error('Camera/model init failed:', err);
    let msg = 'Could not access the camera.';
    if (err && err.name === 'NotAllowedError') {
      msg = 'Camera permission was denied. Allow camera access in your browser and try again.';
    } else if (err && err.name === 'NotFoundError') {
      msg = 'No camera was found on this device.';
    } else if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      msg = 'Camera access needs HTTPS (or localhost). Serve this page over https, e.g. via GitHub Pages.';
    }
    cameraMsg.querySelector('p').textContent = msg;
    startBtn.textContent = 'Try again';
    startBtn.disabled = false;
  }
}

startBtn.addEventListener('click', startCamera);

// ---------------------------------------------------------------------------
// Detection loop
// ---------------------------------------------------------------------------
async function detectFrame() {
  if (!cameraRunning || !detector) return;

  if (video.readyState >= 2 && !detecting) {
    detecting = true;
    try {
      const poses = await detector.estimatePoses(video, { flipHorizontal: false });
      handlePoseResult(poses[0] || null);
    } catch (e) {
      console.error('Pose estimation error:', e);
    }
    detecting = false;
  }

  requestAnimationFrame(detectFrame);
}

function handlePoseResult(pose) {
  clearCanvas();

  if (!pose || !pose.keypoints) {
    registerMiss();
    updateMatchMeter(0, null);
    return;
  }

  if (skeletonToggle.checked) {
    drawSkeleton(pose.keypoints);
  }

  const normalized = normalizeKeypoints(pose.keypoints);

  if (capture.phase === 'sampling') {
    if (normalized) capture.samples.push(normalized);
    if (performance.now() >= capture.sampleEndsAt) {
      finalizeCapture();
    }
    return;
  }

  if (!normalized) {
    registerMiss();
    updateMatchMeter(0, null);
    return;
  }

  runMatching(normalized);
}

// ---------------------------------------------------------------------------
// Pose normalization + similarity
// ---------------------------------------------------------------------------

// Converts raw pixel-space keypoints into a coordinate system centered on the
// shoulder midpoint and scaled by shoulder width. This makes matching mostly
// invariant to where you stand and how close you are to the camera.
function normalizeKeypoints(keypoints) {
  const ls = keypoints[LEFT_SHOULDER];
  const rs = keypoints[RIGHT_SHOULDER];
  if (!ls || !rs || ls.score < SCORE_THRESHOLD || rs.score < SCORE_THRESHOLD) {
    return null;
  }

  const centerX = (ls.x + rs.x) / 2;
  const centerY = (ls.y + rs.y) / 2;
  const scale = Math.max(Math.hypot(ls.x - rs.x, ls.y - rs.y), 1e-3);

  const result = {};
  keypoints.forEach((kp, idx) => {
    if (kp.score >= SCORE_THRESHOLD) {
      result[idx] = [(kp.x - centerX) / scale, (kp.y - centerY) / scale];
    }
  });
  return result;
}

// Averages several normalized poses captured over ~a second into one stable
// reference pose, only keeping keypoints seen in at least half the samples.
function averageNormalizedPoses(samples) {
  const sums = {};
  const counts = {};
  samples.forEach((pose) => {
    Object.entries(pose).forEach(([idx, xy]) => {
      if (!sums[idx]) { sums[idx] = [0, 0]; counts[idx] = 0; }
      sums[idx][0] += xy[0];
      sums[idx][1] += xy[1];
      counts[idx] += 1;
    });
  });

  const minCount = Math.ceil(samples.length * 0.5);
  const result = {};
  Object.keys(sums).forEach((idx) => {
    if (counts[idx] >= minCount) {
      result[idx] = [sums[idx][0] / counts[idx], sums[idx][1] / counts[idx]];
    }
  });
  return result;
}

// 1.0 = identical poses, decaying smoothly toward 0 as they diverge.
function poseSimilarity(live, reference) {
  const commonIdx = Object.keys(live).filter(
    (idx) => COMPARE_KEYPOINT_INDICES.has(Number(idx)) && Object.prototype.hasOwnProperty.call(reference, idx)
  );
  if (commonIdx.length < MIN_COMPARE_KEYPOINTS) return 0; // not enough overlap to trust the comparison

  let totalDist = 0;
  commonIdx.forEach((idx) => {
    const dx = live[idx][0] - reference[idx][0];
    const dy = live[idx][1] - reference[idx][1];
    totalDist += Math.hypot(dx, dy);
  });
  const avgDist = totalDist / commonIdx.length;
  return 1 / (1 + avgDist);
}

// ---------------------------------------------------------------------------
// Calibration capture flow
// ---------------------------------------------------------------------------
function startCapture(slotId) {
  if (!cameraRunning) {
    flashStatusMessage(slotId, 'Start the camera first!');
    return;
  }
  if (capture.phase !== 'idle') return;

  capture.slotId = slotId;
  capture.phase = 'countdown';
  capture.samples = [];
  setAllCaptureButtonsDisabled(true);

  const card = slotsGrid.querySelector(`[data-slot-id="${slotId}"]`);
  const status = card.querySelector('[data-role="status"]');

  let remaining = CAPTURE_COUNTDOWN_SEC;
  status.textContent = `Get ready… ${remaining}`;
  const countdownTimer = setInterval(() => {
    remaining -= 1;
    if (remaining > 0) {
      status.textContent = `Get ready… ${remaining}`;
    } else {
      clearInterval(countdownTimer);
      status.textContent = 'Hold that pose…';
      capture.phase = 'sampling';
      capture.sampleEndsAt = performance.now() + CAPTURE_SAMPLE_MS;
    }
  }, 1000);
}

function finalizeCapture() {
  const slotId = capture.slotId;
  setAllCaptureButtonsDisabled(false);

  if (capture.samples.length < 3) {
    flashStatusMessage(slotId, 'Could not see you clearly — try again');
  } else {
    calibrations[slotId] = averageNormalizedPoses(capture.samples);
    saveCalibrations();
    refreshSlotStatus(slotId);
  }

  capture.phase = 'idle';
  capture.slotId = null;
  capture.samples = [];
}

// ---------------------------------------------------------------------------
// Matching + reveal
// ---------------------------------------------------------------------------
function runMatching(normalized) {
  let bestId = null;
  let bestScore = 0;

  Object.keys(calibrations).forEach((slotId) => {
    const score = poseSimilarity(normalized, calibrations[slotId]);
    if (score > bestScore) {
      bestScore = score;
      bestId = slotId;
    }
  });

  updateMatchMeter(bestScore, bestId);

  if (bestId && bestScore >= THRESHOLD) {
    if (matchState.candidateId === bestId) {
      matchState.candidateFrames += 1;
    } else {
      matchState.candidateId = bestId;
      matchState.candidateFrames = 1;
    }
    matchState.missFrames = 0;

    if (matchState.candidateFrames >= MATCH_HOLD_FRAMES && matchState.currentMatchId !== bestId) {
      confirmMatch(bestId);
    }
  } else {
    registerMiss();
  }
}

function registerMiss() {
  matchState.candidateId = null;
  matchState.candidateFrames = 0;
  if (matchState.currentMatchId) {
    matchState.missFrames += 1;
    if (matchState.missFrames >= CLEAR_HOLD_FRAMES) {
      matchState.currentMatchId = null;
      matchState.missFrames = 0;
      showEmptyReveal();
    }
  }
}

function confirmMatch(slotId) {
  matchState.currentMatchId = slotId;
  matchState.missFrames = 0;

  const slot = POSE_SLOTS.find((s) => s.id === slotId);
  if (!slot) return;

  revealImg.src = slot.src;
  revealImg.alt = slot.label;
  revealImg.classList.remove('hidden');
  revealEmptyState.classList.add('hidden');
  matchLabel.textContent = slot.label;

  refreshAllSlotStatuses();
  triggerFlash();
}

function showEmptyReveal() {
  revealImg.classList.add('hidden');
  revealEmptyState.classList.remove('hidden');
  matchLabel.textContent = ' ';
  refreshAllSlotStatuses();
}

function triggerFlash() {
  matchFlash.classList.remove('flash-active');
  // eslint-disable-next-line no-unused-expressions
  void matchFlash.offsetWidth; // restart CSS animation
  matchFlash.classList.add('flash-active');
}

function updateMatchMeter(score, slotId) {
  const pct = Math.max(0, Math.min(1, score)) * 100;
  matchMeterFill.style.width = `${pct}%`;
  matchMeterFill.classList.toggle('meter-hot', !!slotId && score >= THRESHOLD);
}

// ---------------------------------------------------------------------------
// Skeleton overlay
// ---------------------------------------------------------------------------
function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawSkeleton(keypoints) {
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.fillStyle = '#FF5C8A';

  SKELETON_EDGES.forEach(([i, j]) => {
    const a = keypoints[i];
    const b = keypoints[j];
    if (a && b && a.score >= SCORE_THRESHOLD && b.score >= SCORE_THRESHOLD) {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  });

  keypoints.forEach((kp) => {
    if (kp.score >= SCORE_THRESHOLD) {
      ctx.beginPath();
      ctx.arc(kp.x, kp.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

skeletonToggle.addEventListener('change', () => {
  if (!skeletonToggle.checked) clearCanvas();
});

// ---------------------------------------------------------------------------
// Misc controls
// ---------------------------------------------------------------------------
thresholdInput.addEventListener('input', () => {
  THRESHOLD = parseFloat(thresholdInput.value);
  thresholdValue.textContent = THRESHOLD.toFixed(2);
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
async function init() {
  const bundled = await loadBundledPoses();
  // Bundled poses ship with the site (so visitors need zero calibration);
  // anything saved locally in this browser layers on top of that.
  calibrations = { ...bundled, ...loadCalibrations() };

  // Only default into setup mode when nothing has been calibrated at all —
  // i.e. this is the very first time anyone has set poses up for this site.
  setupMode = Object.keys(calibrations).length === 0;

  buildSlots();
  updateSetupModeVisibility();
  thresholdValue.textContent = THRESHOLD.toFixed(2);
}

init();
