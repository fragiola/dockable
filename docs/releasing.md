# Releasing

Releasing is a merge. [Changesets](https://changesets.dev) versions `@fragiola/dockable` and
`@fragiola/dockable-react` together (one `fixed` group, so they always share a version) and writes
their changelogs. The release workflow, [`.github/workflows/release.yml`](../.github/workflows/release.yml),
publishes them with pnpm through npm **trusted publishing** (OIDC, with provenance): there is no
npm token anywhere.

On every push to `main` the workflow does one of three things:

- **changesets are pending:** it opens or updates the **Version Packages** PR, which bumps the
  versions, writes the `CHANGELOG.md` files and deletes the changesets;
- **no changeset, and `main`'s version is not on npm** (the Version Packages PR was just merged):
  it builds the packages, packs them with pnpm, checks those tarballs
  (`scripts/check-package.ts --tarballs`), publishes them from the `npm` environment, then pushes
  the git tags (`@fragiola/dockable@0.1.0`, …) and creates the GitHub releases;
- otherwise nothing.

Packing and publishing always go through pnpm: it applies `publishConfig` (the dist-only
`exports`), npm does not. Never publish with `npm publish`.

## The first release (0.1.0)

npm can only trust a publisher for a package that already exists, so the first publish is a manual
`0.0.0` stub. Do these steps in order, once. Steps 1 to 5 come **before** merging the PR that adds
this runbook (the release PR): its merge starts the release.

1. **The scope.** Make sure the npm scope `@fragiola` exists and that your npm account owns it
   (`npm org ls fragiola`, or <https://www.npmjs.com/settings/fragiola/members>). Your account has
   2FA enabled.

2. **Let the workflow open PRs.** In the repository's *Settings → Actions → General → Workflow
   permissions*, enable **Allow GitHub Actions to create and approve pull requests**. In an
   organization this checkbox is greyed out until the organization allows it: enable the same
   option first in the organization's *Settings → Actions → General → Workflow permissions*.
   Without it, the workflow cannot open the Version Packages PR.

3. **The `npm` environment.** In the repository's *Settings → Environments*, create an environment
   named exactly `npm`. Under *Deployment branches and tags*, choose *Selected branches and tags*
   and add the rule `main`. The publish job runs in this environment, and npm will trust only a
   run of `release.yml` in it, so a run from any other branch cannot publish. (A required reviewer
   on it would make every publish wait for an approval; optional.)

4. **The stub.** From a clean checkout of `main` (which has the packaging, bug-fix and RTL PRs, but
   not the release PR yet), with both packages at `0.0.0`:

   ```sh
   git switch main && git pull && git status   # clean, up to date
   pnpm install --frozen-lockfile
   pnpm build && pnpm --filter "./packages/*" publish --access public
   ```

   pnpm asks for your 2FA code. It publishes the core first, then the React package, which depends
   on the core at exactly `0.0.0`. `pnpm --filter "./packages/*" publish --access public --dry-run`
   shows what would be published.

5. **The trusted publisher.** With npm 11.15 or later (`npm --version`; `npm install -g
   npm@latest` updates it) and your account's 2FA, for each package:

   ```sh
   npm trust github @fragiola/dockable --file release.yml --repo fragiola/dockable --environment npm --allow-publish
   npm trust github @fragiola/dockable-react --file release.yml --repo fragiola/dockable --environment npm --allow-publish
   ```

   `--allow-publish` is required: since 2026-09-03 a trusted publisher only gets staged publishing
   unless `npm publish` is allowed explicitly, and Changesets does not do staged publishing.
   `npm trust list <package>` shows the configuration. The repository, the filename and the
   environment are all part of it: never rename `release.yml` or its `npm` environment.

6. **Merge the release PR.** Its push to `main` runs the release workflow, which opens the
   **Version Packages** PR (`changeset-release/main`): both packages at `0.1.0`, both changelogs.
   The site rebuilds on this merge, so from now on its installation page says to install the
   packages while npm has only the `0.0.0` stub: go straight on to step 7.

7. **Merge the Version Packages PR.** A PR opened with the workflow's token starts no other
   workflow, so CI does not run on it by itself: close and reopen the PR (or run *CI* on its
   branch from the Actions tab) to get the checks, then merge it. The release workflow publishes
   `0.1.0` with provenance. Merge nothing else until that run is over (see *While a release
   runs*). Then check both packages on npm (`0.1.0` is `latest`, with provenance), the two tags and
   the two GitHub releases.

8. **Lock it down.** On npm, for each package, *Settings → Publishing access*: **Require
   two-factor authentication and disallow tokens**. From now on only the workflow publishes (and
   you, interactively with 2FA, if ever needed).

## Later releases

- **Every PR that changes what a package ships** adds a changeset: `pnpm changeset`, pick the bump
  and write the summary for the changelog (what changed and, for a break, how to update). Commit
  the `.changeset/*.md` file with the PR. "What a package ships" is `changedFilePatterns` in
  `.changeset/config.json`: its `src`, `package.json`, `README.md`, `LICENSE` and build configs.
  A PR that touches only tests, docs, examples, the playground or the tooling needs none. CI's
  *Changesets* job fails a PR that should have one (the Version Packages PR is skipped).
- **The bump.** The two packages are one `fixed` group: a changeset for either bumps both. While
  Dockable is `0.x`, a breaking change is a `minor` (`0.1` → `0.2`), anything else a `patch`.
- **Releasing.** Merging such PRs keeps the Version Packages PR up to date. Merge it when you want
  to release (re-trigger its CI first, as in step 7). Never bump the versions or edit the
  changelogs by hand. `pnpm changeset status --verbose` shows what the next release contains.
- **Possible improvement.** The Version Packages PR would get its CI by itself if the version job
  pushed with a GitHub App's token (the `github-token` input of `changesets/action/version`)
  instead of the workflow's. That needs an App installed on the repository and its key as a
  secret.

## While a release runs

From the merge of the Version Packages PR until its *Release* run has finished, merge nothing
else. Each push to `main` starts its own run, and each run decides on its own: a PR merged in the
meantime with no changeset would also be in publish mode, and could publish the same version from
a different commit. The publish of one commit is never cancelled by a later push.

## When a publish fails

After a failed publish, `main` holds the bumped version (say `0.2.0`) and no changeset, and npm
lacks that version for one package or both. The release workflow publishes it on the next run
**that finds no changeset on `main`**, so:

- **The cause was outside the repository** (npm down, the trusted publisher or the `npm`
  environment misconfigured): fix that, then open the failed run of *Release* and choose *Re-run
  all jobs* (possible for 30 days). Its select-mode job computes the plan again: only what npm
  lacks.
- **The cause is in the repository** (a build or the tarball check fails): fix it in a PR that
  **adds no changeset**. Its merge leaves `main` with no changeset, so that run publishes the
  bumped version, fix included. CI's *Changesets* job fails on that PR when it touches a package's
  shipped files; that is expected here, and the check is not required: merge it anyway. Do not
  add an empty changeset (`pnpm changeset --empty`) to quiet it: any changeset on `main` stops the
  publish, and an empty one releases nothing.
- **Until the stuck version is out, merge no PR that adds a changeset.** It would turn the next
  run into a version run, which bumps past the stuck version (`0.2.1`), and that version would
  never be published. If that is what you want (give up on the stuck version), deprecate whatever
  part of it reached npm (below) and release the next one.
- **Half published** (the core is on npm, the React package is not): any of the above publishes the
  rest. Changesets skips a version npm already has; the failed run already pushed the tags and
  created the releases of what it did publish.
- **Published, but a tag or a release is missing** (the run failed after npm): the workflow will
  not publish again, so create them by hand: the tag `<package>@<version>` on the commit the
  publish ran from, and a GitHub release from it with the changelog's section.
- **`ENEEDAUTH`, `E404` or `E403` on publish:** the trusted publisher does not match the run.
  Check `npm trust list <package>`: the repository `fragiola/dockable`, the file `release.yml`,
  the environment `npm`, publishing allowed. The packages' `repository.url` must point to this
  repository.
- **A broken version went out:** npm versions cannot be reused. Deprecate it
  (`npm deprecate @fragiola/dockable@<version> "<why>"`, the same for the React package) and
  release a fix with a new changeset.
