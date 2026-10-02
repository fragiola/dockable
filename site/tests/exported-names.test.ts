import { describe, expect, it } from "vitest";
import { exportedNames, specifierNames } from "../../scripts/exported-names.ts";

// The React package's shadowing guard and the examples' kit guard read exported names with these.
describe("the exported names of a module", () => {
    it("reads declarations, namespaces and export lists", () => {
        const source = [
            "export const a = 1;",
            "export function b() {}",
            "export async function c() {}",
            "export class D {}",
            "export abstract class E {}",
            "export interface F {}",
            "export type G = string;",
            "export enum H {}",
            "export declare const I: number;",
            'export * as J from "./j";',
            'export { k, type L, m as N } from "./k";',
            "export type { O } from './o';",
            "export {\n    p,\n    type Q,\n};",
            'export * from "./all";',
            "const notExported = 1;",
        ].join("\n");
        expect(exportedNames(source).sort()).toEqual(
            [
                "a",
                "b",
                "c",
                "D",
                "E",
                "F",
                "G",
                "H",
                "I",
                "J",
                "k",
                "L",
                "N",
                "O",
                "p",
                "Q",
            ].sort(),
        );
    });

    it("reads a specifier list on either side of `as`", () => {
        expect(specifierNames("a, type B, c as d", "before-as")).toEqual([
            "a",
            "B",
            "c",
        ]);
        expect(specifierNames("a, type B, c as d", "after-as")).toEqual([
            "a",
            "B",
            "d",
        ]);
    });
});
