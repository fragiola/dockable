import { DockableLabel } from "@fragiola/dockable";

/**
 * The examples' accessible names, in English. The package has no text of its own: it resolves
 * the names it needs (today, the splitter's) through `getLabel` on `Dockable.Root`, and the
 * examples reuse the same map for their own buttons so every name lives in one place.
 */
export const labels: Partial<Record<DockableLabel, string>> = {
    [DockableLabel.Splitter]: "Resize",
    [DockableLabel.Close_Tab]: "Close",
    [DockableLabel.Close_Tabset]: "Close tabset",
    [DockableLabel.Pinned_Tab]: "Pinned",
    [DockableLabel.Rename_Tab]: "Rename",
    [DockableLabel.Active_Tabset]: "Active tabset",
    [DockableLabel.Maximize]: "Maximize",
    [DockableLabel.Restore]: "Restore",
    [DockableLabel.Popout_Tab]: "Pop out",
    [DockableLabel.Overflow_Menu_Tooltip]: "More tabs",
    [DockableLabel.Menu_Rename]: "Rename",
    [DockableLabel.Menu_Pin]: "Pin",
    [DockableLabel.Menu_Unpin]: "Unpin",
    [DockableLabel.Menu_Popout]: "Pop out",
    [DockableLabel.Menu_Maximize]: "Maximize tabset",
    [DockableLabel.Menu_Restore]: "Restore tabset",
    [DockableLabel.Menu_Close_All]: "Close all",
    [DockableLabel.Menu_Close_Right]: "Close to the right",
    [DockableLabel.Menu_Close_Others]: "Close others",
};

/** `getLabel` for `Dockable.Root`: the key's text, or `undefined` (no text) when unmapped. */
export function getLabel(key: DockableLabel): string | undefined {
    return labels[key];
}

/** The text for a key the examples always map. */
export function label(key: DockableLabel): string {
    return labels[key] ?? "";
}
