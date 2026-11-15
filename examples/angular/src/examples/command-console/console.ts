import { Component, effect, input, signal } from "@angular/core";
import type {
    AnyTypes,
    CommandResult,
    DockableTypes,
    Model,
} from "@fragiola/dockable-angular";
import * as styles from "./styles";
import { fieldsOf, fromToolCall, toolName, toTools } from "./tools";

// The console lives outside the layout and talks to the model only: `commands()` to list what it
// can do, `dispatch` to run a command given as JSON (validated like any untrusted input), and
// `subscribe` to log every change, whoever made it (the console, a drag, a click).

const SAMPLES = [
    {
        label: "Select",
        input: { command: "tab.select", payload: { tabId: "todo" } },
    },
    {
        label: "Move",
        input: { command: "tab.move", payload: { tabId: "ideas", to: "left" } },
    },
    {
        label: "Add",
        input: {
            command: "tab.add",
            payload: {
                component: "note",
                label: "Draft",
                data: { text: "Added from JSON." },
                to: "left",
            },
        },
    },
    {
        label: "Invalid",
        input: { command: "tab.move", payload: { tabId: 3 } },
    },
] as const;

type View = "console" | "commands" | "tools";

const VIEWS = [
    ["console", "Console"],
    ["commands", "Commands"],
    ["tools", "As AI tools"],
] as const;

interface LogEntry {
    id: number;
    command: string;
    payload: string;
    transient: boolean;
}

/** Ids for the labels, unique per console on the page. */
let instances = 0;

@Component({
    selector: "example-error-box",
    host: { class: "contents" },
    template: `
        <div role="alert" [class]="styles.error">
            <p>
                <span [class]="styles.errorCode">{{ code() }}</span>: {{ message() }}
                @if (path()) {
                    {{ " at " }}<code [class]="styles.code">{{ path() }}</code>
                }
            </p>
            @if (issues().length > 1) {
                <ul [class]="styles.errorIssues">
                    @for (issue of issues(); track issue.path + " " + issue.message) {
                        <li><code [class]="styles.code">{{ issue.path }}</code> {{ issue.message }}</li>
                    }
                </ul>
            }
        </div>
    `,
})
class ErrorBox {
    readonly code = input.required<string>();
    readonly message = input.required<string>();
    readonly path = input<string>();
    readonly issues = input<readonly { path: string; message: string }[]>([]);
    protected readonly styles = styles;
}

@Component({
    selector: "example-console-view",
    imports: [ErrorBox],
    host: { class: "contents" },
    template: `
        <div [class]="styles.consoleView">
            <div [class]="styles.samples">
                @for (sample of SAMPLES; track sample.label) {
                    <button type="button" (click)="pick(sample.input)" [class]="styles.sampleButton">
                        {{ sample.label }}
                    </button>
                }
            </div>
            <label [for]="inputId" [class]="styles.inputLabel">Command (JSON)</label>
            <textarea
                [id]="inputId"
                data-testid="command-input"
                [value]="input()"
                (input)="input.set($any($event.target).value)"
                spellcheck="false"
                rows="6"
                [class]="styles.input"
            ></textarea>
            <button type="button" (click)="run()" [class]="styles.runButton">Run</button>
            <output data-testid="result" aria-live="polite" [class]="styles.result">
                @if (parseError(); as error) {
                    <example-error-box code="parse" [message]="error" />
                } @else if (result(); as result) {
                    @if (result.ok) {
                        <div [class]="styles.success">
                            <p [class]="styles.successTitle">ok</p>
                            <pre [class]="styles.successValue">{{ json(result.value) }}</pre>
                        </div>
                    } @else {
                        <example-error-box
                            [code]="result.error.code"
                            [message]="result.error.message"
                            [path]="result.error.path"
                            [issues]="result.error.issues ?? []"
                        />
                    }
                }
            </output>
            <div>
                <h3 [class]="styles.logTitle">Log (model.subscribe)</h3>
                <ol data-testid="log" [class]="styles.log">
                    @for (entry of log(); track entry.id) {
                        <li [class]="styles.logEntry">
                            <span [class]="styles.logCommand">{{ entry.command }}</span>
                            {{ entry.transient ? "(transient) " : "" }}{{ entry.payload }}
                        </li>
                    }
                </ol>
            </div>
        </div>
    `,
})
class ConsoleView<T extends DockableTypes = AnyTypes> {
    readonly model = input.required<Model<T>>();
    /** every commit, from the console or from the layout itself */
    readonly log = input.required<readonly LogEntry[]>();
    protected readonly styles = styles;
    protected readonly SAMPLES = SAMPLES;
    protected readonly input = signal(
        JSON.stringify(SAMPLES[0].input, null, 2),
    );
    protected readonly result = signal<CommandResult<unknown> | null>(null);
    protected readonly parseError = signal<string | null>(null);
    protected readonly inputId = `command-console-${++instances}-input`;
    protected readonly json = (value: unknown) =>
        JSON.stringify(value, null, 2);

    protected pick(sample: unknown) {
        this.input.set(JSON.stringify(sample, null, 2));
    }

    protected run() {
        let parsed: unknown;
        try {
            parsed = JSON.parse(this.input());
        } catch (caught) {
            this.parseError.set(
                caught instanceof Error ? caught.message : String(caught),
            );
            this.result.set(null);
            return;
        }
        this.parseError.set(null);
        // untrusted JSON: dispatch validates the command name and the payload, and never throws
        this.result.set(this.model().dispatch(parsed));
    }
}

@Component({
    selector: "example-command-list",
    host: { class: "contents" },
    template: `
        <ul data-testid="command-list" [class]="styles.commandList">
            @for (command of model().get("commands"); track command.name) {
                <li [attr.data-command]="command.name" [class]="styles.command">
                    <p [class]="styles.commandName">
                        {{ command.name }}
                        @if (command.transient) {
                            <span [class]="styles.commandTransient">transient-capable</span>
                        }
                    </p>
                    <p [class]="styles.commandDescription">{{ command.description }}</p>
                    <dl [class]="styles.commandFields">
                        @for (field of fieldsOf(command.payloadSchema); track field.name) {
                            <div [class]="styles.commandField">
                                <dt [attr.title]="field.description">{{ field.name }}{{ field.required ? "" : "?" }}</dt>
                                <dd [class]="styles.commandFieldType">{{ field.type }}</dd>
                            </div>
                        }
                    </dl>
                </li>
            }
        </ul>
    `,
})
class CommandList<T extends DockableTypes = AnyTypes> {
    readonly model = input.required<Model<T>>();
    protected readonly styles = styles;
    protected readonly fieldsOf = fieldsOf;
}

@Component({
    selector: "example-tools-view",
    host: { class: "contents" },
    template: `
        <div [class]="styles.toolsView">
            <p [class]="styles.toolsIntro">
                Each command is a name, a description and a JSON Schema: any assistant that calls
                tools can drive the layout. Hand it these definitions; when it calls one, turn the
                call back into a command and pass it to
                <code [class]="styles.code">model.dispatch</code>, which validates it like any other
                untrusted JSON. No network call or SDK is involved here.
            </p>
            <pre data-testid="tool-call" [class]="styles.toolCall">{{ call() }}</pre>
            <pre data-testid="tool-definitions" [class]="styles.toolDefinitions">{{ definitions() }}</pre>
        </div>
    `,
})
class ToolsView<T extends DockableTypes = AnyTypes> {
    readonly model = input.required<Model<T>>();
    protected readonly styles = styles;
    protected readonly definitions = () =>
        JSON.stringify(toTools(this.model().get("commands")), null, 2);
    // what an assistant's call turns into: the command and its payload, for model.dispatch
    protected readonly call = () => {
        const example = fromToolCall(this.model().get("commands"), {
            name: toolName("tab.select"),
            input: { tab: "todo" },
        });
        return `${toolName("tab.select")}({ "tab": "todo" })\n→ model.dispatch(${JSON.stringify(example)})`;
    };
}

@Component({
    selector: "example-command-console",
    imports: [ConsoleView, CommandList, ToolsView],
    host: { class: "contents" },
    template: `
        <section aria-label="Command console" [class]="styles.commandConsole">
            <div [class]="styles.viewBar">
                @for (item of VIEWS; track item[0]) {
                    <button
                        type="button"
                        [attr.aria-pressed]="view() === item[0]"
                        (click)="view.set(item[0])"
                        [class]="styles.viewButton"
                    >{{ item[1] }}</button>
                }
            </div>
            <div [class]="styles.viewBody">
                @switch (view()) {
                    @case ("console") {
                        <example-console-view [model]="model()" [log]="log()" />
                    }
                    @case ("commands") {
                        <example-command-list [model]="model()" />
                    }
                    @default {
                        <example-tools-view [model]="model()" />
                    }
                }
            </div>
        </section>
    `,
})
export class CommandConsole<T extends DockableTypes = AnyTypes> {
    readonly model = input.required<Model<T>>();
    protected readonly styles = styles;
    protected readonly VIEWS = VIEWS;
    protected readonly view = signal<View>("console");
    /** Every commit, newest first: a gesture's transient steps and its last command are one line. */
    protected readonly log = signal<LogEntry[]>([]);

    constructor() {
        // the log lives here, so it keeps every change while the other views are shown
        effect((onCleanup) => {
            let next = 0;
            onCleanup(
                this.model().subscribe((event) => {
                    this.log.update((entries) => {
                        const entry: LogEntry = {
                            id: next++,
                            command: event.command,
                            payload: JSON.stringify(event.payload),
                            transient: event.transient,
                        };
                        const [latest, ...rest] = entries;
                        // a drag's steps (and the command that ends it) replace its line
                        return latest?.transient &&
                            latest.command === entry.command
                            ? [entry, ...rest]
                            : [entry, ...entries].slice(0, 20);
                    });
                }),
            );
        });
    }
}
