// The site's base path ("/dockable" on GitHub Pages, "" in dev). Next adds it
// to <Link> and redirect() by itself; anything fetched or opened by hand
// (the search index, the popout host page) must add it explicitly.
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
