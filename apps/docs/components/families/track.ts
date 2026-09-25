// Vendored from the Fragiola UI registry (https://ui.fragiola.com/r/track.json, source registry/families/track.ts). Do not edit: re-run scripts/vendor-fragiola.ts.
// Family `track` — a rail with a filled portion.
// Origin: slider and progress are both a rail (the track) with a filled
// range (the indicator). Slider adds a thumb and interaction; progress adds
// an indeterminate state. The rail and the fill are the two things they
// genuinely share — the rest lives in the components.
//
// Decisions in docs/architecture.md §2 (orthogonal families) and style
// families (tv with zero variants). Drift resolved — recorded in the port
// report:
//  - rail: `bg-palette-line` (stroke role), `rounded-full`, hairline height
//    on the cross axis. `--radius-full` and `bg-palette-line`/`bg-palette-base`
//    are the role choices; no colour literal.
//  - fill: `bg-palette-base` (the palette's colour), `rounded-full`. The
//    primitive sets the geometry inline — `inset-inline-start` + `width` for
//    the horizontal case, `bottom` + `height` for the vertical case — so the
//    fill member carries only the visual treatment, not the positioning.
//    `absolute` is safe here: the slider primitive sets `position` inline
//    (relative for horizontal, absolute for vertical), overriding the class
//    for the slider; progress does not set position, so the class applies.
//
// Zero variants. Orientation is `data-orientation` from the primitive (slider
// emits it on every part; progress is horizontal in practice and does not,
// so the rail's height is the default `h-1.5` and the vertical overrides only
// fire for the slider). A variant would be wrong: orientation is behaviour
// from the primitive, not a style axis.
//
// Why `inset-block-0` is NOT on `fill`: the slider's vertical indicator is
// anchored from `bottom` (set inline by the primitive). A `top: 0` from the
// family would over-constrain the box and silently flip the fill to grow
// from the top — the dominant silent-failure mode this project guards
// against. Progress adds `inset-block-0` itself (pure layout); the slider
// needs none of it.
//
// Namespace object: a single `track` export with `rail` and `fill`.

import { tv } from "tailwind-variants";

// rail — the track. `w-full grow` so it fills a flex control (slider) and a
// block context (progress) alike. The cross-axis size is the hairline:
// `h-1.5` by default (horizontal / progress), `w-1.5 h-full` for vertical.
const rail = tv({
    base: `
        relative w-full grow rounded-full bg-palette-line
        h-1.5
        data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5
    `,
});

// fill — the indicator. Only the visual: the palette's colour and the
// rounded ends. Geometry comes from the primitive's inline styles. See the
// header for why `absolute` is safe and why no block-axis inset is here.
const fill = tv({
    base: "absolute rounded-full bg-palette-base",
});

export const track = { rail, fill };
