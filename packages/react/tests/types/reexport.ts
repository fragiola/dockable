// Type fixtures, checked by `tsc` (not run): the React package re-exports the core's types, so an
// app imports them from `@fragiola/dockable-react` and gets the core's own, not look-alikes.
import type * as Core from "@fragiola/dockable";
import type { LayoutJson, Model, TabOf, TabsetNode } from "../../src";

type Equal<A, B> =
    (<V>() => V extends A ? 1 : 2) extends <V>() => V extends B ? 1 : 2
        ? true
        : false;

type Types = { tabs: { editor: { path: string } } };

export const sameTabsetNode: Equal<
    TabsetNode<Types>,
    Core.TabsetNode<Types>
> = true;
export const sameLayoutJson: Equal<
    LayoutJson<Types>,
    Core.LayoutJson<Types>
> = true;
export const sameModel: Equal<Model<Types>, Core.Model<Types>> = true;
export const sameTabOf: Equal<TabOf<Types>, Core.TabOf<Types>> = true;
