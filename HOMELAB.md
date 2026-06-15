# Homelab fork (`homelab-importer`)

A fork of [Actual Budget](https://github.com/actualbudget/actual) with two
additions for the homelab bank-statement importer integration:

- an **"Importer"** sidebar button (full-document navigation to `/importer`)
- a `/importer` entry in the service-worker `navigateFallbackDenylist`, so the
  importer is reachable at `<host>/importer` (same origin) without the Actual SPA
  swallowing the route

It builds + publishes **`ghcr.io/fattyatom/actual:<version>`**, consumed by the
`fattyatom/homelab` `actual-budget` compose (which pulls the image — it no longer
builds on-deploy).

## Additions on top of upstream
- `Dockerfile.homelab` — builds `@actual-app/web` from this branch and layers it
  onto `actualbudget/actual-server`
- `tests/homelab/` — `verify-importer.sh` (post-rebase guard), `denylist.test.mjs`,
  `e2e/` (Playwright: Importer button + `/importer` redirection)
- `.github/workflows/homelab-image.yml` (build + E2E + publish on branch push) and
  `homelab-canary.yml` (weekly build/E2E + upstream-ahead alert)

## Updating to a new Actual release
1. `git fetch upstream && git rebase vX.Y.Z` — resolve conflicts in the five
   importer files (`PrimaryButtons`, `Link`, `ItemContent`, `Item`,
   `vite.config.mts`), and bump `FROM actualbudget/actual-server:X.Y.Z` in
   `Dockerfile.homelab`.
2. `git push --force-with-lease origin homelab-importer` → CI rebuilds + publishes
   `ghcr.io/fattyatom/actual:X.Y.Z` + `:latest`.
3. In `fattyatom/homelab`, bump the `actual-budget` compose image tag to `:X.Y.Z`.

The weekly `homelab-canary` opens a tracking issue when upstream is ahead of the
branch base or the branch stops building.
