// Vendored from the Fragiola UI registry (https://ui.fragiola.com/r/menu.json, source registry/families/menu.ts). Do not edit: re-run scripts/vendor-fragiola.ts.
// Family `menu` — the option list (item, selectableItem, label, separator,
// group, shortcut, sub-trigger, item-indicator).
// Origin: ~12 parts repeated across dropdown/context/menubar/select/combobox.
//
// Decisions in docs/architecture.md §2 (orthogonal families), style families
// (tv with zero variants), state normalization (highlighted), and palette
// (palette kills colour duplication).
//
// Drift resolved — recorded in the port report:
//  - gap-1.5 (dropdown/context/menubar/select) vs gap-2 (combobox)
//    → unified to gap-2
//  - data-disabled:opacity-50 (only menubar) → applied to ALL via base
//  - data-[variant=destructive]: 6 declarations + dark theme block →
//    palette passed via className (e.g. className="palette-danger"),
//    base uses highlighted:bg-palette-soft / text-palette-accent which
//    resolve against whichever palette is active — no tone variant
//  - focus:*:[svg]:text-accent-foreground (context) vs
//    not-data-[variant=destructive]:focus:**:text-accent-foreground (dropdown)
//    → eliminated: palette redefines tokens, inheritance does the rest
//  - text-muted-foreground (label/shortcut/separator) → text-palette-accent/85
//    (the settled secondary-text value — AGENTS.md §"Secondary text")
//  - bg-border (separator) → bg-palette-line
//  - item-indicator: some without flex/size-4 → standardized with all
//  - label: px-2 py-1.5 (combobox) vs px-1.5 py-1 (others) → px-1.5 py-1.5
//  - label: font-medium (dropdown/context) vs none (combobox/select)
//    → font-medium (distinguishes label from item)
//
// Zero variants: the `indicator` variant became two members — `item`
// (px-1.5) and `selectableItem` (pe-8 ps-1.5, space for the check on the
// end side). menuCheckboxItem and menuRadioItem produced an identical
// string and were merged into `selectableItem`. The sub-trigger extends
// `item` (no indicator) — there is no selectable sub-trigger.
//
// Namespace object: a single `menu` export with all members.

import { tv } from "tailwind-variants";

// item is the central member. selectableItem and subTrigger derive from it
// via extend.
const item = tv({
    base: `
        relative flex cursor-default items-center gap-2 rounded-md py-1.5 text-sm
        px-1.5 outline-none select-none
        text-palette-accent/85 highlighted:bg-palette-soft highlighted:text-palette-contrast
        data-disabled:pointer-events-none data-disabled:opacity-50
        data-inset:ps-7
        [&_svg:not([class*='size-'])]:size-4
        [&_svg]:pointer-events-none [&_svg]:shrink-0
    `,
});

// selectableItem = item with space for the indicator (check) on the end side.
// Used by CheckboxItem, RadioItem, select item and combobox item.
// The pe-8 is not a style variation — it is a consequence of having an
// indicator, which is exactly why it is a member and not a variant.
const selectableItem = tv({
    extend: item,
    base: "pe-8 ps-1.5",
});

const label = tv({
    base: "text-palette-accent/85 px-1.5 py-1.5 text-xs font-medium data-inset:ps-7",
});

const separator = tv({
    base: "bg-palette-line -mx-1.5 my-1.5 h-px",
});

// Shortcut: secondary text (text-palette-accent/85 — the settled value).
// The original's focus colour change (group-focus/{name}:text-accent-foreground)
// has no equivalent without a secondary token; it distinguishes itself by
// size and position instead.
const shortcut = tv({
    base: "text-palette-accent/85 ms-auto text-xs tracking-widest",
});

// Sub-trigger = item + "popup open" state (data-popup-open).
const subTrigger = tv({
    extend: item,
    base: "data-popup-open:bg-palette-soft data-popup-open:text-palette-contrast",
});

const itemIndicator = tv({
    base: "pointer-events-none absolute inset-e-2 flex size-4 items-center justify-center",
});

export const menu = {
    item,
    selectableItem,
    label,
    separator,
    shortcut,
    subTrigger,
    itemIndicator,
};
