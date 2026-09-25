import type { ExampleMeta } from "../meta-types";

export default {
    title: "Overflow to a select",
    description:
        "When the tabs no longer fit, the strip turns into a Fragiola Select listing them; when there is room again, the tabs come back. A ResizeObserver in the consumer does the measuring.",
    level: "intermediate",
    order: 2,
    features: ["Actions.selectTab", "TabList", "ResizeObserver", "Select"],
    docs: "/docs/guides/tab-overflow",
} satisfies ExampleMeta;
