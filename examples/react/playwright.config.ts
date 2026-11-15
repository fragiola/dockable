import { examplesE2eConfig } from "examples-shared/e2e/config";

// The shared suite (examples/shared/e2e) against this app's embed: a production build under
// /dockable/embed/react/, served with a host page that embeds it in an iframe. The build uses the
// packages' `dist`: build them first (`pnpm build` at the root does).
export default examplesE2eConfig("react");
