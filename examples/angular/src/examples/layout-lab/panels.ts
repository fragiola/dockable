import {
    Component,
    computed,
    type ElementRef,
    effect,
    input,
    output,
    signal,
    viewChild,
} from "@angular/core";
import {
    type CommandError,
    type CommandInfo,
    type CommandName,
    type CommandResult,
    injectModelState,
    type Model,
    type ValidationIssue,
} from "@fragiola/dockable-angular";
import { SELECT_PARTS } from "#/components/ui/select";
import { SWITCH } from "#/components/ui/switch";
import type { LogEntry, Types } from "./commands";
import * as styles from "./styles";

// The lab's two instruments, both outside the layout: the model's JSON (v1), editable, and the
// log of every command the lab's middleware saw, with a switch that vetoes one command.

interface EditorError {
    message: string;
    /** each problem with its JSON path (RFC 6901) in the document being edited */
    issues: readonly ValidationIssue[];
}

/** `layout.load` reports paths inside its payload (`/layout/...`): the editor shows the layout. */
function documentPath(path: string): string {
    return path.replace(/^\/layout(?=\/|$)/, "") || "/";
}

function editorError(error: CommandError): EditorError {
    return {
        message: error.message,
        issues: (error.issues ?? []).map((issue) => ({
            path: documentPath(issue.path),
            message: issue.message,
        })),
    };
}

let nextId = 0;

/**
 * The model's current `LayoutJson` (v1). It follows the model until you type; then Apply loads it
 * into the model with `layout.load` (validated first: the problems are listed with their paths and
 * the layout is left alone) and Revert drops the edit.
 */
@Component({
    selector: "example-json-editor",
    host: { class: "contents" },
    template: `
        <section aria-label="Model JSON" [class]="styles.jsonEditor">
            <div [class]="styles.jsonHeader">
                <h2 [class]="styles.jsonTitle">LayoutJson</h2>
                <button type="button" [disabled]="!edited()" [class]="styles.revertButton" (click)="revert()">
                    Revert
                </button>
                <button type="button" [disabled]="!edited()" [class]="styles.applyButton" (click)="apply()">
                    Apply
                </button>
            </div>
            <textarea
                #text
                aria-label="Layout JSON"
                [attr.aria-invalid]="error() ? true : null"
                [attr.aria-describedby]="error() ? errorId : null"
                [value]="draft() ?? current()"
                (input)="draft.set($any($event.target).value)"
                spellcheck="false"
                wrap="off"
                [class]="styles.jsonText"
            ></textarea>
            @if (error(); as error) {
                <div [id]="errorId" role="alert" [class]="styles.jsonError">
                    <p>{{ error.message }}</p>
                    @if (error.issues.length > 0) {
                        <ul [class]="styles.jsonIssues">
                            @for (issue of error.issues; track issue.path + " " + issue.message) {
                                <li><span [class]="styles.jsonIssuePath">{{ issue.path }}</span> {{ issue.message }}</li>
                            }
                        </ul>
                    }
                </div>
            }
        </section>
    `,
})
export class JsonEditor {
    readonly model = input.required<Model<Types>>();
    /** loads the parsed document (untrusted JSON) into the model */
    readonly load =
        input.required<(layout: unknown) => CommandResult<unknown>>();
    protected readonly styles = styles;
    // the editor follows the model: a commit re-renders it, not the layout
    private readonly json = injectModelState(
        (_, model) => model.get("layout-json"),
        { model: this.model },
    );
    protected readonly current = computed(() =>
        JSON.stringify(this.json(), null, 2),
    );
    private readonly text =
        viewChild.required<ElementRef<HTMLTextAreaElement>>("text");
    protected readonly draft = signal<string | null>(null);
    protected readonly error = signal<EditorError | null>(null);
    protected readonly errorId = `layout-lab-json-error-${++nextId}`;
    protected readonly edited = computed(() => {
        const draft = this.draft();
        return draft !== null && draft !== this.current();
    });

    constructor() {
        // Angular renders after the event that made the commit (a press on a tab): the text also
        // follows each commit as it happens, so it is never a layout behind the model
        effect((onCleanup) => {
            const model = this.model();
            onCleanup(
                model.subscribe(() => {
                    if (this.draft() !== null) return;
                    this.text().nativeElement.value = JSON.stringify(
                        model.get("layout-json"),
                        null,
                        2,
                    );
                }),
            );
        });
    }

    protected revert() {
        this.draft.set(null);
        this.error.set(null);
    }

    protected apply() {
        const draft = this.draft();
        if (draft === null) return;
        let parsed: unknown;
        try {
            parsed = JSON.parse(draft);
        } catch (caught) {
            this.error.set({
                message:
                    caught instanceof Error ? caught.message : String(caught),
                issues: [],
            });
            return;
        }
        const result = this.load()(parsed);
        if (result.ok) {
            this.draft.set(null);
            this.error.set(null);
        } else {
            this.error.set(editorError(result.error));
        }
    }
}

export interface Veto {
    enabled: boolean;
    command: CommandName;
}

/** The switch and the command it vetoes, chosen from `model.get("commands")`. */
@Component({
    selector: "example-veto-control",
    imports: [SELECT_PARTS, SWITCH],
    host: { class: "contents" },
    template: `
        <div [class]="styles.veto">
            <div [class]="styles.vetoSwitch">
                <button
                    kitSwitch
                    [checked]="veto().enabled"
                    (checkedChange)="vetoChange.emit({ command: veto().command, enabled: $event })"
                    aria-label="Veto"
                >
                    <span kitSwitchThumb></span>
                </button>
                <span aria-hidden="true">Veto</span>
            </div>
            <button
                [kitSelectTrigger]="list"
                [items]="items()"
                [value]="veto().command"
                (valueChange)="pick($event)"
                aria-label="Command to veto"
                [class]="styles.vetoTrigger"
            >
                <span kitSelectValue></span>
            </button>
            <ng-template #list>
                <div kitSelectContent>
                    @for (item of items(); track item.value) {
                        <div [kitSelectItem]="item.value" [class]="styles.vetoItem">{{ item.label }}</div>
                    }
                </div>
            </ng-template>
        </div>
    `,
})
export class VetoControl {
    readonly veto = input.required<Veto>();
    readonly commands = input.required<readonly CommandInfo[]>();
    readonly vetoChange = output<Veto>();
    protected readonly styles = styles;
    protected readonly items = computed(() =>
        this.commands().map((info) => ({
            value: info.name,
            label: info.name,
        })),
    );

    protected pick(value: unknown) {
        // the chosen item is one of the model's commands
        const command = this.commands().find(
            (info) => info.name === value,
        )?.name;
        if (command) this.vetoChange.emit({ ...this.veto(), command });
    }
}

/** Every command, newest first: its name, its payload, and whether it applied (or why not). */
@Component({
    selector: "example-command-log",
    host: { class: "contents" },
    template: `
        <section aria-label="Command log" [class]="styles.log">
            <div [class]="styles.logHeader">
                <h2 [class]="styles.logTitle">
                    model.use<span [class]="styles.logCount">{{ log().length + " commands" }}</span>
                </h2>
                <button
                    type="button"
                    [disabled]="log().length === 0"
                    [class]="styles.clearButton"
                    (click)="clear.emit()"
                >
                    Clear
                </button>
            </div>
            <ol data-testid="action-log" [class]="styles.logList">
                @if (log().length === 0) {
                    <li [class]="styles.logEmpty">Drag, click or resize: every change is a command.</li>
                }
                @for (entry of newestFirst(); track entry.id) {
                    <li [attr.data-vetoed]="entry.outcome === 'vetoed' ? '' : null" [class]="styles.logEntry">
                        <span [class]="styles.logOutcome(entry.outcome)">{{ entry.outcome }}</span>
                        <span [class]="styles.logCommand">{{ entry.command }}</span>
                        <span [class]="styles.logPayload">{{ entry.payload }}</span>
                    </li>
                }
            </ol>
        </section>
    `,
})
export class CommandLog {
    readonly log = input.required<LogEntry[]>();
    readonly clear = output<void>();
    protected readonly styles = styles;
    protected readonly newestFirst = computed(() => [...this.log()].reverse());
}
