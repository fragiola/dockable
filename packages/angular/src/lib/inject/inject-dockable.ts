import { computed, type Signal } from "@angular/core";
import type {
    AnyTypes,
    DockableTypes,
    LayoutEngine,
    Model,
} from "@fragiola/dockable";
import {
    injectDockableContext,
    injectLayoutContext,
    typedEngine,
    typedModel,
} from "../context";

export interface InjectDockableResult<T extends DockableTypes = AnyTypes> {
    /**
     * the model of the enclosing `[dockableRoot]`: the layout's data and its rules. Change the
     * layout with `model().run("tab.close", { tabId })`, read it with `model().get`/`model().is`
     */
    model: Signal<Model<T>>;
    /**
     * the engine of the layout this code renders in (the main layout's, or a popout window's):
     * screen actions (`engine().run("popout", { nodeId })`) and view facts (`engine().get`)
     */
    engine: Signal<LayoutEngine<T>>;
    /** the id of the layout this code renders in: `"main"` or a window's id */
    layoutId: Signal<string>;
}

/**
 * The model, the engine and the layout of the enclosing `[dockableRoot]`, as signals. Pass the
 * model's registry as the type argument (`injectDockable<Types>()`); a child cannot infer it
 * through injection. Call it in an injection context (a constructor or a field initializer).
 */
export function injectDockable<
    T extends DockableTypes = AnyTypes,
>(): InjectDockableResult<T> {
    const context = injectDockableContext("injectDockable");
    const layout = injectLayoutContext("injectDockable");
    return {
        model: computed(() => typedModel<T>(context.model())),
        engine: computed(() => typedEngine<T>(layout.engine())),
        layoutId: layout.layoutId,
    };
}
