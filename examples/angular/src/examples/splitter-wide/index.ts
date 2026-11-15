import { Component } from "@angular/core";
import {
    createModel,
    DOCKABLE,
    type LayoutJson,
} from "@fragiola/dockable-angular";
import { PanelBody } from "../_kit/card";
import { KpiPanel } from "../_kit/charts";
import * as styles from "./styles";

// A writing app's panes: the library's word count, the draft, its outline and the comments.
type Types = {
    tabs: {
        stats: { caption: string; seed: number };
        draft: { paragraphs: string[] };
        outline: { headings: string[] };
        comments: { comments: { author: string; text: string }[] };
    };
};

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 35,
                children: [
                    {
                        component: "stats",
                        label: "Library",
                        data: { caption: "Words written", seed: 13 },
                    },
                ],
            },
            {
                type: "row",
                weight: 65,
                children: [
                    {
                        type: "tabset",
                        weight: 60,
                        children: [
                            {
                                component: "draft",
                                label: "Draft",
                                data: {
                                    paragraphs: [
                                        "The harbour was quiet the morning the ferry did not come. Nobody said so at first; the gulls said it for them.",
                                        "By noon the café had run out of bread, and the conversation had moved from the weather to the mainland, and from the mainland to whoever had last seen the captain.",
                                    ],
                                },
                            },
                            {
                                component: "outline",
                                label: "Outline",
                                data: {
                                    headings: [
                                        "The missing ferry",
                                        "The café at noon",
                                        "The captain's house",
                                        "Night crossing",
                                    ],
                                },
                            },
                        ],
                    },
                    {
                        type: "tabset",
                        weight: 40,
                        children: [
                            {
                                component: "comments",
                                label: "Comments",
                                data: {
                                    comments: [
                                        {
                                            author: "Ada",
                                            text: "Lovely opening line.",
                                        },
                                        {
                                            author: "Grace",
                                            text: "Name the café?",
                                        },
                                        {
                                            author: "Alan",
                                            text: "The second paragraph could be split in two.",
                                        },
                                    ],
                                },
                            },
                        ],
                    },
                ],
            },
        ],
    },
};

@Component({
    selector: "example-splitter-wide",
    imports: [DOCKABLE, PanelBody, KpiPanel],
    host: { class: "contents" },
    template: `
        <div [class]="styles.frame">
            <div [dockableRoot]="model" [class]="styles.root">
                <!-- every splitter of every row is the wide splitter below -->
                <div dockableRow>
                    <ng-template [dockableRowChild]="model" let-node>
                        @if (node.type === "row") {
                            <div [dockableRow]="node"></div>
                        } @else {
                            <div [dockableTabSet]="node" [class]="styles.tabset">
                                <div [class]="styles.strip">
                                    <div dockableTabList aria-label="Tabs" [class]="styles.tabList">
                                        <ng-template [dockableTabListItem]="model" let-tab>
                                            <div [dockableTab]="tab" [class]="styles.tab">
                                                <span [class]="styles.tabName">{{ tab.label }}</span>
                                            </div>
                                        </ng-template>
                                    </div>
                                </div>
                                <div dockableTabSetContent></div>
                            </div>
                        }
                    </ng-template>
                    <!-- A wide splitter: the element is 12px thick, and the engine measures it, so the
                         panes leave that much room between them and the whole bar is a grab area.
                         Its \`aria()\` hands over the separator's values, \`valueText\` included:
                         while you drag or focus it, a bubble shows where the splitter sits in its
                         row. -->
                    <ng-template dockableRowSplitter let-node="node" let-index="index">
                        <div
                            [dockableSplitter]="node"
                            [index]="index"
                            #separator="dockableSplitter"
                            aria-label="Resize"
                            [class]="styles.splitter(separator.state())"
                        >
                            <span
                                aria-hidden="true"
                                data-testid="splitter-readout"
                                [class]="styles.splitterReadout"
                            >{{ separator.aria().valueText }}</span>
                        </div>
                    </ng-template>
                </div>
                <ng-template [dockablePanels]="model" let-tab>
                    <div [dockablePanel]="tab" [class]="styles.panel">
                        @switch (tab.component) {
                            @case ("stats") {
                                <kit-kpi-panel [label]="tab.data.caption" [seed]="tab.data.seed" />
                            }
                            @case ("draft") {
                                <kit-panel-body [title]="tab.label">
                                    @for (paragraph of tab.data.paragraphs; track paragraph) {
                                        <p [class]="styles.paragraph">{{ paragraph }}</p>
                                    }
                                </kit-panel-body>
                            }
                            @case ("outline") {
                                <kit-panel-body [title]="tab.label">
                                    <ol [class]="styles.outline">
                                        @for (heading of tab.data.headings; track heading) {
                                            <li>{{ heading }}</li>
                                        }
                                    </ol>
                                </kit-panel-body>
                            }
                            @case ("comments") {
                                <kit-panel-body [title]="tab.label">
                                    <ul [class]="styles.comments">
                                        @for (comment of tab.data.comments; track comment.text) {
                                            <li><span [class]="styles.commentAuthor">{{ comment.author }}</span> {{ comment.text }}</li>
                                        }
                                    </ul>
                                </kit-panel-body>
                            }
                        }
                    </div>
                </ng-template>
                <div
                    dockableDropIndicator
                    #indicator="dockableDropIndicator"
                    [class]="styles.dropIndicator(indicator.state())"
                ></div>
            </div>
        </div>
    `,
})
export default class SplitterWide {
    protected readonly styles = styles;
    protected readonly model = createModel<Types>(json);
}
