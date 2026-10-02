// Ported from FlexLayout (https://github.com/caplin/FlexLayout), src/view/layout/DragDropManager.tsx
// (what a drop does), with React, JSX and class names removed. Copyright (c) 2017 Caplin Systems
// Ltd. MIT licence, see LICENSE.
import type { PayloadOf } from "../commands/types";
import type { DropCandidate } from "../drop/resolve";
import type { LayoutEngine } from "../engine/LayoutEngine";
import type { TabInit } from "../state/json";
import type { Model } from "../state/model";
import type { AnyTypes } from "../state/types";
import { canTransfer, type TransferPlacement, transferPlan } from "./DragGroup";
import type { DragEventLike, DragState } from "./session";

/** A command a drop runs, as the manager prepares it. */
export type DropCommand =
    | { command: "tab.move"; payload: PayloadOf<AnyTypes, "tab.move"> }
    | { command: "tabset.move"; payload: PayloadOf<AnyTypes, "tabset.move"> }
    | { command: "tab.add"; payload: PayloadOf<AnyTypes, "tab.add"> }
    | {
          command: "transfer";
          payload: { tabId: string } & TransferPlacement;
      };

/**
 * The commands drops into one layout run: the command for a drop target, whether the model
 * accepts it, and running it.
 */
export class DropCommands {
    private readonly engine: LayoutEngine<AnyTypes>;
    /** the model's answers during the current drag, by candidate (the state does not change mid-drag) */
    private verdicts = new Map<string, boolean>();
    private verdictsFor: DragState | undefined;
    private verdictsState: unknown;
    private verdictsSourceState: unknown;

    constructor(engine: LayoutEngine<AnyTypes>) {
        this.engine = engine;
    }

    /** a drag that started in another model's layout (a drag group transfer) */
    fromOtherModel(state: DragState): boolean {
        return state.mainEngine.adapter.model !== this.engine.adapter.model;
    }

    /** the command a drop at `candidate` runs for the page's drag (none for a self drop) */
    commandFor(
        state: DragState,
        candidate: DropCandidate,
    ): DropCommand | undefined {
        if (candidate.self) {
            return undefined;
        }
        const placement = {
            to: candidate.target,
            location: candidate.location,
            index: candidate.index,
        };
        const subject = state.subject;
        if (subject.kind === "tabset") {
            return {
                command: "tabset.move",
                payload: { tabsetId: subject.tabset.id, ...placement },
            };
        }
        if (subject.kind === "new") {
            return {
                command: "tab.add",
                payload: { ...(subject.tab as TabInit), ...placement },
            };
        }
        return {
            command: this.fromOtherModel(state) ? "transfer" : "tab.move",
            payload: { tabId: subject.tab.id, ...placement },
        };
    }

    /** whether the model accepts a command (asked once per candidate during a drag) */
    accepts(state: DragState, command: DropCommand): boolean {
        // the subject is the drag's: within one drag and its models' states, the placement decides
        const model = this.engine.adapter.model;
        const source = state.mainEngine.adapter.model;
        if (
            this.verdictsFor !== state ||
            this.verdictsState !== model.state ||
            this.verdictsSourceState !== source.state
        ) {
            this.verdictsFor = state;
            this.verdictsState = model.state;
            this.verdictsSourceState = source.state;
            this.verdicts = new Map();
        }
        const { to, location, index } = command.payload;
        const key = `${command.command}|${to}|${location}|${index}`;
        let verdict = this.verdicts.get(key);
        if (verdict === undefined) {
            verdict = this.ask(source, command);
            this.verdicts.set(key, verdict);
        }
        return verdict;
    }

    private ask(source: Model<AnyTypes>, command: DropCommand): boolean {
        const model = this.engine.adapter.model;
        switch (command.command) {
            case "tab.move":
                return model.can("tab.move", command.payload);
            case "tabset.move":
                return model.can("tabset.move", command.payload);
            case "tab.add":
                return model.can("tab.add", command.payload);
            case "transfer": {
                const { tabId, ...placement } = command.payload;
                const plan = transferPlan(source, model, tabId, placement);
                return plan !== undefined && canTransfer(source, model, plan);
            }
        }
    }

    runDrop(state: DragState, target: DropCommand, event: DragEventLike) {
        const model = this.engine.adapter.model;
        switch (target.command) {
            case "transfer": {
                const { tabId, ...placement } = target.payload;
                this.engine.adapter
                    .getDragGroup()
                    ?.transferTab(
                        state.mainEngine,
                        this.engine,
                        tabId,
                        placement,
                    );
                return;
            }
            case "tab.add": {
                const result = model.run("tab.add", target.payload);
                state.onNewTabDropped?.(
                    result.ok ? result.value.tabId : undefined,
                    event,
                );
                return;
            }
            case "tabset.move":
                model.run("tabset.move", target.payload);
                return;
            case "tab.move":
                model.run("tab.move", target.payload);
        }
    }
}
