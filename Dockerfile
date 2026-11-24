# بيزارا كافيه — self-hosted image (Coolify/Traefik on the owner's VPS).
#
# Netlify's free tier caps serverless invocations, and a POS left open all day
# blows past it — that is what suspended the hosting twice. On our own server
# there is no per-request meter at all, so the screens can poll as often as the
# counter actually needs.
#
# next.config.ts emits `output: "standalone"` whenever NETLIFY/VERCEL/RENDER are
# unset, which is the case here, so the build produces its own server.js.

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Two values must be present at BUILD time, both public, neither a secret:
#   COMMIT_REF              — baked into server and client so «يتوفر تحديث» can
#                             tell one deploy from the next (next.config.ts).
#   NEXT_PUBLIC_SUPABASE_URL — next.config.ts builds the /img/* rewrite from it;
#                             without it every product image 404s. (On Netlify
#                             that rewrite came from netlify.toml instead.)
# Everything else — the service-role key included — is read at RUNTIME, so no
# secret is ever baked into this image.
ARG COMMIT_REF=dev
ARG NEXT_PUBLIC_SUPABASE_URL=""
ENV COMMIT_REF=$COMMIT_REF
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# standalone ships its own minimal node_modules; static and public are not in it
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
