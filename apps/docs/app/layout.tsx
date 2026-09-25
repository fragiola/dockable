import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import { basePath } from "@/lib/base-path";
import "./globals.css";

const TITLE = "Dockable";
const DESCRIPTION =
    "A headless layout manager for dockable panels: tabs, tabsets, splitters, drag and drop and popout windows. Behaviour and accessibility, no CSS.";

export const metadata: Metadata = {
    title: { default: TITLE, template: `%s · ${TITLE}` },
    description: DESCRIPTION,
    openGraph: { title: TITLE, description: DESCRIPTION, siteName: TITLE },
};

// next-themes emits BOTH the .dark class (Fumadocs UI's own styles) AND
// data-theme="light"|"dark" (the Fragiola palettes key off
// :root[data-theme]). The examples carry their own theme on the stage
// (data-example-theme), independent of this one.
export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className="palette-surface flex min-h-screen flex-col">
                <RootProvider
                    search={{
                        options: {
                            type: "static",
                            api: `${basePath}/api/search`,
                        },
                    }}
                    theme={{
                        attribute: ["class", "data-theme"],
                        defaultTheme: "light",
                        enableSystem: true,
                    }}
                >
                    {children}
                </RootProvider>
            </body>
        </html>
    );
}
