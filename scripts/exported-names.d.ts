/**
 * The names in a specifier list `a, type B, c as d`: before `as` (`a`, `B`, `c`: what an import
 * takes from the module) or after it (`a`, `B`, `d`: what an export list exports).
 */
export declare function specifierNames(list: string, side: "before-as" | "after-as"): string[];
/**
 * Every name `source` exports: declarations (`export const/function/class/interface/type/enum`),
 * `export * as X`, and `export { … }` / `export type { … }` lists, with or without `from`.
 * `export * from` adds no name of its own and is left out.
 */
export declare function exportedNames(source: string): string[];
