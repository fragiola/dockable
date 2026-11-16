import { computed, Directive, type Signal } from "@angular/core";
import {
    type DockableContext,
    injectDockableContext,
    injectLayoutContext,
} from "../context";
import { bindStructuralStyle, dataAttr, injectHost } from "../utils/helpers";
import { bindMeasurable } from "../utils/signals";
import { injectTabSetNode } from "./tabset.directive";

export interface TabSetContentState {
    /** the tabset has no tabs */
    empty: boolean;
}

/**
 * Marks the tabset's content area: `<div dockableTabSetContent>`, an element the engine
 * measures, over which the selected tab's panel is positioned. Nothing is rendered into it.
 */
@Directive({
    selector: "[dockableTabSetContent]",
    exportAs: "dockableTabSetContent",
    host: {
        "[attr.data-layout-path]": "data().path",
        "[attr.data-empty]": "data().empty",
    },
})
export class DockableTabSetContent {
    private readonly context: DockableContext = injectDockableContext(
        "[dockableTabSetContent]",
    );
    private readonly layout = injectLayoutContext("[dockableTabSetContent]");
    private readonly host = injectHost();
    private readonly tabset = injectTabSetNode("[dockableTabSetContent]");
    private readonly id = computed(() => this.tabset().id);

    /** what the content area shows as `data-*` */
    readonly state: Signal<TabSetContentState> = computed(() => ({
        empty: this.tabset().children.length === 0,
    }));

    protected readonly data = computed(() => {
        // the path moves with the layout (a tabset inserted before this one): read the revision
        this.context.revision();
        return {
            path: `${this.layout.engine().get("layout-path-by", { nodeId: this.id() })}/content`,
            empty: dataAttr(this.state().empty),
        };
    });

    constructor() {
        bindMeasurable(
            this.context,
            this.layout.engine,
            this.host,
            () => this.id(),
            "tabsetcontent",
        );
        bindStructuralStyle(this.host, () => ({
            flexGrow: 1,
            flexBasis: 0,
            minWidth: 0,
            minHeight: 0,
        }));
    }
}
