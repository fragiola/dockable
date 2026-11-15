import {
    Component,
    computed,
    effect,
    InjectionToken,
    inject,
    input,
    type OnInit,
    type Signal,
    signal,
    untracked,
} from "@angular/core";
import { injectDockable } from "@fragiola/dockable-angular";
import type { EChartsOption } from "echarts";
import { Badge } from "#/components/atoms/badge";
import { Chart } from "#/components/ui/chart";
import { TABLE } from "#/components/ui/table";
import {
    DEFAULT_FILTERS,
    type Filters,
    KPIS,
    kpiValue,
    METRICS,
    months,
    ORDERS,
    type Types,
    type WidgetTab,
} from "./data";
import * as styles from "./styles";

// The widgets a tab can hold, chosen by the tab's `component` and configured by its `data`.
// They read the shared filters by injection: a panel's content (in the layout, or moved into a
// popout window) keeps the injectors of where its template is declared.

/** The shared filters, provided by the dashboard. */
export const FILTERS = new InjectionToken<Signal<Filters>>("filters", {
    factory: () => signal(DEFAULT_FILTERS),
});

/**
 * A Fragiola chart. The Line/Bar choice is local state: pop the tab out to another window and
 * it is still there, since the content moves with its tab instead of being created again.
 */
@Component({
    selector: "example-analytics-chart-widget",
    imports: [Chart],
    host: { class: "contents" },
    template: `
        <div [class]="styles.chart">
            <div [class]="styles.chartHeader">
                <span [class]="styles.chartTotal">{{ totalText() }}</span>
                @for (name of names(); track name; let index = $index) {
                    <span [class]="styles.legendItem">
                        <span
                            aria-hidden="true"
                            [class]="styles.legendDot"
                            [style.background]="'var(--chart-' + (index + 1) + ')'"
                        ></span>
                        {{ name }}
                    </span>
                }
                <fieldset [class]="styles.segments">
                    <legend [class]="styles.segmentsLegend">Chart type</legend>
                    @for (value of KINDS; track value) {
                        <button
                            type="button"
                            [attr.aria-pressed]="kind() === value"
                            (click)="kind.set(value)"
                            [class]="styles.segment"
                        >{{ value === "line" ? "Line" : "Bar" }}</button>
                    }
                </fieldset>
            </div>
            <kit-chart [option]="option()" [class]="styles.chartCanvas" />
        </div>
    `,
})
export class ChartWidget implements OnInit {
    readonly tab = input.required<WidgetTab<"chart">>();
    protected readonly styles = styles;
    protected readonly KINDS = ["line", "bar"] as const;
    private readonly filters = inject(FILTERS);
    protected readonly kind = signal<"line" | "bar">("line");

    protected readonly data = computed(() =>
        METRICS[this.tab().data.metric](this.filters()),
    );
    protected readonly names = computed(() => Object.keys(this.data()));
    protected readonly option = computed<EChartsOption>(() => {
        const kind = this.kind();
        const filters = this.filters();
        const metric = this.tab().data.metric;
        return {
            grid: { left: 4, right: 8, top: 8, bottom: 4, containLabel: true },
            tooltip: { trigger: "axis" },
            xAxis: {
                type: "category",
                data: months(filters),
                boundaryGap: kind === "bar",
            },
            yAxis: { type: "value", splitNumber: 3 },
            series: Object.entries(this.data()).map(([name, values]) => ({
                name,
                type: kind,
                data: values,
                smooth: true,
                showSymbol: false,
                stack:
                    kind === "bar" && metric === "channels" ? "all" : undefined,
                barMaxWidth: 18,
            })),
        };
    });
    protected readonly totalText = computed(() => {
        const total =
            Object.values(this.data())[0]?.reduce((a, b) => a + b, 0) ?? 0;
        return `$${(total / 10).toFixed(1)}k`;
    });

    ngOnInit() {
        // the first choice comes from the tab's data; after that it is the widget's own
        this.kind.set(this.tab().data.kind ?? "line");
    }
}

/**
 * A KPI. It compares its value with a threshold and writes the result into its TAB's data
 * (the `tab.set-data` command), and the tab turns red: the tab follows its content.
 */
@Component({
    selector: "example-analytics-kpi-widget",
    imports: [Badge],
    host: { class: "contents" },
    template: `
        <div [attr.data-status]="status()" [class]="styles.kpi">
            <p [class]="styles.kpiTitle">{{ kpi().title }}</p>
            <p data-testid="kpi-value" [class]="styles.kpiValue(status())">{{ format(value()) }}</p>
            <div [class]="styles.kpiFooter">
                <span kitBadge variant="soft" [class]="styles.kpiBadge(status())">{{
                    status() === "alert" ? "Below target" : "On target"
                }}</span>
                <label [class]="styles.kpiThreshold">
                    Alert below
                    <!-- the value as an attribute: a render keeps what is being typed -->
                    <input
                        type="number"
                        [attr.value]="threshold()"
                        [attr.step]="kpi().unit === '$' ? 5 : 0.1"
                        (input)="onThreshold($event)"
                        [class]="styles.kpiInput"
                    />
                </label>
            </div>
        </div>
    `,
})
export class KpiWidget implements OnInit {
    readonly tab = input.required<WidgetTab<"kpi">>();
    protected readonly styles = styles;
    private readonly filters = inject(FILTERS);
    private readonly dockable = injectDockable<Types>();
    protected readonly kpi = computed(() => KPIS[this.tab().data.metric]);
    protected readonly threshold = signal(0);
    protected readonly value = computed(() =>
        kpiValue(this.tab().data.metric, this.filters()),
    );
    protected readonly status = computed(() =>
        this.value() < this.threshold() ? "alert" : "ok",
    );

    constructor() {
        effect(() => {
            const status = this.status();
            const tab = this.tab();
            if (tab.data.status !== status) {
                untracked(() =>
                    this.dockable.model().run("tab.set-data", {
                        tabId: tab.id,
                        data: { status },
                    }),
                );
            }
        });
    }

    ngOnInit() {
        this.threshold.set(this.kpi().threshold);
    }

    protected format(n: number) {
        const unit = this.kpi().unit;
        return unit === "$" ? `$${n.toFixed(0)}` : `${n.toFixed(1)}${unit}`;
    }

    protected onThreshold(event: Event) {
        this.threshold.set(Number((event.target as HTMLInputElement).value));
    }
}

/** A Fragiola table of the orders in the selected region. */
@Component({
    selector: "example-analytics-orders-widget",
    imports: [TABLE, Badge],
    host: { class: "contents" },
    template: `
        <div [class]="styles.orders">
            <kit-table>
                <thead kitTableHeader>
                    <tr kitTableRow>
                        <th kitTableHead>Order</th>
                        <th kitTableHead>Customer</th>
                        <th kitTableHead>Region</th>
                        <th kitTableHead>Status</th>
                        <th kitTableHead [class]="styles.amountHead">Amount</th>
                    </tr>
                </thead>
                <tbody kitTableBody>
                    @for (order of rows(); track order.id) {
                        <tr kitTableRow>
                            <td kitTableCell [class]="styles.orderId">{{ order.id }}</td>
                            <td kitTableCell>{{ order.customer }}</td>
                            <td kitTableCell>{{ order.region }}</td>
                            <td kitTableCell>
                                <span kitBadge [class]="styles.orderStatus[order.status]">{{ order.status }}</span>
                            </td>
                            <td kitTableCell [class]="styles.amount">{{ "$" + order.amount }}</td>
                        </tr>
                    }
                </tbody>
            </kit-table>
        </div>
    `,
})
export class OrdersWidget {
    protected readonly styles = styles;
    private readonly filters = inject(FILTERS);
    protected readonly rows = computed(() => {
        const filters = this.filters();
        return ORDERS.filter(
            (order) =>
                filters.region === "all" || order.region === filters.region,
        );
    });
}
