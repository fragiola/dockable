// Vendored from the Fragiola UI registry (https://ui.fragiola.com/r/layer.json, source registry/families/layer.ts). Do not edit: re-run scripts/vendor-fragiola.ts.
// Family `layer` — backdrop + panel (backdrop, panel, header, body, footer,
// title, description). Named in docs/architecture.md §2 and never written
// until this Epic. Shared by dialog, alert-dialog and drawer — three
// components with the same skeleton and three different behaviours.
//
// Decisions in docs/architecture.md §2 (orthogonal families), style families
// (tv, zero variants), §3 (composition: primitives, render, factories).
//
// ─── BACKDROP USES bg-scrim, NOT A PALETTE ROLE ─────────────────────────────
// `--color-scrim` is already declared in registry/styles/global.css,
// deliberately OUTSIDE the palette contract — a scrim is not a role, it is an
// absence of one. Do not invent a palette for it and do not add a seventh
// role. The backdrop is a pure scrim: fixed inset-0, the open/close fade, the
// stacking context. It carries NO layout — centring is done with transforms
// on the panel, not flexbox on the backdrop, so a nested overlay does not
// inherit a layout.
//
// ─── PANEL IS palette-raised ────────────────────────────────────────────────
// The same decision popup.content already made. layer.panel and popup.content
// are NOT the same string: a popup is positioned by a floating-ui positioner
// and sized by --available-height; a panel is not. The overlap (raised
// surface, border, radius, shadow) is checked, not assumed — and it is small
// enough that unifying them would couple a modal surface to a positioner it
// does not use. They stay separate.
//
// ─── title / description CARRY NO TYPOGRAPHY ────────────────────────────────
// They declare palette and state and nothing else, exactly as field.label and
// field.description already do. The typography arrives from Text through
// `render` (Dialog.Title is Text.Heading as="h2" wearing the primitive's
// a11y wiring). This is the rule that keeps seventeen title classes from
// coming back.
//
// ─── footer ALIGNS ON THE INLINE AXIS ───────────────────────────────────────
// `justify-end` with logical padding, so the action pair flips correctly
// under RTL.
//
// ─── ZERO VARIANTS ──────────────────────────────────────────────────────────
// Positioning is not a variant. A centred dialog and an edge-anchored drawer
// share `panel` (the surface) and add their own positioning in the component
// — the drawer's Viewport + transform stays in the drawer, not here. A
// variant for "centred vs edge" would be two components needing different
// values where only one is right (the surface is the same); unify.

import { tv } from "tailwind-variants";

// ─── TRANSITIONS, NOT KEYFRAMES ─────────────────────────────────────────────
// data-starting-style / data-ending-style are Base UI's TRANSITION markers:
// the element mounts with `data-starting-style`, the attribute is removed on
// the next frame, and a CSS `transition` interpolates from the starting
// values to the resting ones. `data-ending-style` is the mirror on close;
// Base UI keeps the element mounted until the transition ends.
//
// Pairing those markers with tw-animate-css keyframes (`animate-in`) was the
// bug behind every "abrupt" overlay: the keyframe class was gated on an
// attribute that lives for ONE frame, so the animation was cancelled as soon
// as it started. Keyframes are the right tool where the state persists
// (`data-open` in popup.content); for starting/ending markers it is always
// a transition. Duration and easing are declared here so every member of
// the family shares one tempo; the component adds its own motion (the
// dialog scales, the drawer slides) on top of the family's fade.

// backdrop — the scrim. fixed inset-0, the open/close fade, the stacking
// context. No layout: a nested overlay must not inherit a flex container.
const backdrop = tv({
    base: `
        fixed inset-0 z-50 bg-scrim
        transition-opacity duration-300 ease-out motion-reduce:transition-none
        data-starting-style:opacity-0 data-ending-style:opacity-0
    `,
});

// panel — the surface. raised palette, border, radius, shadow, focus outline
// reset. The dialog centring transform and the drawer edge transform are
// added by the component, not here. `outline-none` resets the popup's focus
// ring so the dialog's own focus management (initialFocus) is visible only on
// the focused child.
const panel = tv({
    base: `
        palette-raised bg-palette-base text-palette-contrast
        rounded-lg border border-palette-line shadow-lg
        outline-none
        transition-[opacity,scale,translate,transform] duration-300 ease-out
        motion-reduce:transition-none
        data-starting-style:opacity-0 data-ending-style:opacity-0
    `,
});

// header — title + description block. The dialog/drawer primitives do not
// provide a header element; this is the layout that groups the two.
const header = tv({
    base: "flex flex-col gap-1.5 p-6",
});

// body — the scrollable middle. `overflow-y-auto` and a max height keep long
// content from pushing the footer off-screen; the header and footer stay
// pinned by being outside the body.
const body = tv({
    base: "flex flex-col gap-4 px-6 py-2 overflow-y-auto",
});

// footer — the action row. End-aligned on the inline axis (justify-end), so
// the action pair flips correctly under RTL. Logical padding.
const footer = tv({
    base: "flex flex-row justify-end gap-3 p-6",
});

// title — palette + state only; typography comes from Text.Heading through
// render. The same discipline as field.label.
const title = tv({
    base: "text-palette-contrast",
});

// description — palette + state only; typography comes from Text.Paragraph
// through render.
const description = tv({
    base: "text-palette-accent/85",
});

export const layer = {
    backdrop,
    panel,
    header,
    body,
    footer,
    title,
    description,
};
