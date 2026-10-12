#!/usr/bin/env sh
#
# Put the built todo app where nginx serves it.
#
# A copy of apps/grocery/scripts/fetch-bundle.sh, which has the history: the image is
# nginx and its configuration, addressed by the hash of those files, and the app is a
# release asset fetched at startup by an init container running this. See DEPLOYMENT.md.
#
# Environment, all required:
#   BUNDLE_URL      The release asset to fetch. This repo is public, so that is a
#                   plain https://github.com/<owner>/<repo>/releases/download/...
#                   which redirects to storage and needs no credential.
#   BUNDLE_SHA256   What that asset must hash to. Not optional: this unpacks into the
#                   document root of the origin that holds a Google sign-in, and a
#                   release asset can be replaced in place without its tag moving.
#   BUNDLE_ROOT     Where to unpack it. The emptyDir the app container then mounts
#                   read-only over /usr/share/nginx/html.
#
# Every failure here is fatal, deliberately: this bundle *is* the whole site, so a pod
# that came up without it would serve nothing but 403s. Failing instead leaves the previous pods serving -- see the
# replica count and rollout strategy in k8s/todo.yaml, which are what turn a bad
# bundle into a stalled deploy rather than an outage.
#
# /bin/sh, not bash: the nginx-unprivileged base image is Alpine and has no bash,
# and adding one to fetch a tarball would be a package to keep patched for nothing.
set -eu

for var in BUNDLE_URL BUNDLE_SHA256 BUNDLE_ROOT; do
  eval "value=\${$var:-}"
  if [ -z "$value" ]; then
    echo "fetch-bundle: $var is not set; refusing to start." >&2
    exit 1
  fi
done

archive="$(mktemp)"
# shellcheck disable=SC2064  # $archive is expanded now on purpose, not at trap time.
trap "rm -f '$archive'" EXIT INT TERM

echo "fetch-bundle: fetching $BUNDLE_URL"
# --location because a release asset redirects to another host, and --fail so an
# HTTP error is a non-zero exit rather than an error document written to the file
# and then failing the hash check with a confusing message. The retries cover the
# case this is really guarding: a pod rescheduled onto a new node while GitHub is
# briefly unreachable.
curl --silent --show-error --fail --location \
     --retry 5 --retry-delay 2 --retry-connrefused --max-time 120 \
     --output "$archive" "$BUNDLE_URL"

[ -s "$archive" ] || { echo "fetch-bundle: the bundle downloaded empty." >&2; exit 1; }

got="$(sha256sum "$archive" | cut -d' ' -f1)"
if [ "$got" != "$BUNDLE_SHA256" ]; then
  echo "fetch-bundle: the bundle does not match its pinned hash." >&2
  echo "  wanted $BUNDLE_SHA256" >&2
  echo "  got    $got" >&2
  exit 1
fi

# Unpacked straight into the volume rather than staged and renamed: this is an init
# container, so nginx in this pod has not started and there is no half-unpacked window
# for a client to see.
echo "fetch-bundle: unpacking into $BUNDLE_ROOT"
tar -xzf "$archive" -C "$BUNDLE_ROOT"

# The one thing worth asserting about the contents. `try_files $uri $uri/ /index.html`
# with no index.html is not a 404 -- it is a 500 on every route in the app, because
# the fallback itself is missing.
[ -f "$BUNDLE_ROOT/index.html" ] || {
  echo "fetch-bundle: the bundle unpacked without an index.html; every route would 500." >&2
  exit 1
}

echo "fetch-bundle: in place."
ls -la "$BUNDLE_ROOT"
