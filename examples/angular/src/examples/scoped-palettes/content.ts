import { Component, computed, input } from "@angular/core";
import { injectModelState, type TabOf } from "@fragiola/dockable-angular";
import { PanelBody } from "../_kit/card";
import { ChartPanel, KpiPanel } from "../_kit/charts";
import { LogPanel } from "../_kit/data";
import type { Types } from "./index";
import { paletteOf } from "./palettes";
import * as styles from "./styles";

/**
 * The panel's content in its tabset's palette. Panels live in a layer outside their tabset (the
 * panel layer), so they cannot inherit its palette: the content repeats it, read from the model.
 * (It goes on the content rather than on the `[dockablePanel]`: the panel keeps `palette-raised`,
 * which an added `palette-surface` cannot override, since the surface rules come first in the
 * stylesheet.)
 */
@Component({
    selector: "example-scoped-palettes-content",
    imports: [PanelBody, ChartPanel, KpiPanel, LogPanel],
    host: { class: "contents" },
    template: `
        <div [attr.data-palette]="palette()" [class]="styles.content(palette(), fill())">
            @let current = tab();
            @switch (current.component) {
                <!-- A chart derives its series from the palette: it is drawn again when that
                     changes (one item, tracked by the palette) -->
                @case ("chart") {
                    @for (key of [palette()]; track key) {
                        <kit-chart-panel [kind]="current.data.kind" [seed]="5" [class]="styles.chart" />
                    }
                }
                @case ("kpi") {
                    @for (key of [palette()]; track key) {
                        <kit-kpi-panel
                            [label]="current.label"
                            [seed]="current.data.seed"
                            [class]="styles.chart"
                        />
                    }
                }
                @case ("note") {
                    <kit-panel-body [title]="current.label">
                        <p>{{ current.data.text }}</p>
                    </kit-panel-body>
                }
                @case ("log") {
                    <kit-log-panel />
                }
            }
        </div>
    `,
})
export class ScopedContent {
    readonly tab = input.required<TabOf<Types>>();
    protected readonly styles = styles;
    protected readonly palette = injectModelState<Types, string>((_, model) =>
        paletteOf(model.get("node-parent-by", { nodeId: this.tab().id })),
    );
    // a chart or a KPI fills the panel; text and a log grow from it
    protected readonly fill = computed(
        () =>
            this.tab().component === "chart" || this.tab().component === "kpi",
    );
}
