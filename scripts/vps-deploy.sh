#!/usr/bin/env bash
# بيزارا — rebuild and swap WITHOUT dropping the till.
#
# The old script did `docker rm -f` and then `docker run`, so every deploy left
# a few seconds where Traefik had nothing to route to and the cafe got a 503.
# Mid-service that can land in the middle of a sale.
#
# Now the new container is started and proven to answer BEFORE the old one is
# removed, so there is always a container serving. It also means a broken build
# can no longer take the cafe down: if the new one does not come up, the old
# one is left running and the deploy fails loudly.
set -euo pipefail

cd "$HOME/apps/pizzara/repo"
git fetch --quiet origin main
OLD=$(git rev-parse --short HEAD)
NEW=$(git rev-parse --short origin/main)
[ "$OLD" = "$NEW" ] && exit 0
git reset --quiet --hard origin/main

SUPA=$(grep "^NEXT_PUBLIC_SUPABASE_URL=" "$HOME/apps/pizzara/.env" | cut -d= -f2-)
echo "$(date -Is) building $OLD -> $NEW"
docker build -q --build-arg COMMIT_REF="$NEW" --build-arg NEXT_PUBLIC_SUPABASE_URL="$SUPA" \
  -t "pizzara:$NEW" -t pizzara:latest . >/dev/null

H="pizzara.187.124.112.104.sslip.io"
PROBE="pizzara-probe"
# Two fixed names, alternating. The previous version renamed the new container
# into place, and that rename is a Docker event Traefik reads as "gone, then
# back" — one request failed at exactly that moment in testing. Alternating
# means the live container is never renamed, only started and stopped.
if docker inspect pizzara >/dev/null 2>&1; then LIVE="pizzara"; STAGING="pizzara-b"; else LIVE="pizzara-b"; STAGING="pizzara"; fi
docker rm -f "$STAGING" "$PROBE" >/dev/null 2>&1 || true
echo "$(date -Is) live=$LIVE -> staging=$STAGING"

# Prove the image serves BEFORE it is reachable from the street. Started with
# traefik.enable=false, so a broken build is discovered by us and never by a
# customer; labels cannot be added to a running container, hence the two steps.
docker run -d --name "$PROBE" --network coolify --label traefik.enable=false   --env-file "$HOME/apps/pizzara/.env" "pizzara:$NEW" >/dev/null
PROBE_OK=""
for _ in $(seq 1 40); do
  if docker exec "$PROBE" wget -qO- -T 2 http://127.0.0.1:3000/menu >/dev/null 2>&1; then PROBE_OK=1; break; fi
  sleep 1
done
if [ -z "$PROBE_OK" ]; then
  echo "$(date -Is) NEW BUILD DID NOT ANSWER — keeping $OLD live, nothing was exposed"
  docker logs --tail 20 "$PROBE" 2>&1 | sed "s/^/    /"
  docker rm -f "$PROBE" >/dev/null 2>&1 || true
  git reset --quiet --hard "$OLD"
  exit 1
fi
docker rm -f "$PROBE" >/dev/null 2>&1 || true

# Same labels as the live one: while both run, Traefik simply has two servers
# for one service, which is exactly the overlap we want.
docker run -d --name "$STAGING" --restart unless-stopped --network coolify \
  --env-file "$HOME/apps/pizzara/.env" \
  --label traefik.enable=true --label traefik.docker.network=coolify \
  --label "traefik.http.routers.pizzara-http.entryPoints=http" \
  --label "traefik.http.routers.pizzara-http.rule=Host(\`$H\`)" \
  --label "traefik.http.routers.pizzara-http.middlewares=pizzara-https" \
  --label "traefik.http.middlewares.pizzara-https.redirectscheme.scheme=https" \
  --label "traefik.http.middlewares.pizzara-https.redirectscheme.permanent=true" \
  --label "traefik.http.routers.pizzara-https.entryPoints=https" \
  --label "traefik.http.routers.pizzara-https.rule=Host(\`$H\`)" \
  --label "traefik.http.routers.pizzara-https.tls=true" \
  --label "traefik.http.routers.pizzara-https.tls.certresolver=letsencrypt" \
  --label "traefik.http.routers.pizzara-https.service=pizzara-svc" \
  --label "traefik.http.services.pizzara-svc.loadbalancer.server.port=3000" \
  "pizzara:$NEW" >/dev/null

# Already proven above; this only waits for THIS container to boot.
UP=""
for _ in $(seq 1 30); do
  if docker exec "$STAGING" wget -qO- -T 2 http://127.0.0.1:3000/menu >/dev/null 2>&1; then UP=1; break; fi
  sleep 1
done
if [ -z "$UP" ]; then
  echo "$(date -Is) NEW BUILD DID NOT ANSWER — keeping $OLD live"
  docker logs --tail 20 "$STAGING" 2>&1 | sed "s/^/    /"
  docker rm -f "$STAGING" >/dev/null 2>&1 || true
  git reset --quiet --hard "$OLD"
  exit 1
fi

# The new one is already taking traffic, so removing the old leaves no gap —
# and there is no rename to make Traefik blink.
docker rm -f "$LIVE" >/dev/null 2>&1 || true
docker image prune -f >/dev/null 2>&1 || true
echo "$(date -Is) deployed $NEW"
