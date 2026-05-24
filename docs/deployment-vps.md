# Deploiement VPS

Ce guide part du principe que le code est deja sur le VPS et que Docker
ainsi que Docker Compose sont installes.

## 1. Prerequis

- Un domaine pointe vers le VPS
- Docker et Docker Compose installes
- Ports `80` et `443` ouverts pour Nginx
- Acces SSH au serveur

## 2. Recuperer le projet

```bash
git clone <URL_GITHUB> oumarbusiness
cd oumarbusiness
```

Si le projet existe deja :

```bash
git pull origin main
```

## 3. Configurer la production

Creer le fichier `.env.production` a partir de l'exemple :

```bash
cp .env.production.example .env.production
```

Variables minimales a remplir :

- `APP_URL`
- `NEXT_PUBLIC_API_URL`
- `CORS_ORIGINS`
- `NEXTAUTH_SECRET`
- `ENCRYPTION_KEY`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `MINIO_ROOT_USER`
- `MINIO_ROOT_PASSWORD`
- `META_WEBHOOK_VERIFY_TOKEN`

Variables optionnelles selon tes integrations :

- `SERPER_API_KEY`
- `TAVILY_API_KEY`
- `ANTHROPIC_API_KEY`
- `FAL_KEY`
- `META_ACCESS_TOKEN`
- `META_PHONE_NUMBER_ID`

## 4. Verifier la configuration

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production config --quiet
```

## 5. Build et demarrage

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production build api web
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

## 6. Verifier l'etat

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production ps
curl http://127.0.0.1:4000/health
```

Le healthcheck attendu ressemble a ceci :

```json
{"ok":true,"service":"oumar-api","checks":{"api":true,"postgres":true,"redis":true}}
```

## 7. Reverse proxy Nginx

Le `docker-compose.prod.yml` expose seulement :

- `127.0.0.1:1010` pour le web
- `127.0.0.1:4000` pour l'API

Il faut donc mettre Nginx devant.

Exemple minimal :

```nginx
server {
    listen 80;
    server_name votre-domaine.com;

    location / {
        proxy_pass http://127.0.0.1:1010;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name api.votre-domaine.com;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Ensuite, ajoute HTTPS avec Certbot.

## 8. Mise a jour future

```bash
git pull origin main
docker compose -f docker-compose.prod.yml --env-file .env.production build api web
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

## 9. Point important

Le systeme utilisateur ne passe plus par `/api/saas`.
Le backend actif utilise maintenant `/api/sourcing`.
