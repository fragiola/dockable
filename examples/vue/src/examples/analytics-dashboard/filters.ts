import { type InjectionKey, inject, type Ref, ref } from "vue";
import { DEFAULT_FILTERS, type Filters } from "./data";

// The shared filters, provided by index.vue and read by every widget. A teleport (the panel, or a
// popout window) keeps the provide/inject chain of where it is declared.

export const FiltersKey: InjectionKey<Readonly<Ref<Filters>>> =
    Symbol("filters");

/** The filters of the enclosing dashboard. */
export function useFilters(): Readonly<Ref<Filters>> {
    return inject(FiltersKey, ref(DEFAULT_FILTERS));
}
