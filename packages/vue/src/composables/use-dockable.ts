import type {
    AnyTypes,
    DockableTypes,
    LayoutEngine,
    Model,
} from "@fragiola/dockable";
import {
    typedEngine,
    typedModel,
    useDockableContext,
    useLayoutContext,
} from "../context";

export interface UseDockableResult<T extends DockableTypes = AnyTypes> {
    /**
     * the model of the enclosing `Dockable.Root`: the layout's data and its rules. Change the layout
     * with `model.run("tab.close", { tabId: tab })`, read it with `model.get`/`model.is`
     */
    model: Model<T>;
    /**
     * the engine of the layout this component renders in (the main layout's, or a popout
     * window's): screen actions (`engine.run("popout", { nodeId: node })`) and view facts (`engine.get`)
     */
    engine: LayoutEngine<T>;
    /** the id of the layout this component renders in: `"main"` or a window's id */
    layoutId: string;
}

/**
 * The model, the engine and the layout of the enclosing `Dockable.Root`. Pass the model's registry
 * as the type argument (`useDockable<Types>()`); a child cannot infer it through injection. Call it
 * in `setup`: a new model remounts the root, so the values never change for a component.
 */
export function useDockable<
    T extends DockableTypes = AnyTypes,
>(): UseDockableResult<T> {
    const context = useDockableContext("useDockable");
    const layout = useLayoutContext("useDockable");
    return {
        model: typedModel<T>(context.model),
        engine: typedEngine<T>(layout.engine),
        layoutId: layout.layoutId,
    };
}
