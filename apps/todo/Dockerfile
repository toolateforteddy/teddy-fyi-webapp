# nginx and its configuration. **Not the app** -- see the fetch script this copies in.
#
# The same shape as apps/grocery/Dockerfile, whose header has the history: the app is a
# release asset an init container fetches at startup, so a merge that changes only the app
# pushes no image. The deploy workflow tags this by the hash of the files that compose it,
# and `apps/todo/base-refresh.txt` is in that hash and in no build step, so touching it is
# how to ask for a fresh pull of the base image below.
#
# nginxinc/nginx-unprivileged is the official non-root variant: it runs as uid/gid
# 101, listens on 8080 rather than the privileged 80, and already relocates the pid
# file and every *_temp_path into /tmp, so the container can run with a read-only root
# filesystem given one writable /tmp. Rolling that ourselves on top of nginx:alpine
# would mean re-doing all of it by hand.
FROM nginxinc/nginx-unprivileged:alpine

# The base image's default USER is 101; the copies below need to write into /etc/nginx
# and /usr/local/bin, and the files must stay world-readable so uid 101 can serve and
# execute them without owning (and therefore being able to rewrite) them.
USER root

COPY --chown=root:root --chmod=644 ./nginx.conf /etc/nginx/nginx.conf

# curl, and only curl. The image ships busybox, whose wget would nearly do -- but a
# GitHub release asset redirects to another host, and busybox forwards headers across
# that redirect where curl drops them. busybox already provides the sha256sum and tar
# the script needs, and the pin arrives as environment variables rather than a JSON
# file, so there is no jq here either.
RUN apk add --no-cache curl

# Run by the init container in k8s/todo.yaml, which is this same image -- one image
# to build, pull, scan and keep patched rather than a second one alongside it.
COPY --chown=root:root --chmod=755 ./scripts/fetch-bundle.sh /usr/local/bin/fetch-bundle.sh

USER 101

# /usr/share/nginx/html ships EMPTY and is mounted over at runtime by the emptyDir the
# init container unpacks into. The directory has to exist here all the same: the pod
# runs with readOnlyRootFilesystem, and a mount point the container runtime would have
# to create on a read-only root filesystem is a pod that will not start. The base
# image already provides it, with its own index.html and 50x.html inside -- which are
# hidden by the mount, and are what would be served if the manifest ever lost the
# mount, so they are removed rather than left as a plausible-looking wrong answer.
USER root
RUN rm -f /usr/share/nginx/html/index.html /usr/share/nginx/html/50x.html
USER 101

EXPOSE 8080
