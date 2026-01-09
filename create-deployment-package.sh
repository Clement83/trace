#!/bin/bash

# Script pour créer un package de déploiement pour klmToVideo
# =============================================================

set -e

VERSION=${1:-latest}
OUTPUT_DIR="deployment-package"
PACKAGE_NAME="klmtovideo-${VERSION}.tar.gz"

echo "🎁 Création du package de déploiement klmToVideo"
echo "Version: ${VERSION}"
echo "================================================"
echo ""

# Nettoyer le dossier de sortie
if [ -d "$OUTPUT_DIR" ]; then
    echo "🧹 Nettoyage du dossier ${OUTPUT_DIR}..."
    rm -rf "$OUTPUT_DIR"
fi

mkdir -p "$OUTPUT_DIR"

echo "📦 Copie des fichiers nécessaires..."

# Créer la structure
mkdir -p "$OUTPUT_DIR/guiv2/server"
mkdir -p "$OUTPUT_DIR/guiv2/ui"

# Copier les fichiers Docker
cp Dockerfile "$OUTPUT_DIR/"
cp docker-compose.yml "$OUTPUT_DIR/"
cp .dockerignore "$OUTPUT_DIR/"

# Copier les scripts
cp start-docker.sh "$OUTPUT_DIR/"
cp start-docker.bat "$OUTPUT_DIR/"
cp Makefile "$OUTPUT_DIR/" 2>/dev/null || true

# Copier les fichiers du serveur (sans node_modules)
echo "  📁 Serveur..."
cp -r guiv2/server/src "$OUTPUT_DIR/guiv2/server/"
cp guiv2/server/package*.json "$OUTPUT_DIR/guiv2/server/"
cp guiv2/server/tsconfig.json "$OUTPUT_DIR/guiv2/server/"
cp -r guiv2/server/workspace-template "$OUTPUT_DIR/guiv2/server/" 2>/dev/null || true

# Copier les fichiers du UI (sans node_modules)
echo "  📁 Interface..."
cp -r guiv2/ui/src "$OUTPUT_DIR/guiv2/ui/"
cp guiv2/ui/package*.json "$OUTPUT_DIR/guiv2/ui/"
cp guiv2/ui/tsconfig.json "$OUTPUT_DIR/guiv2/ui/"
cp guiv2/ui/vite.config.ts "$OUTPUT_DIR/guiv2/ui/"
cp guiv2/ui/tailwind.config.js "$OUTPUT_DIR/guiv2/ui/"
cp guiv2/ui/postcss.config.js "$OUTPUT_DIR/guiv2/ui/"
cp guiv2/ui/index.html "$OUTPUT_DIR/guiv2/ui/"

# Copier package.json racine
cp guiv2/package*.json "$OUTPUT_DIR/guiv2/"

# Copier les READMEs
cp README.md "$OUTPUT_DIR/"
cp DOCKER-QUICKSTART.md "$OUTPUT_DIR/" 2>/dev/null || true
cp guiv2/README.md "$OUTPUT_DIR/guiv2/" 2>/dev/null || true

# Créer un fichier d'instructions de déploiement
cat > "$OUTPUT_DIR/DEPLOY.md" << 'EOF'
# 🚀 Instructions de déploiement - klmToVideo

## Prérequis sur le serveur

- Docker >= 20.10
- Docker Compose >= 2.0
- Ports disponibles: 3001

## Déploiement rapide

### Linux/Mac
```bash
chmod +x start-docker.sh
./start-docker.sh
```

### Windows
```bash
start-docker.bat
```

### Manuel
```bash
# Builder l'image
docker-compose build

# Démarrer
docker-compose up -d

# Vérifier les logs
docker-compose logs -f

# Vérifier le statut
docker ps | grep klmtovideo
```

## Accès

Application: http://localhost:3001 (ou http://IP-SERVEUR:3001)

## Données persistantes

Les données sont stockées dans les volumes Docker:
- `./guiv2/workspace` - Projets et vidéos utilisateur
- `./guiv2/server/uploads` - Uploads temporaires
- `./output` - Vidéos encodées

⚠️ **Important**: Sauvegarder régulièrement ces dossiers !

## Configuration

Modifier les variables dans `docker-compose.yml`:
- `PORT` - Port d'écoute (défaut: 3001)
- `MAX_CONCURRENT_JOBS` - Jobs simultanés (défaut: 3)
- `SD_WIDTH` - Largeur vidéo SD (défaut: 640)

## Commandes utiles

```bash
# Arrêter
docker-compose down

# Redémarrer
docker-compose restart

# Rebuild après mise à jour
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Voir les logs
docker-compose logs -f

# Shell dans le container
docker exec -it klmtovideo-app bash

# Nettoyer tout
docker-compose down -v --rmi all
```

## Mise à jour

1. Arrêter l'application: `docker-compose down`
2. Extraire le nouveau package
3. Rebuild: `docker-compose build`
4. Redémarrer: `docker-compose up -d`

## Backup

```bash
# Backup workspace
tar -czf backup-workspace-$(date +%Y%m%d).tar.gz guiv2/workspace/

# Restore
tar -xzf backup-workspace-YYYYMMDD.tar.gz
```

## Troubleshooting

### Container ne démarre pas
```bash
docker-compose logs
```

### Port déjà utilisé
Modifier `PORT` dans `docker-compose.yml`

### Manque de ressources
Augmenter les limites dans `docker-compose.yml`:
```yaml
deploy:
  resources:
    limits:
      memory: 8G
      cpus: "6.0"
```

### FFmpeg erreur
Vérifier dans le container:
```bash
docker exec klmtovideo-app ffmpeg -version
```

## Support

Voir README.md pour la documentation complète.
EOF

# Créer le fichier .env.example
cat > "$OUTPUT_DIR/.env.example" << 'EOF'
# Configuration klmToVideo Production
# ====================================

# Port d'écoute
PORT=3001

# Environnement
NODE_ENV=production

# Workspace
WORKSPACE_ROOT=/app/workspace

# Conversion SD
SD_WIDTH=640
SD_CRF=28
SD_PRESET=veryfast
SD_AUDIO_BITRATE=96k

# Jobs
MAX_CONCURRENT_JOBS=3
JOB_CLEANUP_MS=30000
EOF

# Créer l'archive
echo ""
echo "📦 Création de l'archive ${PACKAGE_NAME}..."
cd "$OUTPUT_DIR"
tar -czf "../${PACKAGE_NAME}" .
cd ..

# Calculer la taille
SIZE=$(du -h "${PACKAGE_NAME}" | cut -f1)

echo ""
echo "✅ Package créé avec succès!"
echo "================================================"
echo "📦 Fichier: ${PACKAGE_NAME}"
echo "📏 Taille: ${SIZE}"
echo ""
echo "📋 Contenu du package:"
echo "  - Dockerfile + docker-compose.yml"
echo "  - Code source serveur (TypeScript)"
echo "  - Code source interface (React)"
echo "  - Scripts de démarrage"
echo "  - Documentation de déploiement"
echo ""
echo "🚀 Pour déployer sur le serveur:"
echo "  1. Copier ${PACKAGE_NAME} sur le serveur"
echo "  2. Extraire: tar -xzf ${PACKAGE_NAME}"
echo "  3. Lancer: ./start-docker.sh (ou start-docker.bat sur Windows)"
echo ""
echo "📖 Voir DEPLOY.md pour les instructions complètes"
echo ""

# Nettoyer le dossier temporaire
rm -rf "$OUTPUT_DIR"

echo "🎉 Terminé!"
