"use client";
// Vendored from the Fragiola UI registry (https://ui.fragiola.com/r/popover.json, source registry/ui/popover.tsx). Do not edit: re-run scripts/vendor-fragiola.ts.

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { XIcon } from "lucide-react";
import { Clickable } from "@/components/atoms/clickable";
import { Text } from "@/components/atoms/text";
import { popup } from "@/components/families/popup";
import { cn } from "@/lib/cn";

// Popover — a floating surface positioned against a trigger. Composes
// `popup.content` (the same floating box dropdown-menu uses) and adds Title,
// Description and Close through `render` — the same composition pattern as
// Dialog, but pointing at `popup.content` instead of `layer.panel`.
//
// Why `popup.content` and not `layer.panel`: a popover is positioned by a
// floating-ui positioner and sized by --available-height; a dialog panel is
// not. The overlap (raised surface, border, radius, shadow) is checked, not
// assumed — and it is small enough that unifying them would couple a
// positioned surface to a centring transform it does not use. They stay
// separate (layer.panel for modal surfaces, popup.content for positioned
// surfaces).
//
// Title renders Text.Heading as="h2" through render; Description renders
// Text.Paragraph. Both keep the primitive's a11y wiring. The close
// affordance is Clickable.Button variant="icon" shape="square" size="sm",
// positioned with logical properties (top-4 end-4).

function PopoverRoot({ ...props }: PopoverPrimitive.Root.Props) {
    return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
    return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
    className,
    showClose = true,
    children,
    ...props
}: PopoverPrimitive.Popup.Props &
    Pick<
        PopoverPrimitive.Positioner.Props,
        "align" | "alignOffset" | "side" | "sideOffset"
    > & {
        /** Whether to render the close affordance. */
        showClose?: boolean;
    }) {
    const { align, alignOffset, side, sideOffset, ...popupProps } = props;
    return (
        <PopoverPrimitive.Portal>
            <PopoverPrimitive.Positioner
                className="z-50 outline-none"
                align={align}
                alignOffset={alignOffset}
                side={side}
                sideOffset={sideOffset}
            >
                <PopoverPrimitive.Popup
                    data-slot="popover-content"
                    className={cn(
                        popup.content("z-50 outline-none"),
                        className as string,
                    )}
                    {...popupProps}
                >
                    {showClose ? (
                        <PopoverPrimitive.Close
                            render={
                                <Clickable.Button
                                    variant="icon"
                                    shape="square"
                                    size="sm"
                                    aria-label="Close"
                                    className="absolute top-4 end-4"
                                />
                            }
                        >
                            <XIcon />
                        </PopoverPrimitive.Close>
                    ) : null}
                    {children}
                </PopoverPrimitive.Popup>
            </PopoverPrimitive.Positioner>
        </PopoverPrimitive.Portal>
    );
}

function PopoverTitle({ className, ...props }: PopoverPrimitive.Title.Props) {
    return (
        <PopoverPrimitive.Title
            data-slot="popover-title"
            render={<Text.Heading as="h2" />}
            className={cn("text-palette-contrast", className as string)}
            {...props}
        />
    );
}

function PopoverDescription({
    className,
    ...props
}: PopoverPrimitive.Description.Props) {
    return (
        <PopoverPrimitive.Description
            data-slot="popover-description"
            render={<Text.Paragraph />}
            className={cn("text-palette-accent/85", className as string)}
            {...props}
        />
    );
}

function PopoverClose({ className, ...props }: PopoverPrimitive.Close.Props) {
    return (
        <PopoverPrimitive.Close
            data-slot="popover-close"
            render={<Clickable.Button variant="ghost" size="sm" />}
            className={className as string}
            {...props}
        />
    );
}

export const Popover = {
    Root: PopoverRoot,
    Trigger: PopoverTrigger,
    Content: PopoverContent,
    Title: PopoverTitle,
    Description: PopoverDescription,
    Close: PopoverClose,
};
