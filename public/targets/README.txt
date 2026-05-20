MindAR image targets
====================

This folder must contain `.mind` target files — one per kit — for image tracking.

Expected files (one per practical that has AR support):
  half-full-subtractor.mind   → Practical #8  (Half & Full Subtractor  DIC-118)
  rs-flipflop.mind            → Practical #9  (SR Flip-Flop            DIC-059)
  jk-flipflop.mind            → Practical #10 (JK Flip-Flop            DIC-060)
  ic741-amp.mind              → Practical #2 & #3 (IC 741 Amplifier)
  ic555-astable.mind          → Practical #5  (IC 555 Astable/Monostable)

How to generate a .mind file from a kit photo
----------------------------------------------
Use the MindAR online compiler:
  https://hiukim.github.io/mind-ar-js-doc/tools/compile/

Tips for a good image target:
  • Photograph the kit flat-on (camera parallel to the board surface).
  • Use bright, even lighting — avoid shadows and reflections.
  • Fill the frame with the kit, leaving a small border.
  • Use the same orientation as the photo in /public/kits/.
  • Resolution 640×480 or higher works best.

Steps:
  1) Upload the kit photo (the SAME image used in /public/kits/).
  2) Download the generated .mind file.
  3) Save it in this folder with the exact filename listed above.
  4) Reload the app — AR will start automatically when the file is detected.

Marker position calibration
-----------------------------
All marker positions are pre-calibrated in:
  src/xr/kitArConfigs.ts

If the bounding-box overlays appear slightly offset after you generate the
.mind file, adjust the x/y values in the corresponding config entry.
The coordinate system is:
  X: -0.5 (left edge of image) → +0.5 (right edge)
  Y: -(h/w)/2 (bottom)         → +(h/w)/2 (top)   where h/w = image aspect ratio

Example: for a component at pixel (320, 180) in a 640×480 image:
  X = (320 - 320) / 640 = 0.00
  Y = (240 - 180) / 640 = +0.094   (note: divide by WIDTH, then flip Y)
