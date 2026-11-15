---
"@fragiola/dockable-angular": patch
---

A splitter resized from the keyboard renders its new size and `aria-valuenow` before the key's handlers return, as the React and Vue adapters do, instead of on Angular's next frame.
