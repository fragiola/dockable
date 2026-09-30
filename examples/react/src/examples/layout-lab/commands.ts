import { type Action, Actions, type IJsonModel } from "@fragiola/dockable";

// The lab's starting layout, and the action types the veto switch can stop.

export const initialLayout: IJsonModel = {
    global: { tabEnableRename: false },
    borders: [],
    layout: {
        // explicit ids keep the JSON readable (the model generates one for any node without)
        type: "row",
        id: "root",
        children: [
            {
                type: "tabset",
                id: "main",
                weight: 55,
                children: [
                    {
                        type: "tab",
                        id: "welcome",
                        name: "Welcome",
                        component: "card",
                    },
                    {
                        type: "tab",
                        id: "notes",
                        name: "Notes",
                        component: "card",
                    },
                ],
            },
            {
                type: "row",
                id: "side",
                weight: 45,
                children: [
                    {
                        type: "tabset",
                        id: "top",
                        children: [
                            {
                                type: "tab",
                                id: "inspector",
                                name: "Inspector",
                                component: "card",
                            },
                        ],
                    },
                    {
                        type: "tabset",
                        id: "bottom",
                        children: [
                            {
                                type: "tab",
                                id: "console",
                                name: "Console",
                                component: "card",
                            },
                        ],
                    },
                ],
            },
        ],
    },
};

/** `FlexLayout_SelectTab` → `selectTab`: the name of the `Actions.x` factory. */
export function actionName(type: string): string {
    const name = type.replace(/^FlexLayout_/, "");
    return name.charAt(0).toLowerCase() + name.slice(1);
}

/** The action types a user can trigger from this layout, named as their factories. */
export const ACTION_TYPES = [
    Actions.SELECT_TAB,
    Actions.MOVE_NODE,
    Actions.ADD_TAB,
    Actions.DELETE_TAB,
    Actions.ADJUST_WEIGHTS,
    Actions.MAXIMIZE_TOGGLE,
].map((type) => ({ value: type, label: actionName(type) }));

export interface LogEntry {
    id: number;
    type: string;
    payload: string;
    vetoed: boolean;
    /** part of a drag still in progress */
    adjusting: boolean;
}

let nextId = 0;

/** Adds an action to the log. A drag (a stream of "adjusting" actions) is one line. */
export function appendToLog(
    log: LogEntry[],
    action: Action,
    vetoed: boolean,
): LogEntry[] {
    const entry = {
        id: ++nextId,
        type: action.type,
        payload: JSON.stringify(action.data),
        vetoed,
        adjusting: action.isAdjusting(),
    };
    const last = log[log.length - 1];
    if (last?.adjusting && last.type === action.type) {
        return [...log.slice(0, -1), entry];
    }
    return [...log, entry].slice(-100);
}
