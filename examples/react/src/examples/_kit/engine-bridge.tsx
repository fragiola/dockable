"use client";

import type { LayoutEngine } from "@fragiola/dockable";
import { useDockable } from "@fragiola/dockable-react";
import { useEffect } from "react";

/**
 * Hands the layout's engine to UI that lives outside `Dockable.Root`: a file tree, a header of
 * filters, a toolbar. `useDockable()` only works inside the root, and the root exposes no engine
 * of its own, so this component sits inside it (as a `DockLayout` child) and reports the engine
 * up. Code outside then calls `engine.doAction(Actions.x)`, which goes through `onAction` like
 * every other change (calling `model.doAction` directly would skip it).
 *
 * The engine changes when the model does (an undo swap, a loaded layout), so keep it in state.
 */
export function EngineBridge({
    onEngine,
}: {
    onEngine: (engine: LayoutEngine | null) => void;
}) {
    const { mainEngine } = useDockable();
    useEffect(() => {
        onEngine(mainEngine);
        return () => onEngine(null);
    }, [mainEngine, onEngine]);
    return null;
}
