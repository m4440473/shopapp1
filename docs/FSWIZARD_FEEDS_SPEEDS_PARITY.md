# FSWizard Feeds & Speeds Parity Check

Use this checklist to compare ShopApp's calculator against FSWizard for the current endmill parity pass.

## Setup
- Units: imperial / inch
- Tool family: `Solid End Mill`
- Tool material: `Carbide`
- Coating: `AlTiN`
- Material: `4140PH Alloy Steel 300 HB`
- Diameter: `0.5`
- Flutes: `4`
- Leave FSWizard speed/feed overrides at their default `100%`
- Leave stickout/flute length at the default values FSWizard fills in
- Leave `HSM` off
- Leave `Chip thinning` off unless you intentionally want to test a non-default toggle path

## Compare fields
Compare these four outputs between ShopApp and FSWizard:
- `SFM`
- `RPM`
- `IPT`
- `Feed`

Small rounding drift is fine. If the values differ by more than about `1%` to `2%`, treat it as a parity miss worth logging.

## Manual cases

### Case 1 - Baseline side-milling cut
- DOC: `0.25`
- WOC: `0.10`
- Expected ShopApp result:
  - SFM: `340.16`
  - RPM: `2599`
  - IPT: `0.0034`
  - Feed: `35.39`

### Case 2 - Same DOC, heavier radial engagement
- DOC: `0.25`
- WOC: `0.25`
- Expected ShopApp result:
  - SFM: `320.72`
  - RPM: `2450`
  - IPT: `0.0032`
  - Feed: `31.46`

### Case 3 - Same WOC, shallower DOC
- DOC: `0.10`
- WOC: `0.10`
- Expected ShopApp result:
  - SFM: `340.16`
  - RPM: `2599`
  - IPT: `0.0034`
  - Feed: `35.39`

## What these cases are meant to catch
- Case 1 confirms the baseline 4140 carbide endmill recommendation stays in the expected range.
- Case 2 checks that heavier WOC pulls both SFM and feed down instead of leaving the result flat.
- Case 3 checks the current capped-load branch behavior; with the present FSWizard logic path, this shallower DOC lands on the same recommendation as Case 1.

## Repo-side regression coverage
- Automated parity coverage lives in `src/modules/feeds-speeds/__tests__/feeds-speeds.test.ts`.
- Snapshot baselines for the cases above live in `src/modules/feeds-speeds/__tests__/__snapshots__/feeds-speeds.test.ts.snap`.
