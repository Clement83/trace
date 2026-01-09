# 🐳 Docker Quick Start

## Démarrage rapide

### Windows
```bash
start-docker.bat
```

### Linux/Mac
```bash
chmod +x start-docker.sh
./start-docker.sh
```

## Commandes essentielles

```bash
# Démarrer
docker-compose up -d

# Arrêter
docker-compose down

# Voir les logs
docker-compose logs -f

# Redémarrer
docker-compose restart

# Rebuild complet
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## URL

**Application:** http://localhost:3001

## Volumes partagés

- `./guiv2/workspace` → Vos projets et vidéos
- `./guiv2/server/uploads` → Uploads temporaires
- `./output` → Fichiers de sortie

## Test

```bash
# Linux/Mac
chmod +x test-docker.sh
./test-docker.sh

# Windows
# Vérifier manuellement: http://localhost:3001/api/health
```

## Makefile (Linux/Mac)

```bash
make help      # Voir toutes les commandes
make build     # Builder l'image
make up        # Démarrer
make logs      # Voir les logs
make shell     # Ouvrir un shell dans le container
```

## Troubleshooting

### Container ne démarre pas
```bash
docker-compose logs
```

### Rebuild from scratch
```bash
docker-compose down -v --rmi all
docker-compose build --no-cache
docker-compose up -d
```

### Accéder au shell
```bash
docker exec -it klmtovideo-app bash
```

### Vérifier FFmpeg
```bash
docker exec klmtovideo-app ffmpeg -version
```
