// Which framework an e2e run tests, and which of its examples a spec may open. Free of Playwright,
// so the unit tests check it (tests/e2e-available.test.ts).
//
// One suite for every framework: each app's playwright.config.ts (`examplesE2eConfig`) sets
// `EXAMPLES_FRAMEWORK`, and a spec that opens an example the framework does not have is skipped,
// not failed: a framework may ship a subset of the examples (contract §5).

import { FRAMEWORKS, type Framework, isFramework } from "../src/framework.ts";

/** The framework of `EXAMPLES_FRAMEWORK`; anything else throws (a config that forgot to set it). */
export function frameworkOf(value: string | undefined): Framework {
    if (!isFramework(value)) {
        throw new Error(
            `EXAMPLES_FRAMEWORK must be one of ${FRAMEWORKS.join(", ")} (got ${JSON.stringify(value)}): run the suite through an app's playwright.config.ts`,
        );
    }
    return value;
}

/** Where the e2e server mounts a framework's embed, as `site:export --base /dockable` does. */
export function embedBase(framework: Framework): string {
    return `/dockable/embed/${framework}/`;
}

/**
 * Why a test that needs `slugs` cannot run in `framework` (its app has none of some of them), or
 * nothing when it can.
 */
export function skipReason(
    framework: Framework,
    available: readonly string[],
    slugs: readonly string[],
): string | undefined {
    const missing = slugs.filter((slug) => !available.includes(slug));
    return missing.length === 0
        ? undefined
        : `${framework} has no ${missing.join(", ")} example`;
}
