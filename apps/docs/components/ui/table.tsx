"use client";
// Vendored from the Fragiola UI registry (https://ui.fragiola.com/r/table.json, source registry/ui/table.tsx). Do not edit: re-run scripts/vendor-fragiola.ts.

import type * as React from "react";
import { cn } from "@/lib/cn";

// Table — semantic HTML with palette roles. No primitive, no family. The
// roles are: `border-palette-line` for the grid, `bg-palette-soft` for the
// header, `text-palette-contrast` for header text, `text-palette-accent/85`
// for body text. Hover is `hover:bg-palette-soft` (a role, not a colour).
//
// No `!important`. No logical properties needed on the inline axis — table
// cells are symmetrical. The table wrapper handles horizontal scroll on
// small screens.

function TableRoot({ className, ...props }: React.ComponentProps<"table">) {
    return (
        <div className="relative w-full overflow-auto">
            <table
                data-slot="table"
                className={cn(
                    "w-full caption-bottom text-sm",
                    className as string,
                )}
                {...props}
            />
        </div>
    );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
    return (
        <thead
            data-slot="table-header"
            className={cn("[&_tr]:border-b", className as string)}
            {...props}
        />
    );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
    return (
        <tbody
            data-slot="table-body"
            className={cn("[&_tr:last-child]:border-0", className as string)}
            {...props}
        />
    );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
    return (
        <tfoot
            data-slot="table-footer"
            className={cn(
                "border-t border-palette-line bg-palette-soft font-medium",
                className as string,
            )}
            {...props}
        />
    );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
    return (
        <tr
            data-slot="table-row"
            className={cn(
                "border-b border-palette-line transition-colors hover:bg-palette-soft",
                "data-[state=selected]:bg-palette-soft",
                className as string,
            )}
            {...props}
        />
    );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
    return (
        <th
            data-slot="table-head"
            className={cn(
                "h-10 px-3 text-start align-middle font-medium text-palette-contrast",
                className as string,
            )}
            {...props}
        />
    );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
    return (
        <td
            data-slot="table-cell"
            className={cn(
                "p-3 align-middle text-palette-accent/85",
                className as string,
            )}
            {...props}
        />
    );
}

function TableCaption({
    className,
    ...props
}: React.ComponentProps<"caption">) {
    return (
        <caption
            data-slot="table-caption"
            className={cn(
                "mt-4 text-sm text-palette-accent/85",
                className as string,
            )}
            {...props}
        />
    );
}

export const Table = {
    Root: TableRoot,
    Header: TableHeader,
    Body: TableBody,
    Footer: TableFooter,
    Row: TableRow,
    Head: TableHead,
    Cell: TableCell,
    Caption: TableCaption,
};
