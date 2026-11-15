// Angular port of the Fragiola UI chart (examples/react/src/components/ui/chart.tsx): an ECharts
// wrapper that resolves the active theme's tokens and applies them to the chart's axes, series
// and tooltip. The same three steps: read the tokens scoped to its own element (a palette class on
// the chart re-derives the series colours), merge them into the option, render ECharts.
//
// What differs from the React one, and why: React's renders through `echarts-for-react`; this one
// calls plain `echarts` (`init` with the SVG renderer, `setOption` with `notMerge`/`lazyUpdate`,
// `resize`), and follows its size with a `ResizeObserver` from the element's own window, so a
// chart moved into a popout keeps resizing there. It reads the tokens once it is in a document (a
// panel's content joins the layout after its first render), and again after a theme change of its
// own document (`<html>` and `<body>` attributes, one frame later, once a popout window mirrored
// them), so the examples need no remount to follow the theme.
//
// Sizing: the wrapper is `w-full` only. ECharts reads its height from the parent, so the consumer
// gives the chart a height (`class="h-72"`).
//
//     <kit-chart [option]="option" class="h-72" />

import {
    afterNextRender,
    Component,
    computed,
    DestroyRef,
    ElementRef,
    effect,
    inject,
    input,
    signal,
    viewChild,
} from "@angular/core";
import type { EChartsOption } from "echarts";
import * as echarts from "echarts";
import { readThemeTokens, type ThemeTokens } from "#/hooks/theme-tokens";
import { cn } from "#/lib/cn";

@Component({
    selector: "kit-chart",
    host: {
        "data-slot": "chart",
        "[class]": "classes()",
    },
    template: `
        @if (merged()) {
            <div #canvas style="height: 100%; width: 100%"></div>
        }
    `,
})
export class Chart {
    readonly option = input.required<EChartsOption>();
    /** X-axis categories for the convenience shorthand. */
    readonly categories = input<string[]>();
    readonly class = input<string>();
    private readonly element: HTMLElement = inject(ElementRef).nativeElement;
    private readonly canvas = viewChild<ElementRef<HTMLElement>>("canvas");
    private readonly tokens = signal<ThemeTokens | null>(null);
    protected readonly classes = computed(() =>
        cn("block w-full", this.class()),
    );
    protected readonly merged = computed(() => {
        const tokens = this.tokens();
        return tokens
            ? mergeTheme(this.option(), tokens, {
                  categories: this.categories(),
              })
            : null;
    });
    private chart: echarts.ECharts | undefined;
    private resizeObserver: ResizeObserver | undefined;

    constructor() {
        const destroyRef = inject(DestroyRef);
        let frame = 0;
        let observer: MutationObserver | undefined;
        afterNextRender(() => {
            // Tokens live on the DOM: nothing to draw until they are read. Rendering with empty
            // colours is the silent failure this replaces (every series drawn in "").
            const start = () => {
                const view = this.element.ownerDocument.defaultView;
                if (!this.element.isConnected || !view) {
                    frame = requestAnimationFrame(start);
                    return;
                }
                this.tokens.set(readThemeTokens(this.element));
                observer?.disconnect();
                observer = new view.MutationObserver(() => {
                    view.cancelAnimationFrame(frame);
                    frame = view.requestAnimationFrame(() => {
                        // a chart moved to another window follows that window's theme
                        if (this.element.ownerDocument.defaultView !== view) {
                            start();
                        } else {
                            this.tokens.set(readThemeTokens(this.element));
                        }
                    });
                });
                const doc = this.element.ownerDocument;
                observer.observe(doc.documentElement, { attributes: true });
                observer.observe(doc.body, { attributes: true });
            };
            start();
        });
        effect(() => {
            const option = this.merged();
            const element = this.canvas()?.nativeElement;
            if (!option || !element) {
                this.dispose();
                return;
            }
            if (!this.chart) {
                this.chart = echarts.init(element, undefined, {
                    renderer: "svg",
                });
                const View = element.ownerDocument.defaultView?.ResizeObserver;
                if (View) {
                    this.resizeObserver = new View(() => this.chart?.resize());
                    this.resizeObserver.observe(element);
                }
            }
            this.chart.setOption(option, { notMerge: true, lazyUpdate: true });
        });
        destroyRef.onDestroy(() => {
            cancelAnimationFrame(frame);
            observer?.disconnect();
            this.dispose();
        });
    }

    private dispose() {
        this.resizeObserver?.disconnect();
        this.resizeObserver = undefined;
        this.chart?.dispose();
        this.chart = undefined;
    }
}

type Loose = Record<string, unknown>;

function asObject(value: unknown): Loose | undefined {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Loose)
        : undefined;
}

function mergeTheme(
    option: EChartsOption,
    tokens: ThemeTokens,
    shorthand: { categories?: string[] },
): EChartsOption {
    const { categorical, palette } = tokens;
    const { categories } = shorthand;

    // Series colours: one categorical slot per series, in order. A series
    // coloured per data item (pie, or `colorBy: "data"`) is left alone so
    // the top-level `color` palette applies slice by slice — a single
    // series colour would paint every slice the same.
    const rawSeries = option.series;
    const seriesList = (
        Array.isArray(rawSeries) ? rawSeries : rawSeries ? [rawSeries] : []
    ) as Loose[];
    const series = seriesList.map((s, i) =>
        s.color || s.type === "pie" || s.colorBy === "data"
            ? s
            : { ...s, color: categorical[i % categorical.length] },
    );

    const axisStyle = {
        axisLine: { lineStyle: { color: palette.line } },
        axisTick: { lineStyle: { color: palette.line } },
        axisLabel: { color: palette.accent },
        splitLine: { lineStyle: { color: palette.line } },
    };

    // Axes are injected only for cartesian charts. A pie has none, and
    // handing it a value axis draws an empty grid behind the donut.
    const isCartesian = Boolean(categories || option.xAxis || option.yAxis);
    const xAxis = isCartesian
        ? {
              type: "category",
              ...(categories ? { data: categories } : {}),
              ...axisStyle,
              ...asObject(option.xAxis),
          }
        : option.xAxis;
    const yAxis = isCartesian
        ? { type: "value", ...axisStyle, ...asObject(option.yAxis) }
        : option.yAxis;

    const title = asObject(option.title);
    const legend = asObject(option.legend);

    // Text roles: the chart draws on whatever floor it sits on, which is a
    // foreign background for the chart's own palette — so every label is
    // `accent`, never `contrast` (content on a base YOU painted; in a
    // chromatic scope that is white on white). The tooltip is a soft box:
    // soft + line + accent, the same trio as a soft badge.
    return {
        color: categorical,
        textStyle: { color: palette.accent },
        ...option,
        title: title && {
            ...title,
            textStyle: {
                color: palette.accent,
                fontWeight: 600,
                ...asObject(title.textStyle),
            },
        },
        legend: legend && {
            textStyle: { color: palette.accent },
            ...legend,
        },
        tooltip: {
            backgroundColor: palette.soft,
            borderColor: palette.line,
            textStyle: { color: palette.accent },
            ...asObject(option.tooltip),
        },
        xAxis,
        yAxis,
        series,
    } as EChartsOption;
}
