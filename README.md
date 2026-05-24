# Oumar Business

Plateforme TypeScript monorepo pour Oumar Business :
site public, portail client, back-office admin, WhatsApp, CRM, messagerie, facturation
et systeme sourcing utilisateur avec agents Serper et Tavily.

## Stack

- `apps/web`: Next.js App Router
- `apps/api`: Express + Prisma
- `postgres`: base principale
- `redis`: cache et files
- `minio`: stockage objet local
- `packages/whatsapp-baileys`: integration WhatsApp QR
- `packages/whatsapp-cloud`: integration Meta Cloud API

## Demarrage local

```bash
cp .env.example .env
npm install
docker compose up -d
npm run db:generate
npm run dev
```

Acces local :

- Web : `http://127.0.0.1:1010`
- API : `http://127.0.0.1:4000/health`
- MinIO console : `http://127.0.0.1:9001`

## Parcours visibles

- Public : `/`
- Client : `/client/login`, `/client/register`, `/client/dashboard`
- Utilisateur sourcing : `/user/login`, `/user/register`, `/user/dashboard`
- Admin : `/admin/login`, `/overview`, `/business/sourcing`

## Qualite projet

Commandes utiles avant push :

```bash
npm --workspace @oumar/api run build
cd apps/web && npx tsc --noEmit --pretty false
cd ../..
npm --workspace @oumar/web run build
docker compose config --quiet
npm run prod:config
```

## Production VPS

Les fichiers de production sont deja prepares :

- `docker-compose.prod.yml`
- `.env.production.example`
- `docs/deployment-vps.md`

En production, les services `web` et `api` sont lies a `127.0.0.1` pour etre places derriere Nginx ou un reverse proxy.

## GitHub

Le projet est pret pour GitHub avec une CI simple :

- `.github/workflows/ci.yml`

Le dossier n'etait pas encore un depot Git local au moment de la preparation. Il faut donc encore faire :

```bash
git init -b main
git add .
git commit -m "Initial production-ready setup"
git remote add origin <URL_GITHUB>
git push -u origin main
```
