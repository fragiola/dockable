"use client";

import {
    Component,
    type ComponentType,
    type ErrorInfo,
    lazy,
    type ReactNode,
    Suspense,
    useEffect,
    useState,
} from "react";
import { LOADERS } from "@/examples/loaders.generated";

// Examples are client-only (DD5): the engine measures the DOM, so a
// pre-rendered layout would have no geometry and flash on hydration. The
// stage renders nothing until it is mounted, then loads the example lazily.

const COMPONENTS = new Map<string, ComponentType>(
    Object.entries(LOADERS).map(([slug, load]) => [slug, lazy(load)]),
);

class ExampleErrorBoundary extends Component<
    { children: ReactNode },
    { error: Error | null }
> {
    state = { error: null as Error | null };

    static getDerivedStateFromError(error: Error) {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error(error, info.componentStack);
    }

    render() {
        if (this.state.error) {
            return (
                <div
                    role="alert"
                    className="palette-danger m-4 self-start rounded-md bg-palette-soft p-4 text-palette-accent"
                >
                    {`This example failed: ${this.state.error.message}`}
                </div>
            );
        }
        return this.props.children;
    }
}

export function ExampleStage({ slug }: { slug: string }) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const Example = COMPONENTS.get(slug);
    if (!mounted || !Example) {
        return null;
    }
    return (
        <ExampleErrorBoundary>
            <Suspense fallback={null}>
                <div
                    data-testid="example-root"
                    className="flex min-h-0 min-w-0 flex-col"
                >
                    <Example />
                </div>
            </Suspense>
        </ExampleErrorBoundary>
    );
}
