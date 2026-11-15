import { Component, computed, input, output, signal } from "@angular/core";
import { injectModelState, type Model } from "@fragiola/dockable-angular";
import {
    LucideChevronRight,
    LucideDynamicIcon,
    LucideFileCode2,
    LucideFileJson,
    LucideFileText,
    LucideHash,
    type LucideIcon,
    LucideRotateCcw,
} from "@lucide/angular";
import { FILE_PATHS, fileName, folderOf } from "./files";
import * as styles from "./styles";
import { activePath, dirtyPaths, type Types } from "./workspace";

// The file tree. It is the content of the start border's "Explorer" tab, and opens files through
// the output it has (the example turns that into the `tab.add` / `tab.select` commands).

/** A file type: its icon, and the tone that colours it. */
type FileType = [LucideIcon, styles.FileTone];

/** A file icon, coloured by type through a palette (so every theme recolours it). */
@Component({
    selector: "example-ide-file-icon",
    imports: [LucideDynamicIcon],
    host: { class: "contents" },
    template: `<svg [lucideIcon]="type()[0]" aria-hidden="true" [class]="classes()"></svg>`,
})
export class FileIcon {
    readonly path = input.required<string>();
    readonly class = input<string>();
    protected readonly type = computed((): FileType => {
        const path = this.path();
        return path.endsWith(".json")
            ? [LucideFileJson, "orange"]
            : path.endsWith(".md")
              ? [LucideFileText, "green"]
              : path.endsWith(".css")
                ? [LucideHash, "purple"]
                : [LucideFileCode2, "blue"];
    });
    protected readonly classes = computed(() =>
        styles.fileIcon(this.type()[1], this.class()),
    );
}

@Component({
    selector: "example-ide-explorer",
    imports: [FileIcon, LucideChevronRight, LucideRotateCcw],
    host: { class: "contents" },
    template: `
        <nav aria-label="Explorer" [class]="styles.explorer">
            <div [class]="styles.explorerHeader">
                Explorer
                <button
                    type="button"
                    aria-label="Reset the saved layout"
                    title="Reset the saved layout"
                    [class]="styles.resetButton"
                    (click)="resetLayout.emit()"
                >
                    <svg lucideRotateCcw aria-hidden="true" [class]="styles.resetIcon"></svg>
                </button>
            </div>
            <ul [class]="styles.explorerTree">
                @for (folder of folders; track folder || "/") {
                    <li>
                        @if (folder) {
                            <button
                                type="button"
                                [attr.aria-expanded]="isOpen(folder)"
                                [class]="styles.folderRow"
                                (click)="toggle(folder)"
                            >
                                <svg
                                    lucideChevronRight
                                    aria-hidden="true"
                                    [class]="styles.folderChevron(isOpen(folder))"
                                ></svg>
                                {{ folder }}
                            </button>
                        }
                        @if (isOpen(folder)) {
                            <ul>
                                @for (path of filesOf(folder); track path) {
                                    <li>
                                        <button
                                            type="button"
                                            data-testid="explorer-file"
                                            [attr.aria-current]="path === active() ? 'true' : null"
                                            [class]="styles.fileRow(folder !== '')"
                                            (click)="openFile.emit(path)"
                                        >
                                            <example-ide-file-icon [path]="path" />
                                            <span [class]="styles.fileName">{{ fileName(path) }}</span>
                                            @if (dirty().has(path)) {
                                                <span
                                                    role="img"
                                                    aria-label="modified"
                                                    [class]="styles.fileModified"
                                                ></span>
                                            }
                                        </button>
                                    </li>
                                }
                            </ul>
                        }
                    </li>
                }
            </ul>
        </nav>
    `,
})
export class Explorer {
    readonly model = input.required<Model<Types>>();
    readonly openFile = output<string>();
    readonly resetLayout = output<void>();
    protected readonly styles = styles;
    protected readonly fileName = fileName;
    protected readonly dirty = injectModelState(
        (_state, model) => dirtyPaths(model),
        {
            model: this.model,
            isEqual: (a, b) =>
                a.size === b.size && [...a].every((path) => b.has(path)),
        },
    );
    protected readonly active = injectModelState(
        (_state, model) => activePath(model),
        { model: this.model },
    );
    private readonly collapsed = signal<ReadonlySet<string>>(new Set());
    protected readonly folders = [...new Set(FILE_PATHS.map(folderOf))];

    protected isOpen(folder: string) {
        return !this.collapsed().has(folder);
    }

    protected filesOf(folder: string) {
        return FILE_PATHS.filter((path) => folderOf(path) === folder);
    }

    protected toggle(folder: string) {
        this.collapsed.update((current) => {
            const next = new Set(current);
            if (next.has(folder)) next.delete(folder);
            else next.add(folder);
            return next;
        });
    }
}
