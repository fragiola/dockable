import { Component, computed, input } from "@angular/core";
import {
    type ComponentOf,
    DOCKABLE,
    injectDockable,
    injectModelState,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable-angular";
import {
    LucideChartLine,
    LucideDynamicIcon,
    LucideExternalLink,
    LucideGauge,
    type LucideIcon,
    LucideMaximize2,
    LucideMinimize2,
    LucidePanelTopClose,
    LucideSheet,
    LucideTriangleAlert,
    LucideX,
} from "@lucide/angular";
import type { Types } from "./data";
import * as styles from "./styles";

// How the dashboard decorates its tabsets: an icon per widget type, a red tab for a KPI below
// target, a close button, and maximize / pop out / dock back buttons in the header.

/** A KPI below its target: its tab takes the danger palette and a warning icon. */
export function isAlert(tab: TabOf<Types>) {
    return tab.component === "kpi" && tab.data.status === "alert";
}

const ICONS: Record<ComponentOf<Types>, LucideIcon> = {
    chart: LucideChartLine,
    table: LucideSheet,
    kpi: LucideGauge,
};

/** What goes inside each tab button: the widget's icon (or a warning), its name, a close button. */
@Component({
    selector: "example-analytics-tab-content",
    imports: [LucideDynamicIcon, LucideTriangleAlert, LucideX],
    host: { class: "contents" },
    template: `
        @if (alert()) {
            <!-- a named icon: an (empty) title keeps Lucide from hiding it (\`aria-hidden\`) -->
            <svg
                lucideTriangleAlert
                title=""
                role="img"
                aria-label="Below target"
                [class]="styles.tabIcon"
            ></svg>
        } @else {
            <svg [lucideIcon]="icon()" aria-hidden="true" [class]="styles.tabIcon"></svg>
        }
        <span [class]="styles.tabName">{{ tab().label }}</span>
        <!-- the tab is the tab stop: Ctrl+Delete on it closes it from the keyboard; the press must
             not activate the tabset, and a click on the tab would select it -->
        <button
            type="button"
            tabindex="-1"
            [attr.aria-label]="'Close ' + tab().label"
            [class]="styles.tabClose"
            (pointerdown)="$event.stopPropagation()"
            (click)="close($event)"
        >
            <svg lucideX aria-hidden="true" [class]="styles.tabCloseIcon"></svg>
        </button>
    `,
})
export class TabContent {
    readonly tab = input.required<TabOf<Types>>();
    protected readonly styles = styles;
    private readonly dockable = injectDockable<Types>();
    protected readonly alert = computed(() => isAlert(this.tab()));
    protected readonly icon = computed(() => ICONS[this.tab().component]);

    protected close(event: Event) {
        event.stopPropagation();
        this.dockable.model().run("tab.close", { tabId: this.tab().id });
    }
}

/** The tabset's header buttons: maximize, and pop out (or dock back when already popped out). */
@Component({
    selector: "example-analytics-tabset-buttons",
    imports: [
        DOCKABLE,
        LucideExternalLink,
        LucideMaximize2,
        LucideMinimize2,
        LucidePanelTopClose,
    ],
    host: { class: "contents" },
    template: `
        <!-- one trigger both ways: it pops the selected tab out, and in the window docks it back -->
        @if (header().selected; as selected) {
            <button
                dockablePopoutTrigger
                #trigger="dockablePopoutTrigger"
                [attr.aria-label]="
                    trigger.state()?.mode === 'dock'
                        ? 'Dock ' + selected + ' back'
                        : 'Pop out ' + selected
                "
                [attr.data-testid]="trigger.state()?.mode === 'dock' ? 'dock-back' : 'popout'"
                [class]="styles.button"
            >
                @if (trigger.state()?.mode === "dock") {
                    <svg lucidePanelTopClose aria-hidden="true" [class]="styles.dockBackIcon"></svg>
                } @else {
                    <svg lucideExternalLink aria-hidden="true" [class]="styles.buttonIcon"></svg>
                }
            </button>
        }
        @if (!header().inPopout) {
            <button
                type="button"
                [attr.aria-label]="header().maximized ? 'Restore' : 'Maximize'"
                [attr.aria-pressed]="header().maximized"
                data-testid="maximize"
                (click)="toggleMaximized()"
                [class]="styles.button"
            >
                @if (header().maximized) {
                    <svg lucideMinimize2 aria-hidden="true" [class]="styles.buttonIcon"></svg>
                } @else {
                    <svg lucideMaximize2 aria-hidden="true" [class]="styles.buttonIcon"></svg>
                }
            </button>
        }
    `,
})
export class TabSetButtons {
    readonly tabset = input.required<TabsetNode<Types>>();
    protected readonly styles = styles;
    // read from the model: the buttons sit outside the parts that re-render on a change
    protected readonly header = injectModelState<
        Types,
        { selected?: string; inPopout: boolean; maximized: boolean }
    >(
        (_state, model) => {
            const tabsetId = this.tabset().id;
            return {
                selected: model.get("selected-tab-by", { tabsetId })?.label,
                inPopout: model.is("node-in-window", { nodeId: tabsetId }),
                maximized: model.is("tabset-maximized", { tabsetId }),
            };
        },
        {
            isEqual: (a, b) =>
                a.selected === b.selected &&
                a.inPopout === b.inPopout &&
                a.maximized === b.maximized,
        },
    );
    private readonly dockable = injectDockable<Types>();

    protected toggleMaximized() {
        this.dockable.model().run("tabset.maximize", {
            tabsetId: this.tabset().id,
            value: !this.header().maximized,
        });
    }
}
