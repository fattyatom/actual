#!/usr/bin/env bash
#
# Verify the importer changes are present in this branch's source. Unlike the old
# patch-apply test, the changes are committed here — so this is the guard for
# *after rebasing* homelab-importer onto a new upstream release: if a rebase drops
# or mangles one of the changes, this fails loudly before anything is built.
set -eu

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

PB=packages/desktop-client/src/components/sidebar/PrimaryButtons.tsx
VITE=packages/desktop-client/vite.config.mts
LINK=packages/desktop-client/src/components/common/Link.tsx
ITEMC=packages/desktop-client/src/components/sidebar/ItemContent.tsx
ITEM=packages/desktop-client/src/components/sidebar/Item.tsx

fail=0
need() { # <file> <fixed-string> <message>
  grep -qF -- "$2" "$1" || { echo "FAIL: $3 (expected '$2' in $1)" >&2; fail=1; }
}

need "$PB"    'to="/importer"'  "Importer link target missing"
need "$PB"    'reloadDocument'  "Importer link is not a full-document navigation"
need "$PB"    'SvgCloudUpload'  "Importer icon import missing"
need "$PB"    "t('Importer')"   "Importer title missing"
need "$LINK"  'reloadDocument'  "reloadDocument not threaded through Link.tsx"
need "$ITEMC" 'reloadDocument'  "reloadDocument not threaded through ItemContent.tsx"
need "$ITEM"  'reloadDocument'  "reloadDocument not threaded through Item.tsx"
need "$VITE"  '/^\/importer([/?].*)?$/' "SW navigateFallbackDenylist /importer entry missing"

if [ "$fail" -ne 0 ]; then
  echo "==> FAILED: the importer changes are not intact in this branch" >&2
  exit 1
fi
echo "==> OK: Importer button + reloadDocument + /importer denylist present in source"
