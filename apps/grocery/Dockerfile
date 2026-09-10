# nginxinc/nginx-unprivileged is the official non-root variant: it runs as
# uid/gid 101, listens on 8080 rather than the privileged 80, and already
# relocates the pid file and every *_temp_path into /tmp, so the container can
# run with a read-only root filesystem given one writable /tmp. Rolling that
# ourselves on top of nginx:alpine would mean re-doing all of it by hand.
FROM nginxinc/nginx-unprivileged:alpine

# The base image's default USER is 101; COPY still needs to write into
# /etc/nginx and the docroot, and the files must stay world-readable so uid 101
# can serve them without owning (and therefore being able to rewrite) them.
USER root

COPY --chown=root:root --chmod=644 ./nginx.conf /etc/nginx/nginx.conf

# Unlike teddyfyi's image, the docroot here is *only* the build output. There are
# no hand-written pages to preserve alongside it, which is why this needs no
# rsync exclude list and cannot silently delete anything.
COPY --chown=root:root ./dist/ /usr/share/nginx/html/

USER 101
EXPOSE 8080
