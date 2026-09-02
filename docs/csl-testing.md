# CSL test guide

CSL uses one fixed pipeline: record 36 evenly timed frames, average three
overlapping 30-frame predictions, and allow conservative exact-word
confirmation from the static model.

KSL/CSL landmarks are placed on a steady 30-frame-per-second timeline. If the
browser processes fewer camera frames, intermediate landmarks are linearly
interpolated so a 30-frame capture takes about one second instead of two.

For each expected label, perform at least five attempts. Record the top result
as correct, wrong, or rejected. Also run at least 20 idle trials: relaxed hands,
ordinary hand movement, entering/leaving frame, and transitions between signs.
Idle trials evaluate false activations; they do not retrain or add an idle
class to the frozen CADT model.

Change only one setting between test rounds. CSL tuning is centralized in
`public/models/csl/cadt-word-v1/metadata.json`:

- `confidenceThreshold`: minimum averaged probability; higher rejects more.
- `confidenceMargin`: required gap between first and second place; higher is
  more conservative.
- `captureFrameCount`: frames collected after the countdown.
- `windowOffsetsFromEnd`: shifted 30-frame windows used for averaging.
- `staticAgreement.confidenceThreshold`: required static-model confidence.
- `staticAgreement.marginMultiplier`: how much exact-label agreement relaxes
  the temporal margin. It never changes the predicted label.

If rejection tuning is still necessary, change `confidenceThreshold` first and
then `confidenceMargin`. Do not tune against only one signer or one successful
attempt.

## Learn-page reference assets

The five GIF references and chart are under `public/images/csl/`. Static
reference photos are under `public/images/csl/reference/`. Only the approved `form_aa`,
`form_ab`, `form_ac`, `form_u`, `form_v`, and `form_x` photos are included.
Classes without an approved image are omitted from the Learn gallery. Deleting
an individual reference file also removes its card when the page loads. Tell
Codex either the displayed Khmer word or the `form_*.jpg` filename to remove
the file and update attribution records.
