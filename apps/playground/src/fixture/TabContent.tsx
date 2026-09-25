import type { TabNode } from "@fragiola/dockable";
import { useState } from "react";

/**
 * Tab content with observable state: the tab name, a counter and a text input. Moving the tab
 * must never reset them (the content is re-parented, not remounted).
 */
export function TabContent({ tab }: { tab: TabNode }) {
    const [count, setCount] = useState(0);
    return (
        <div data-testid="content">
            <p>{tab.getName()}</p>
            <button
                type="button"
                data-testid="counter"
                onClick={() => setCount((c) => c + 1)}
            >
                {`Count: ${count}`}
            </button>
            <input data-testid="input" aria-label={`${tab.getName()} notes`} />
        </div>
    );
}
