# klmToVideo

Application web pour synchroniser des traces GPS (KML) avec des vidéos et générer des overlays personnalisés.

## 🎯 Vue d'ensemble

**klmToVideo** permet de :
- Créer des projets avec upload de traces GPS (KML)
- Gérer des fichiers vidéo avec conversion automatique SD
- Visualiser les traces GPS sur une carte interactive
- Synchroniser la lecture vidéo avec la position GPS
- Générer des overlays vidéo personnalisables avec données GPS en temps réel

## 🚀 Stack technique

- **Backend:** Node.js 22 + TypeScript + Express + FFmpeg
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS
- **Cartes:** Leaflet + OpenStreetMap

## 📋 Prérequis

- Node.js >= 22
- npm
- ffmpeg (pour le traitement vidéo)
- Docker (optionnel)

## 🏗️ Structure

```
trace/
├── guiv2/
│   ├── server/              # Backend Express + TypeScript
│   ├── ui/                  # Frontend React + Vite
│   └── package.json         # Orchestrateur dev (concurrently)
├── Dockerfile               # Production
├── Dockerfile.dev           # Development
├── docker-compose.yml       # Production
└── docker-compose.dev.yml   # Development
```

## 🚀 Démarrage

### Mode développement (local)

```bash
cd guiv2
npm run install:all
npm run dev
```

- **Frontend:** http://localhost:5173
- **API:** http://localhost:3001

### Mode développement (Docker)

**Windows:**
```bash
start-docker-dev.bat
```

**Linux/Mac:**
```bash
chmod +x start-docker-dev.sh
./start-docker-dev.sh
```

- **Frontend:** http://localhost:5173 (Vite avec hot reload)
- **API:** http://localhost:3001

Les sources sont montées en volume, donc toute modification est reflétée instantanément.

### Mode production (Docker)

```bash
docker-compose up -d
```

- **Application:** http://localhost:3001

## 🎮 Utilisation

1. **Créer un workspace** → Upload fichier KML
2. **Upload vidéo** → Conversion SD automatique
3. **Timeline & carte** → Synchronisation GPS
4. **Configurer overlay** → Choisir les données à afficher
5. **Encoder** → Générer vidéo finale avec overlay

## 📊 Variables d'environnement

| Variable | Défaut | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Mode environnement |
| `PORT` | `3001` | Port serveur |
| `WORKSPACE_ROOT` | `./workspace` | Dossier workspace |
| `SD_WIDTH` | `640` | Largeur vidéo SD |
| `SD_CRF` | `28` | Qualité vidéo |
| `MAX_CONCURRENT_JOBS` | `3` | Jobs simultanés |

## 📄 License

MIT

---

**Construit avec ❤️ pour synchroniser KML + Vidéo**