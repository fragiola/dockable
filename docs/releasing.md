# Releasing

Releasing is a merge. [Changesets](https://changesets.dev) versions `@fragiola/dockable` and
`@fragiola/dockable-react` together (one `fixed` group, so they always share a version) and writes
their changelogs. The release workflow, [`.github/workflows/release.yml`](../.github/workflows/release.yml),
publishes them with pnpm through npm **trusted publishing** (OIDC, with provenance): there is no
npm token anywhere.

On every push to `main` the workflow does one of three things:

- **changesets are pending:** it opens or updates the **Version Packages** PR, which bumps the
  versions, writes the `CHANGELOG.md` files and deletes the changesets;
- **the Version Packages PR was just merged** (no changeset, a version npm does not have): it
  builds the packages, runs `pnpm check:package`, packs them with pnpm, publishes the tarballs,
  then pushes the git tags (`@fragiola/dockable@0.1.0`, …) and creates the GitHub releases;
- otherwise nothing.

Packing and publishing always go through pnpm: it applies `publishConfig` (the dist-only
`exports`), npm does not. Never publish with `npm publish`.

## The first release (0.1.0)

npm can only trust a publisher for a package that already exists, so the first publish is a manual
`0.0.0` stub. Do these steps in order, once. Merge the PR that adds this runbook right before you
start: from then on, the site says the packages are on npm.

1. **The scope.** Make sure the npm scope `@fragiola` exists and that your npm account owns it
   (`npm org ls fragiola`, or <https://www.npmjs.com/settings/fragiola/members>). Your account has
   2FA enabled.

2. **The stub.** From a clean checkout of `main`, with both packages still at `0.0.0`:

   ```sh
   git switch main && git pull && git status   # clean, up to date
   pnpm install --frozen-lockfile
   pnpm build && pnpm --filter "./packages/*" publish --access public
   ```

   pnpm asks for your 2FA code. It publishes the core first, then the React package, which depends
   on the core at exactly `0.0.0`. `pnpm --filter "./packages/*" publish --access public --dry-run`
   shows what would be published.

3. **The trusted publisher.** With npm 11.15 or later (`npm install -g npm@latest`) and your
   account's 2FA, for each package:

   ```sh
   npm trust github @fragiola/dockable --file release.yml --repo fragiola/dockable --allow-publish
   npm trust github @fragiola/dockable-react --file release.yml --repo fragiola/dockable --allow-publish
   ```

   `--allow-publish` is required: since 2026-09-03 a trusted publisher only gets staged publishing
   unless `npm publish` is allowed explicitly, and Changesets does not do staged publishing.
   `npm trust list <package>` shows the configuration. The workflow's filename is part of it:
   never rename `release.yml`.

4. **The repository setting.** In the repository's *Settings → Actions → General → Workflow
   permissions*, enable **Allow GitHub Actions to create and approve pull requests**. Without it,
   the workflow cannot open the Version Packages PR. If the release workflow already ran on the
   merge of this runbook's PR and failed on it, re-run it (*Actions → Release → Re-run all jobs*).

5. **The release.** The workflow opens the **Version Packages** PR (`changeset-release/main`):
   both packages at `0.1.0`, both changelogs. A PR opened by the workflow's token starts no other
   workflow, so CI does not run on it by itself: close and reopen the PR (or run *CI* on its
   branch from the Actions tab) to get the checks. Merge it. The release workflow publishes
   `0.1.0` with provenance; check both packages on npm, the tags and the GitHub releases.

6. **Lock it down.** On npm, for each package, *Settings → Publishing access*: **Require
   two-factor authentication and disallow tokens**. From now on only the workflow publishes (and
   you, interactively with 2FA, if ever needed).

## Later releases

- **Every PR that changes what a package ships** (`packages/*`: code, types, README) adds a
  changeset: `pnpm changeset`, pick the bump and write the summary for the changelog (what changed
  and, for a break, how to update). Commit the `.changeset/*.md` file with the PR. A PR that only
  touches the docs, the examples, the playground or the tooling needs none.
- **The bump.** The two packages are one `fixed` group: a changeset for either bumps both. While
  Dockable is `0.x`, a breaking change is a `minor` (`0.1` → `0.2`), anything else a `patch`.
- **Releasing.** Merging such PRs keeps the Version Packages PR up to date. Merge it when you want
  to release (re-trigger its CI first, as in step 5). Never bump the versions or edit the changelogs
  by hand. `pnpm changeset status --verbose` shows what the next release contains.

## When a publish fails

- **Nothing was published** (the pack or the publish job failed before any package went out): fix
  the cause on `main` with a normal PR. The push re-runs the workflow, which publishes the versions
  npm still lacks. When the cause was outside the repository (npm down, a trusted publisher
  setting), just *Re-run all jobs*.
- **Half published** (the core is on npm, the React package is not): *Re-run all jobs* on the failed
  run. The publish plan only lists the versions npm does not have, and Changesets skips a version
  that is already published, so the run publishes the rest, then pushes its tag and creates its
  release. The tags and releases of the packages that did go out were already created by the
  failed run.
- **Published, but a tag or a release is missing** (the run failed after npm): the workflow will
  not publish again, so create them by hand: the tag `<package>@<version>` on the Version Packages
  merge commit, and a GitHub release from it with the changelog's section.
- **`ENEEDAUTH`, `E404` or `E403` on publish:** the trusted publisher does not match the run.
  Check `npm trust list <package>`: the repository `fragiola/dockable`, the file `release.yml`,
  publishing allowed. The packages' `repository.url` must point to this repository.
- **A broken version went out:** npm versions cannot be reused. Deprecate it
  (`npm deprecate @fragiola/dockable@<version> "<why>"`, the same for the React package) and
  release a fix with a new changeset.
