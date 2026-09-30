import type { ExampleMeta } from "../meta-types";

export default {
    title: "Locked regions",
    description:
        "Stop drops into part of the layout: a model.use middleware vetoes tab.move, tabset.move and tab.add into a region its tabs do not belong to (a drag asks it with model.can, so a refused target shows no outline), and enableDrop, enableDrag and enableDivide lock a tabset.",
    level: "intermediate",
    order: 9,
    features: [
        "model.use",
        "veto",
        "model.can",
        "typed data",
        "enableDrop",
        "enableDrag",
        "enableDivide",
        "Tooltip",
    ],
    docs: "/docs/guides/restricting-drops",
} satisfies ExampleMeta;
