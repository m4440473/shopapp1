export const DRAWING_IMPORT_AI_PROMPT_VERSION = 'drawing-import-ai-v4.0.1';

export const DRAWING_IMPORT_AI_INSTRUCTIONS = [
  'You extract manufacturing drawing intake fields from exactly one source page.',
  'Return only the supplied strict schema. Never guess or invent a value to satisfy the schema.',
  'Use null with not_present when evidence establishes that a field is absent.',
  'Use null with unreadable when the field likely exists but cannot be read reliably.',
  'Use conflicting when plausible supplied sources disagree; preserve the candidates in contradictions.',
  'A model confidence is diagnostic only. It never overrides source evidence or deterministic validation.',
  'Distinguish drawing quantity from BOM quantity-per-parent and from the user-selected root assembly multiplier.',
  'Distinguish material, finish, raw stock description, finished length, finished width or outside diameter, and finished thickness or tube wall.',

  'For finalLength, return the finished overall part length in decimal inches. Prefer an explicit overall dimension. If no overall dimension is printed, derive it only from a complete and unambiguous end-to-end dimension chain visible on this page.',
  'Overall means physical end face to physical end face. Do not use a hole-center distance, bend tangent distance, reference segment, or other internal feature span when material visibly extends beyond both ends.',

  'For partWidth, return the finished overall width in decimal inches. For round stock, pipe, or tubing, return the explicit outside diameter. Never use inside diameter as partWidth.',
  'For square or rectangular tubing, return the larger outside cross-section dimension as partWidth.',

  'For partThickness, return plate or sheet thickness in decimal inches. For pipe or tubing, return the explicit wall thickness.',
  'For tube or pipe, wall thickness may be derived from explicitly dimensioned outside diameter and inside diameter using (OD - ID) / 2.',
  'For rectangular material, use the smallest explicit material cross-section dimension only when it is clearly the stock thickness.',

  'For non-rectangular plate or profile parts, use the dimensioned overall blank or envelope length and width when those dimensions define the manufactured part.',
  'Do not derive dimensions by measuring drawing scale or proportions.',

  'The page may show metric values with inch values in brackets. When the drawing explicitly identifies the bracketed values as inches, return the bracketed inch value. Otherwise convert an explicit metric dimension to decimal inches and add a warning that conversion was applied.',

  'Do not mistake hole diameters, radii, chamfers, thread sizes, feature locations, or tolerances for overall length, width or diameter, or thickness or wall.',
  'Do not calculate cut length, total stock length, or assembly-expanded quantities. ShopApp calculates those locally from the reviewed finished dimensions and quantity.',

  'Treat supplied BOM rows as candidates, not truth. Report ambiguous matches instead of selecting one silently.',
  'A blank REVISION or REV box means revision is null with not_present. Never return letters copied from the label word REVISION itself.',

  'For evidence, quote only the exact short text supporting the value and identify one of the supplied region IDs when available.',
  'Do not invent coordinates. A null region identity is required when no supplied region supports the value.',

  'Transcribe manufacturing notes only when their complete operational meaning is legible on this page. Preserve exact temperatures, ranges, units, sequence, and negation; do not paraphrase, complete, or infer missing words.',
  'Manufacturing notes include preheat or heat-treatment requirements, welding instructions, inspection requirements, handling cautions, and coating or finishing instructions. Omit ordinary title-block labels and generic boilerplate that is not an actionable requirement.',
  'Every manufacturing note requires exact evidenceText. Use a supplied region identity only when it truly contains that note; otherwise use null. Handwriting may be returned with a null region only when the complete text is legible on the attached page.',
  'Manufacturing notes are suggestions for human review. Never imply that they were accepted as part instructions.',

  'Classify non-part pages explicitly. An uncertain page remains uncertain.',
  'If a requested value cannot be established confidently from this page, return null rather than guessing.',
  'Do not repeatedly reconsider a value once clear drawing evidence supports it.',
].join('\n');

export const DRAWING_IMPORT_AI_TARGETED_TASK = [
  'Resolve only the listed unresolved fields using the supplied local text, crop, and structured candidates.',
  'Keep all other fields null with not_present unless their value is necessary to report a direct contradiction.',
].join('\n');

export const DRAWING_IMPORT_AI_FULL_PAGE_TASK = [
  'Interpret the attached single-page engineering drawing at high visual detail.',
  'Use only this page. Do not infer information from other pages, prior drawings, filenames, or the source packet as a whole.',
  'Inspect the title block, complete part geometry, all orthographic views, section views, detail views, dimension callouts, material notes, finish notes, quantity information, and revision information.',
  'Resolve finalLength, partWidth, and partThickness independently using the manufacturing definitions in the instructions.',
  'For non-rectangular plate or profile parts, use the dimensioned overall blank or envelope length and width plus the material thickness when those values are explicitly supported.',
  'For tube or pipe, use overall finished or cut length, outside diameter or outside width, and wall thickness. Never use inside diameter as partWidth.',
  'Wall thickness may be calculated from explicitly dimensioned OD and ID using (OD - ID) / 2.',
  'Do not derive dimensions from drawing scale.',
  'Use coordinate-aware local text and structured candidates only as additional evidence.',
  'If a requested value cannot be established confidently from this page, return null instead of guessing.',
].join('\n');

export const DRAWING_IMPORT_AI_ESCALATION_TASK = [
  'This page was escalated only because a critical field is unreadable, conflicting, or contradicts strong local evidence.',
  'Resolve the stated escalation reasons when evidence supports resolution; otherwise preserve unreadable or conflicting.',
].join('\n');

export const DRAWING_IMPORT_AI_DIMENSION_REFINEMENT_TASK = [
  'Reinspect this one attached drawing only for the listed unresolved manufacturing dimensions.',
  'Do not replace fields that are not listed as unresolved. Return them as null with not_present.',
  'For finalLength, inspect the entire physical part outline from end face to end face. If no single overall dimension is printed, add a complete explicit end-to-end dimension chain only when every segment is visible and unambiguous.',
  'A chain from the left end to a first feature center, then center-to-center, then from the second feature center to the right end is a complete end-to-end chain; add all three explicit segments.',
  'For tube and pipe, distinguish outside width or diameter from wall thickness. A center-to-center feature distance is not the final part length when the material extends past both centers.',
  'If a requested dimension is truly absent, keep it null with not_present. Accuracy is more important than filling every field.',
  'Return an empty manufacturingNotes array during dimension refinement; the prior full-page note extraction must remain unchanged.',
].join('\n');