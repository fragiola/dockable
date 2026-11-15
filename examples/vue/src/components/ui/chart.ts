// Vue port of the Fragiola UI chart (examples/react/src/components/ui/chart.tsx): an ECharts
// wrapper that resolves the active theme's tokens and applies them to the chart's axes, series
// and tooltip. The same three steps: read the tokens scoped to its own element (a palette class on
// the chart re-derives the series colours), merge them into the option, render ECharts.
//
// What differs from the React one, and why: React's renders through `echarts-for-react`; this one
// calls plain `echarts` (`init` with the SVG renderer, `setOption` with `notMerge`/`lazyUpdate`,
// `resize`), and follows its size with a `ResizeObserver` from the element's own window, so a
// chart moved into a popout keeps resizing there.
//
// Sizing: the wrapper is `w-full` only. ECharts reads its height from the parent, so the consumer
// gives the chart a height (`class="h-72"`).

import type { EChartsOption } from "echarts";
import * as echarts from "echarts";
import {
    computed,
    defineComponent,
    h,
    onUnmounted,
    type PropType,
    ref,
    watch,
} from "vue";
import { type ThemeTokens, useThemeTokens } from "#/hooks/use-theme-tokens";
import { cn } from "#/lib/cn";

export type ChartProps = {
    option: EChartsOption;
    /** X-axis categories for the convenience shorthand. */
    categories?: string[];
};

export const Chart = defineComponent({
    name: "FragiolaChart",
    inheritAttrs: false,
    props: {
        option: { type: Object as PropType<EChartsOption>, required: true },
        categories: {
            type: Array as PropType<string[]>,
            default: undefined,
        },
    },
    setup(props, { attrs }) {
        const scope = ref<HTMLElement | null>(null);
        const canvas = ref<HTMLElement | null>(null);
        const tokens = useThemeTokens(scope);
        const merged = computed(() =>
            tokens.value
                ? mergeTheme(props.option, tokens.value, {
                      categories: props.categories,
                  })
                : null,
        );

        let chart: echarts.ECharts | undefined;
        let observer: ResizeObserver | undefined;
        const dispose = () => {
            observer?.disconnect();
            observer = undefined;
            chart?.dispose();
            chart = undefined;
        };
        // Tokens live on the DOM: nothing to draw until they are read. Rendering with empty
        // colours is the silent failure this replaces (every series drawn in "").
        watch(
            [merged, canvas],
            ([option, element]) => {
                if (!option || !element) {
                    dispose();
                    return;
                }
                if (!chart) {
                    chart = echarts.init(element, undefined, {
                        renderer: "svg",
                    });
                    const View =
                        element.ownerDocument.defaultView?.ResizeObserver;
                    if (View) {
                        observer = new View(() => chart?.resize());
                        observer.observe(element);
                    }
                }
                chart.setOption(option, { notMerge: true, lazyUpdate: true });
            },
            { flush: "post" },
        );
        onUnmounted(dispose);

        return () =>
            h(
                "div",
                {
                    ref: scope,
                    "data-slot": "chart",
                    ...attrs,
                    class: cn("w-full", attrs.class as string),
                },
                merged.value
                    ? [
                          h("div", {
                              ref: canvas,
                              style: { height: "100%", width: "100%" },
                          }),
                      ]
                    : [],
            );
    },
});

type Loose = Record<string, unknown>;

function asObject(value: unknown): Loose | undefined {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Loose)
        : undefined;
}

function mergeTheme(
    option: EChartsOption,
    tokens: ThemeTokens,
    shorthand: Pick<ChartProps, "categories">,
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
