// Tab overflow: which tabs of a strip fit, and which go to an overflow menu. FlexLayout keeps every
// tab in a scrolling strip and lists the ones scrolled out of view (src/view/TabOverflowHook.tsx);
// Dockable hides the ones that do not fit instead (the VS Code behaviour), keeping the selected tab
// in the strip.

/** What {@link computeTabOverflow} needs, all sizes in px along the strip's axis. */
export interface TabOverflowInput {
    /** the space for the tabs: the strip's inner size, plus the trigger's space while it shows */
    available: number;
    /** each tab's natural size, in model order */
    sizes: readonly number[];
    /** the gap between two tabs */
    gap: number;
    /** the selected tab's index, or -1: it stays in the strip when anything is hidden */
    selectedIndex: number;
    /** the space the overflow trigger takes, reserved only when something is hidden */
    reserve: number;
}

/** The indices of the tabs that stay in the strip and of those that go to the menu, in model order. */
export interface TabOverflowResult {
    visible: number[];
    hidden: number[];
}

/** tolerance for sub-pixel rounding, so a strip that fits exactly does not flicker */
const EPSILON = 0.5;

function extent(sizes: readonly number[], indices: number[], gap: number) {
    let total = 0;
    for (const index of indices) {
        total += sizes[index] ?? 0;
    }
    return total + gap * Math.max(0, indices.length - 1);
}

/**
 * Splits a strip's tabs into the visible and the hidden ones. Every tab fits: all visible.
 * Otherwise the tabs fit from the start into `available - reserve`, stopping at the first that does
 * not fit; when the selected tab is not among them, tabs are taken off the end until it fits, and
 * it is shown in its place. The selected tab always shows, even alone in too small a strip; with
 * no selection, the first tab does.
 */
export function computeTabOverflow(
    input: TabOverflowInput,
): TabOverflowResult {
    const { available, sizes, gap, selectedIndex, reserve } = input;
    const all = sizes.map((_, index) => index);
    if (extent(sizes, all, gap) <= available + EPSILON) {
        return { visible: all, hidden: [] };
    }
    const space = available - reserve;
    const visible: number[] = [];
    for (const index of all) {
        if (extent(sizes, [...visible, index], gap) > space + EPSILON) {
            break;
        }
        visible.push(index);
    }
    const selected = selectedIndex >= 0 && selectedIndex < sizes.length;
    if (selected && !visible.includes(selectedIndex)) {
        while (
            visible.length > 0 &&
            extent(sizes, [...visible, selectedIndex], gap) > space + EPSILON
        ) {
            visible.pop();
        }
        visible.push(selectedIndex);
        visible.sort((a, b) => a - b);
    }
    // never an empty strip: with no selected tab (a closed border), the first tab stays, so the
    // tab list keeps a tab stop
    if (visible.length === 0 && sizes.length > 0) {
        visible.push(0);
    }
    return {
        visible,
        hidden: all.filter((index) => !visible.includes(index)),
    };
}
