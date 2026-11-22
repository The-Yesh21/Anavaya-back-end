# Live Courtroom facial observations: review and repair

Date: 2026-11-22. Scope: the Live Courtroom camera-analysis path and its saved/exported summaries. This is a source review and software regression record, not a clinical, forensic, or human-subject validation report.

## Outcome

The reported speech-to-stress behavior came from application heuristics layered over MediaPipe landmarks/blendshapes, not a trained Anavaya stress model. The interpretation layer has been rebuilt to report nine visible facial actions, completed bilateral blinks, approximate image-relative eye direction, and tracking availability. It explicitly abstains from internal stress/emotion, memory, deception, or credibility judgments. A raised brow, narrowed eye, or moving mouth is an observation, not a mental-state label.

No new emotion model was trained. No suitable labeled human-video training/evaluation corpus was identified in the reviewed runtime/training paths. Retraining the case-priority Decision Tree, legal LoRA adapters, or optional text classifier would not repair this camera feature. Perfect detection of all emotions or stress is not an achievable acceptance criterion for this implementation.

## Implemented architecture and source map

| Component | Responsibility |
| --- | --- |
| `case_priority_system/static/courtroom.html` | Judge-facing camera panel, observable-action bars, uncertainty text, loads the observation engine before the controller. |
| `case_priority_system/static/courtroom.js` | Selects local/remote video; loads MediaPipe; extracts pixel-aspect-corrected eye/mouth geometry; supplies audio/mouth-activity gate; renders observations and submits session summaries. |
| `case_priority_system/static/face-observations.js` | Pure stateful observation engine: reference calibration, independent blendshape actions, temporal persistence, blink hysteresis, quality abstention, duration accounting. No network or storage. |
| `case_priority_system/app.py`, `POST /api/court/rooms/{room_id}/face-summary` | Existing authenticated Judge-only persistence endpoint. Documentation updated; authorization behavior unchanged in this repair. |
| `case_priority_system/scripts/courtroom_manager.py` | Versioned summary storage and reload, transcript Markdown export. |
| `case_priority_system/scripts/face_observation_report.py` | Shared wording for new observations and explicit legacy-record uncertainty. |
| `case_priority_system/scripts/courtroom_deception.py` | Facial section of session Markdown/PDF reports. Documentary testimony checking is a separate path, not a facial-model output. |
| `public/dashboard/{courtroom.html,courtroom.js,face-observations.js}` | Static distribution copies of the three live assets; not a second model. |
| `case_priority_system/tests/face_observations.test.cjs` | Synthetic deterministic engine regressions. |
| `case_priority_system/tests/face_observations_browser.cjs` | Actual courtroom DOM/controller with intercepted backend, synthetic landmarks; optional real-model empty-frame smoke. |
| `case_priority_system/tests/test_face_observation_reports.py` | Temporary-directory persistence and report regressions, including legacy records. |
| `_courtroom_face_check.cjs` | Compatibility runner for isolated JS suites, replacing the old live-server mutation test. |

The runtime uses pretrained MediaPipe Tasks Vision `1.0.1` and Google's `face_landmarker/float16/1` task asset. These are externally downloaded browser dependencies. The [official Face Landmarker documentation](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker) describes landmarks and blendshape coefficients; they are not calibrated probabilities of emotional states. This repair keeps that pretrained model and changes what the application does with its outputs.

The root React/TanStack landing page is separate from this vanilla-JS courtroom. The legal training pipeline (`scripts/train_model.py` and `models/priority_classifier.pkl` under `case_priority_system`) trains case priority from legal features; its evaluation metrics do not measure facial-expression, blink, stress, or gaze accuracy. The `priority_dl_model.pth` and legal LoRA directories are not loaded by this browser camera path. Generated presentations, demonstrations, old reports and nested legacy code are not training evidence for this feature.

## Confirmed defects and repairs

Severity describes impact within this prototype, not a standardized security score. Evidence refers to the replaced implementation in Git history and the current functions named below.

| Severity | Finding | Repair / evidence |
| --- | --- | --- |
| High | `classifyEmotions` mixed hand-weighted geometry/blendshapes and stress into apparent emotion percentages. Neutral confidence floors and normalization looked like validated model confidence. | Removed classification and normalized emotion distribution. `Engine.update` reports independent action strengths; `renderFaceLive` shows tracking status and explicitly says strengths are not probabilities. |
| High | Normal articulation changed mouth/brow measurements; low-variance baseline deviations, top-three tension weighting, and an additive `min(28, activeCues.size * 9)` bonus inflated nervousness. | Removed the stress computation and psychological cue interpretation. Audio or visible aperture variation withholds mouth-dependent actions, including lip press/frown, instead of scoring them as distress. |
| High | Image-relative gaze was interpreted as recall/construction/deception. | Only approximate left/right-of-reference direction is shown, with no testimony or memory interpretation. |
| High | Markdown/PDF exports described camera heuristics as physiological stress, emotional confidence, and calmness. | New version-2 records contain usable tracking, articulation time, blink count, and sustained-action durations. Legacy records are identified as unvalidated; legacy mental-state indices/cues are not relabeled as current facial observations. Existing stored records are not rewritten. |
| Medium | Missing/stale/multiple-face frames could leave old readings on screen. | Require one usable face; clear metrics/cues/overlay on loss, errors or frozen video; reject repeated frames; reset calibration after a gap longer than two seconds. Stop an active observation before a departed selected participant falls back to the self camera. |
| Medium | Closure onset, winks, prolonged closure, sample-count timing, and overlapping cue sums could distort blink/duration readings. | Count completed bilateral closure/reopening with hysteresis, 60–600 ms bounds and 200 ms refractory interval; use elapsed-time filters/totals and union-of-active-action time. Blink rate waits for ten seconds of observed frames. |
| Medium | Geometry mixed image proportions/depth and used incorrect inner-brow indices. | Eye/mouth geometry uses 2D distances with video aspect correction; brow overlay uses 107/336 and 70/300. Unused emotion geometry was removed. |
| Medium | GPU initialization timeout could leak a late-created model, and rejected initialization/script promises prevented retries. | Close late timeout results; clear rejected promises; bounded GPU and CPU initialization. One inference per changed video frame, at most approximately 20 Hz. |
| Medium | Old facial check created a live courtroom and treated fabricated landmarks and assumed stress markers as validation. | Replaced with isolated deterministic fixtures and a browser test with all backend calls intercepted. No invented human-model accuracy score. |
| Low | Dead scoring accumulators and rounded-down fractional activity durations obscured the new data meaning. | Removed old score/speaking accumulators; preserve fractional speaking/action durations; updated summary comments and test guidance. |

## Current measurement contract

- Nine independently displayed actions: lip corners raised/lowered, brows raised/lowered, eyes widened/narrowed, nose wrinkled, lips pressed, mouth open. Multiple actions can coexist; their strengths need not sum to 100. These are not exhaustive human expressions or Facial Action Coding System certification.
- Initial eye reference requires approximately two seconds and at least twenty usable, eyes-open, non-articulating samples. Speech can delay calibration. Samples need not be consecutive; long tracking loss resets the reference.
- Action coefficients are exponentially smoothed over approximately 180 ms. A coefficient at least 0.50 sustained for 350 ms activates a cue. These are explicit engineering defaults, not statistically fitted or validated thresholds.
- A 600 ms mouth-aperture history and audio RMS threshold form a conservative articulation gate with a 900 ms hold. It detects activity, not verified words/speech. Smiles, chewing, noise, silent speech, and small motion may trigger or evade it. Mouth actions are withheld while the gate is active; brow/eye actions remain observable and are never interpreted as stress.
- Blink logic prefers bilateral blendshape closure; EAR is a fallback. At approximately 20 Hz or on slower devices, short blinks can be missed. A blink rate is not a nervousness indicator. Available tracking time includes calibration; action totals begin after calibration.
- Geometry rejects malformed, tiny, severely asymmetric or out-of-frame key landmarks. This is a heuristic quality gate, not proof of frontal pose, unobstructed eyes or landmark accuracy. Glasses, lighting, eyelid differences, head motion and occlusion remain limitations.
- Gaze is an iris-position offset relative to the person's reference and image coordinates, not a screen-point gaze tracker. The self preview is mirrored; image-left/right refers to the underlying frame, not the person's anatomical left/right.
- Missing blendshape channels remain unavailable rather than becoming fabricated zero measurements. No face, multiple faces, video pauses and tracking errors abstain. A different person replacing the subject without a detectable interruption is not identified; this system performs no identity tracking.
- Version 2 preserves raw observational totals in existing room storage. Legacy dataclass fields remain for compatibility and should not be consumed as current stress values. Older free-text transcript entries and previously generated PDF files are not retroactively changed.

## Verification performed

All commands run from `F:\major_project`.

| Command/check | Result |
| --- | --- |
| `node --test case_priority_system/tests/face_observations.test.cjs` | 12 passing engine tests: calibration/speech, independent actions, blink transitions, loss/reacquisition, gaze wording, absent/partial channels, 10/20/30 FPS consistency, malformed geometry, reset, fully closed eyes, duplicate timestamps/frame gaps. |
| `node _courtroom_face_check.cjs` | Runs the 12 engine tests plus the intercepted browser regression. |
| Browser regression | Pass: real controller/DOM, aspect correction, ordinary articulation gate, mouth-action suppression, brow action, no stress inference, multiple/missing-face clearing, no page errors. Chrome; no webcam or real participants. |
| `node case_priority_system/tests/face_observations_browser.cjs --model-smoke` | Pass: official JS/WASM/model loaded and actual inference on a gray canvas returned zero faces. Network opt-in; still no backend or human images. Does not establish facial-model accuracy. |
| `python -m unittest discover -s case_priority_system/tests -v` | 13 passing tests (10 existing + 3 new persistence/report tests). New storage tests use `TemporaryDirectory`. Existing inference tests load the saved priority model without retraining. A pre-existing `fitz` deprecation warning remains. |
| JavaScript syntax and Python AST checks | Pass for changed runtime/report/test sources. |
| External dependency availability | HEAD requests returned HTTP 200 for the pinned bundle, WASM and task model; model content length 3,758,596 bytes. Availability today does not guarantee offline operation or future CDN uptime. |
| Static asset copies | The three changed public assets match their live source files. Full export/build was not run because it also regenerates case exports and unrelated landing files are being edited concurrently. |

No live case records, production room records, training datasets or model weights were modified. No retraining or deployment was performed. The fixes and review notes were subsequently committed at the user's request. CodeRabbit was not run: authentication was deferred by the user in the preceding review request. Findings here are independent source review and local test results.

## What remains before any real-world accuracy claim

1. Assemble a consented, representative video benchmark with observable-action and blink event annotations. Include ordinary speech, quiet faces, smiles, yawns, chewing, glasses, head turns, varying skin tones/ages, camera resolutions, lighting, frame rates and network stalls. Include multiple-face and no-face negatives. Do not label ordinary articulation as stress.
2. Split by person and recording session before fitting thresholds or any model. Keep a held-out test set that is never used for calibration/tuning. Annotation disagreement and uncertain/unobservable frames must be retained, not forced into a class.
3. Measure per-action precision/recall and false activations during speech, blink-event matching/count error, unavailable-frame coverage, recovery delay, and runtime latency by device/subgroup. Eye-direction accuracy needs a known visual-target protocol. Publish denominators, uncertainty and failure examples rather than one overall accuracy percentage.
4. If the research question truly concerns internal stress or emotion, establish an appropriate independently measured target and study design first. Facial appearance alone cannot supply its own ground truth. Keep such research separate from testimony evaluation; no camera score should establish lying, credibility, intent or memory.
5. Evaluate any proposed replacement model against this baseline on the held-out corpus before deployment. Training from scratch without representative labels and a validated target would produce another unsubstantiated score.

Coverage is substantial for this feature, not an assertion that every project file was audited. Read: active controller/panel, observation and media initialization flow, summary endpoint and persistence/export sections, related legal training entry points/model inventory, static synchronization script, old facial test and regression files. Not runtime-tested: live human webcam accuracy, remote WebRTC/network quality, multi-device participant switching, sustained performance, real lighting/occlusion behavior, server deployment, PDF engine rendering, or psychological validity. Model bytes and datasets were not exhaustively inspected. Other testimony/LLM labels, authentication architecture, case-priority evaluation, landing changes and broader project risks require their own review.
