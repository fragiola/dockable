export declare const SOURCE_CONDITION = "@fragiola/source";
/**
 * Vite's default conditions (`defaultClientConditions` or `defaultServerConditions`) with the
 * source one first. Setting `conditions` replaces Vite's defaults, so they are kept here.
 */
export declare function withSourceCondition(defaults: readonly string[]): string[];
