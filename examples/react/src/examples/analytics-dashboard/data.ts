import type { IJsonModel, IJsonTabNode } from "@fragiola/dockable";
import { series } from "../_kit/charts";

// The dashboard's data (deterministic, so every visit shows the same numbers), its filters,
// the widget catalogue behind "Add widget", and the initial layout.

export const REGIONS = ["EMEA", "Americas", "APAC"] as const;
export type Region = (typeof REGIONS)[number];

export interface Filters {
    region: Region | "all";
    months: 3 | 6 | 12;
}

export const DEFAULT_FILTERS: Filters = { region: "all", months: 6 };

const MONTHS = [
    "Oct",
    "Nov",
    "Dec",
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
];

export function months(filters: Filters): string[] {
    return MONTHS.slice(-filters.months);
}

function regions(filters: Filters): readonly Region[] {
    return filters.region === "all" ? REGIONS : [filters.region];
}

/** A monthly series for a region, summed over the regions the filters keep. */
function monthly(filters: Filters, seed: number, scale: number): number[] {
    const totals = new Array<number>(12).fill(0);
    for (const region of regions(filters)) {
        const values = series(seed + REGIONS.indexOf(region) * 17, 12, scale);
        values.forEach((value, index) => {
            totals[index] = (totals[index] ?? 0) + value + index * 4;
        });
    }
    return totals.slice(-filters.months);
}

export const METRICS = {
    revenue: (filters: Filters) => ({
        "This year": monthly(filters, 11, 120),
        "Last year": monthly(filters, 5, 100),
    }),
    channels: (filters: Filters) => ({
        Direct: monthly(filters, 3, 60),
        Search: monthly(filters, 23, 50),
        Social: monthly(filters, 41, 30),
    }),
} as const;

export type ChartMetric = keyof typeof METRICS;

/** The KPIs: a value per region and range, and the threshold that raises an alert. */
export const KPIS = {
    conversion: {
        title: "Conversion rate",
        unit: "%",
        // APAC converts poorly: filtering on it crosses the default threshold
        base: { EMEA: 3.8, Americas: 3.4, APAC: 1.9 } as Record<Region, number>,
        threshold: 2.5,
    },
    aov: {
        title: "Average order",
        unit: "$",
        base: { EMEA: 84, Americas: 96, APAC: 71 } as Record<Region, number>,
        threshold: 60,
    },
} as const;

export type KpiMetric = keyof typeof KPIS;

export function kpiValue(metric: KpiMetric, filters: Filters): number {
    const picked = regions(filters).map((region) => KPIS[metric].base[region]);
    const average = picked.reduce((a, b) => a + b, 0) / picked.length;
    // a longer range smooths the value a little
    const drift =
        filters.months === 3 ? 0.94 : filters.months === 12 ? 1.03 : 1;
    return Math.round(average * drift * 10) / 10;
}

export interface Order {
    id: string;
    customer: string;
    region: Region;
    status: "Paid" | "Pending" | "Refunded";
    amount: number;
}

const CUSTOMERS = [
    "Ada Lovelace",
    "Grace Hopper",
    "Alan Turing",
    "Katherine Johnson",
    "Edsger Dijkstra",
    "Barbara Liskov",
    "Donald Knuth",
    "Margaret Hamilton",
    "Tim Berners-Lee",
    "Radia Perlman",
];

export const ORDERS: Order[] = CUSTOMERS.map((customer, index) => ({
    id: `#${1042 + index}`,
    customer,
    region: REGIONS[index % 3] ?? "EMEA",
    status: index % 4 === 1 ? "Pending" : index % 7 === 3 ? "Refunded" : "Paid",
    amount: series(index + 3, 1, 900)[0] ?? 0,
}));

// ── Widgets ─────────────────────────────────────────────────────────────────

/** Every widget "Add widget" can create: the tab's component and config. */
export const WIDGETS: { label: string; tab: IJsonTabNode }[] = [
    {
        label: "Revenue chart",
        tab: {
            name: "Revenue",
            component: "chart",
            config: { metric: "revenue" },
        },
    },
    {
        label: "Channels chart",
        tab: {
            name: "Channels",
            component: "chart",
            config: { metric: "channels" },
        },
    },
    { label: "Orders table", tab: { name: "Orders", component: "table" } },
    {
        label: "Conversion KPI",
        tab: {
            name: "Conversion",
            component: "kpi",
            config: { metric: "conversion" },
        },
    },
    {
        label: "Average order KPI",
        tab: {
            name: "Avg. order",
            component: "kpi",
            config: { metric: "aov" },
        },
    },
];

export const layout: IJsonModel = {
    global: { tabEnablePopout: true, tabEnableRename: false },
    borders: [],
    layout: {
        type: "row",
        children: [
            {
                type: "row",
                weight: 62,
                children: [
                    {
                        type: "tabset",
                        weight: 58,
                        children: [
                            { type: "tab", id: "revenue", ...WIDGETS[0]?.tab },
                            { type: "tab", id: "channels", ...WIDGETS[1]?.tab },
                        ],
                    },
                    {
                        type: "tabset",
                        weight: 42,
                        children: [
                            { type: "tab", id: "orders", ...WIDGETS[2]?.tab },
                        ],
                    },
                ],
            },
            {
                type: "row",
                weight: 38,
                children: [
                    {
                        type: "tabset",
                        weight: 50,
                        children: [
                            {
                                type: "tab",
                                id: "conversion",
                                ...WIDGETS[3]?.tab,
                            },
                            { type: "tab", id: "aov", ...WIDGETS[4]?.tab },
                        ],
                    },
                    {
                        type: "tabset",
                        weight: 50,
                        children: [
                            {
                                type: "tab",
                                id: "mix",
                                name: "Channel mix",
                                component: "chart",
                                config: { metric: "channels", kind: "bar" },
                            },
                        ],
                    },
                ],
            },
        ],
    },
};
