"use client";

import type { AnyTypes, DockableTypes, LayoutEngine } from "@fragiola/dockable";
import { useDockable } from "@fragiola/dockable-react";
import { useEffect } from "react";

/**
 * Hands the layout's engine to UI that lives outside `Dockable.Root`, for what only the engine
 * knows: whether popouts are supported, docking a window back (`engine.dockBack`), the document a
 * layout lives in. Changing the layout needs no bridge: run a command on the model you own
 * (`model.run("tab.select", { tab })`), from anywhere; it goes through the model's middleware like
 * every other change.
 *
 * `useDockable()` only works inside the root, so this component sits inside it (as a `DockLayout`
 * child) and reports the engine up. The engine changes when the root gets another model, so keep
 * it in state.
 */
export function EngineBridge<T extends DockableTypes = AnyTypes>({
    onEngine,
}: {
    onEngine: (engine: LayoutEngine<T> | null) => void;
}) {
    const { mainEngine } = useDockable<T>();
    useEffect(() => {
        onEngine(mainEngine);
        return () => onEngine(null);
    }, [mainEngine, onEngine]);
    return null;
}
