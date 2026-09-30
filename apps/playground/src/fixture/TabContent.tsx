import type { TabOf } from "@fragiola/dockable";
import { useState } from "react";
import type { Types } from "./layouts";

/**
 * Tab content with observable state: the tab name, a counter and a text input. Moving the tab
 * must never reset them (the content is re-parented, not remounted).
 */
export function TabContent({ tab }: { tab: TabOf<Types> }) {
    const [count, setCount] = useState(0);
    return (
        <div data-testid="content">
            <p>{tab.data.name}</p>
            <button
                type="button"
                data-testid="counter"
                onClick={() => setCount((c) => c + 1)}
            >
                {`Count: ${count}`}
            </button>
            <input data-testid="input" aria-label={`${tab.data.name} notes`} />
        </div>
    );
}
