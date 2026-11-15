import {
    afterRenderEffect,
    Component,
    computed,
    type ElementRef,
    effect,
    input,
    output,
    signal,
    untracked,
    viewChild,
} from "@angular/core";
import { injectDockable, type TabNode } from "@fragiola/dockable-angular";
import { LucideCircleAlert, LucideTriangleAlert } from "@lucide/angular";
import { FILE_PATHS, PROBLEMS } from "./files";
import * as styles from "./styles";
import type { EditorData, Types, Workspace } from "./workspace";

// The content of each kind of tab. Panels are never re-created when their tab moves, so the
// editor keeps its text, caret and scroll through any drag.

/**
 * A plain-text editor. It reports "modified" to its TAB: the dirty flag goes into the tab's
 * `data` through the `tab.set-data` command, and the tab reads it back (`data-dirty`).
 * The text itself stays in the workspace, outside the model.
 */
@Component({
    selector: "example-ide-editor",
    host: { class: "contents" },
    template: `
        <div [class]="styles.editor">
            <div [class]="styles.breadcrumbs">
                @for (part of parts(); track part; let index = $index, last = $last) {
                    <span [class]="styles.crumb">
                        @if (index > 0) {
                            <span aria-hidden="true">›</span>
                        }
                        <span [class]="styles.crumbName(last)">{{ part }}</span>
                    </span>
                }
                <button
                    type="button"
                    [disabled]="!dirty()"
                    [class]="styles.editorSave"
                    (click)="save()"
                >{{ dirty() ? "Save" : "Saved" }}</button>
            </div>
            <div [class]="styles.editorBody">
                <pre aria-hidden="true" [class]="styles.lineNumbers">{{ lineNumbers() }}</pre>
                <textarea
                    [attr.aria-label]="'Contents of ' + path()"
                    data-testid="editor"
                    [value]="text()"
                    wrap="off"
                    spellcheck="false"
                    [class]="styles.editorText"
                    (input)="onInput($event)"
                    (keydown)="onKeydown($event)"
                ></textarea>
            </div>
        </div>
    `,
})
export class EditorPanel {
    // an editor tab: `tab.data` is typed as the editor's data, no cast
    readonly tab = input.required<TabNode<"editor", EditorData>>();
    readonly workspace = input.required<Workspace>();
    protected readonly styles = styles;
    private readonly model = injectDockable<Types>().model;
    protected readonly path = computed(() => this.tab().data.path);
    protected readonly parts = computed(() => this.path().split("/"));
    protected readonly text = signal("");
    // the workspace is not reactive: whether the file is modified is read again after each change
    protected readonly dirty = signal(false);
    protected readonly lineNumbers = computed(() =>
        Array.from(
            { length: this.text().split("\n").length },
            (_, i) => i + 1,
        ).join("\n"),
    );

    constructor() {
        effect(() => {
            const { id, data } = this.tab();
            const dirty = this.dirty();
            if (Boolean(data.dirty) !== dirty) {
                // a patch: the rest of the data (the path) stays
                untracked(() =>
                    this.model().run("tab.set-data", {
                        tabId: id,
                        data: { dirty },
                    }),
                );
            }
        });
    }

    ngOnInit() {
        this.text.set(this.workspace().read(this.path()));
        this.refresh();
    }

    private refresh() {
        this.dirty.set(this.workspace().isDirty(this.path()));
    }

    protected save() {
        this.workspace().save(this.path());
        this.refresh();
    }

    protected onInput(event: Event) {
        const value = (event.target as HTMLTextAreaElement).value;
        this.text.set(value);
        this.workspace().write(this.path(), value);
        this.refresh();
    }

    protected onKeydown(event: KeyboardEvent) {
        if ((event.ctrlKey || event.metaKey) && event.key === "s") {
            event.preventDefault();
            this.save();
        }
    }
}

/** A small shell: enough commands to feel like one. */
@Component({
    selector: "example-ide-terminal",
    host: { class: "contents" },
    template: `
        <div [class]="styles.terminal">
            <!-- an append-only log -->
            @for (line of lines(); track $index) {
                <div [class]="styles.terminalLine">{{ line }}</div>
            }
            <form [class]="styles.terminalForm" (submit)="onSubmit($event)">
                <span aria-hidden="true" [class]="styles.terminalPrompt">~/counter-app $</span>
                <input
                    aria-label="Terminal command"
                    [value]="input()"
                    spellcheck="false"
                    [class]="styles.terminalInput"
                    (input)="input.set($any($event.target).value)"
                />
            </form>
            <div #end></div>
        </div>
    `,
})
export class TerminalPanel {
    readonly workspace = input.required<Workspace>();
    protected readonly styles = styles;
    protected readonly lines = signal<string[]>([
        "Welcome to the workbench terminal. Type `help`.",
    ]);
    protected readonly input = signal("");
    private readonly end = viewChild.required<ElementRef<HTMLElement>>("end");

    constructor() {
        // scroll when a line is added
        afterRenderEffect(() => {
            this.lines();
            this.end().nativeElement.scrollIntoView({ block: "nearest" });
        });
    }

    private run(command: string) {
        const workspace = this.workspace();
        const [name, ...args] = command.trim().split(/\s+/);
        const out: Record<string, () => string[]> = {
            help: () => ["commands: ls, cat <file>, git status, clear"],
            ls: () => FILE_PATHS,
            cat: () => workspace.read(args[0] ?? "").split("\n"),
            git: () => {
                const modified = FILE_PATHS.filter(workspace.isDirty);
                return modified.length > 0
                    ? modified.map((path) => `  modified:   ${path}`)
                    : ["nothing to commit, working tree clean"];
            },
        };
        if (name === "clear") {
            this.lines.set([]);
            return;
        }
        const result = name
            ? (out[name]?.() ?? [`${name}: command not found`])
            : [];
        this.lines.update((current) =>
            [...current, `$ ${command}`, ...result].slice(-500),
        );
    }

    protected onSubmit(event: Event) {
        event.preventDefault();
        this.run(this.input());
        this.input.set("");
    }
}

/** The linter's findings; clicking one opens its file. */
@Component({
    selector: "example-ide-problems",
    imports: [LucideCircleAlert, LucideTriangleAlert],
    host: { class: "contents" },
    template: `
        <ul [class]="styles.problems">
            @for (problem of PROBLEMS; track problem.path + ":" + problem.line) {
                <li>
                    <button type="button" [class]="styles.problem" (click)="openFile.emit(problem.path)">
                        @if (problem.severity === "error") {
                            <svg
                                lucideCircleAlert
                                [title]="problem.severity"
                                [class]="styles.problemIcon(problem.severity)"
                            ></svg>
                        } @else {
                            <svg
                                lucideTriangleAlert
                                [title]="problem.severity"
                                [class]="styles.problemIcon(problem.severity)"
                            ></svg>
                        }
                        <span [class]="styles.problemMessage">{{ problem.message }}</span>
                        <span [class]="styles.problemLocation">{{ problem.path + ":" + problem.line }}</span>
                    </button>
                </li>
            }
        </ul>
    `,
})
export class ProblemsPanel {
    readonly openFile = output<string>();
    protected readonly styles = styles;
    protected readonly PROBLEMS = PROBLEMS;
}
