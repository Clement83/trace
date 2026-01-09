# klmToVideo

Application web moderne pour synchroniser des traces GPS (KML) avec des vidéos et générer des overlays personnalisés.

## 🎯 Vue d'ensemble

**klmToVideo** est une application complète qui permet de :
- Créer des projets workspace avec upload de traces GPS (KML)
- Gérer des fichiers vidéo avec conversion automatique SD (optimisée web)
- Visualiser les traces GPS sur une carte interactive (OpenStreetMap via Leaflet)
- Synchroniser la lecture vidéo avec la position GPS sur la timeline
- **Générer des overlays vidéo personnalisables** avec données GPS en temps réel (vitesse, altitude, coordonnées, temps)
- Suivre la progression des jobs en temps réel via SSE

## 🚀 Choix technologiques

### Backend
- **Node.js 22** + **TypeScript** - Performance et typage fort
- **Express** - Serveur web et API REST
- **fluent-ffmpeg** - Encodage vidéo et conversion SD
- **Canvas** - Génération d'overlays et de cartes
- **fast-xml-parser** - Parsing de fichiers KML

### Frontend
- **React 19** + **TypeScript** - Interface utilisateur moderne
- **Vite** - Build ultra-rapide
- **Tailwind CSS** - Design system utilitaire
- **Leaflet** - Cartes interactives (OpenStreetMap)
- **Lucide React** - Icônes

### Encodage vidéo
- **FFmpeg** - Traitement vidéo haute performance
- **Server-Sent Events (SSE)** - Suivi de progression en temps réel
- **Job queue** - Gestion des tâches d'encodage

## ✨ Fonctionnalités

### Gestion de workspace
- ✅ Création de workspaces avec upload KML
- ✅ Liste et navigation dans les workspaces existants
- ✅ Parsing automatique KML (timestamps, coordonnées, durée)
- ✅ Gestion des métadonnées projet (`meta.json`)

### Traitement vidéo
- ✅ Upload multi-fichiers
- ✅ Génération automatique de versions SD pour le web
- ✅ Traitement en arrière-plan avec suivi de progression
- ✅ Streaming vidéo avec support HTTP Range

### Visualisation interactive
- ✅ **Carte interactive** avec trace GPS (react-leaflet + OpenStreetMap)
- ✅ **Marqueur animé** synchronisé avec la timeline
- ✅ **Timeline scrubber** avec contrôles play/pause
- ✅ Interpolation de position en temps réel

### Overlays vidéo personnalisables
- ✅ **Choix des informations à afficher** via checkboxes
- ✅ **Overlay de données GPS en temps réel** sur les vidéos encodées
- ✅ Options disponibles :
  - Vitesse (km/h)
  - Altitude (mètres)
  - Coordonnées GPS (lat/lon)
  - Timestamp
  - Mini-carte (optionnel)
- ✅ **Boîte d'information semi-transparente** positionnée en bas à gauche
- ✅ **Animations fluides** avec mise à jour 5 FPS
- ✅ **Dimensionnement adaptatif** selon les informations sélectionnées

### Interface moderne
- ✅ Layout basé sur des cards
- ✅ Modales pour création workspace et upload vidéo
- ✅ Barres de progression avec indicateurs de statut
- ✅ Visionneuse de logs extensible
- ✅ Design responsive avec Tailwind CSS
- ✅ Animations et transitions fluides

## 📋 Prérequis

- **Node.js** >= 22
- **npm** ou **yarn**
- **ffmpeg** (requis pour le traitement vidéo)
- **Docker** (optionnel, pour déploiement conteneurisé)

## 🏗️ Structure du projet

```
klmToVideo/
├── guiv2/                    # Application web complète
│   ├── server/              # Backend Node.js + Express
│   │   ├── src/
│   │   │   ├── index.ts                 # Serveur principal, routes, SSE
│   │   │   ├── workers/                 # Workers pour jobs async
│   │   │   │   ├── encodeVideoWorker.ts # Encodage avec overlay
│   │   │   │   └── sdWorker.ts          # Conversion SD
│   │   │   ├── lib/                     # Bibliothèques core
│   │   │   │   ├── kmlParser.ts         # Parsing KML
│   │   │   │   ├── videoOverlay.ts      # Génération overlays
│   │   │   │   └── sdConverter.ts       # Conversion SD
│   │   │   ├── workspace/               # Gestion workspace
│   │   │   └── types/                   # Définitions TypeScript
│   │   └── workspace-template/          # Template nouveau workspace
│   │
│   ├── ui/                  # Frontend React + Vite
│   │   ├── src/
│   │   │   ├── main.tsx                 # App principale avec routing
│   │   │   ├── components/              # Composants UI réutilisables
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Card.tsx
│   │   │   │   ├── Modal.tsx
│   │   │   │   ├── MapView.tsx
│   │   │   │   ├── Timeline.tsx
│   │   │   │   └── ProgressBar.tsx
│   │   │   └── index.css                # Tailwind + styles custom
│   │   └── index.html
│   │
│   └── workspace/           # Workspaces utilisateur (gitignored)
│       └── {projectName}/
│           ├── kml.kml
│           ├── videos/
│           ├── sd/
│           └── meta.json
│
├── Dockerfile               # Image Docker multi-stage
├── docker-compose.yml       # Orchestration Docker
├── Makefile                 # Commandes Docker rapides
└── README.md                # Ce fichier
```

## 🚀 Démarrage rapide

### Option 1: Développement local

#### 1. Installation des dépendances

```bash
cd guiv2

# Installer toutes les dépendances
npm run install:all

# Ou séparément
cd server && npm install
cd ../ui && npm install
```

#### 2. Lancer en mode développement

```bash
# Depuis guiv2/
npm run dev

# Ou séparément dans deux terminaux
cd server && npm run dev
cd ui && npm run dev
```

#### 3. Accéder à l'application

- **Frontend:** http://localhost:5173
- **API:** http://localhost:3001

### Option 2: Docker (recommandé pour production)

#### Démarrage rapide

**Windows:**
```bash
start-docker.bat
```

**Linux/Mac:**
```bash
chmod +x start-docker.sh
./start-docker.sh
```

#### Commandes manuelles

```bash
# Démarrer
docker-compose up -d

# Voir les logs
docker-compose logs -f

# Arrêter
docker-compose down

# Rebuild
docker-compose build --no-cache
docker-compose up -d
```

#### Makefile (Linux/Mac)

```bash
make help      # Voir toutes les commandes
make build     # Builder l'image
make up        # Démarrer
make logs      # Voir les logs
make shell     # Ouvrir shell dans le container
make rebuild   # Clean + rebuild complet
```

#### Accès

**Application complète:** http://localhost:3001

Les volumes suivants sont partagés avec l'hôte :
- `./guiv2/workspace` → Projets et vidéos (persistent)
- `./guiv2/server/uploads` → Uploads temporaires
- `./output` → Fichiers de sortie

## 🎮 Utilisation

### Créer un workspace

1. Cliquer sur **"New Workspace"**
2. Entrer un nom de projet (alphanumérique, tirets, underscores)
3. Uploader un fichier KML avec trace GPS
4. Cliquer **"Create Workspace"**

### Uploader des vidéos

1. Ouvrir un workspace
2. Cliquer **"Upload Video"**
3. Sélectionner un ou plusieurs fichiers vidéo
4. Les vidéos sont automatiquement converties en version SD
5. Suivre la progression dans le panneau **Active Jobs**

### Utiliser la timeline et la carte

- **Timeline Scrubber:** Glisser pour parcourir la trace GPS
- **Play/Pause:** Animation automatique sur la timeline
- **Marqueur carte:** Se synchronise automatiquement avec la timeline (cycliste animé 🚴)
- **Contrôles carte:** Zoom et pan sur la carte interactive

### Configurer l'overlay vidéo

Dans la carte **"Current KML Node"** :
1. Cocher/décocher les informations à afficher sur la vidéo finale :
   - ✅ **Vitesse** (activé par défaut)
   - ☐ **Altitude**
   - ☐ **Coordonnées GPS**
   - ☐ **Temps**
   - ☐ **Mini-carte**
2. Les options sélectionnées sont utilisées lors de l'encodage
3. Prévisualiser les données en temps réel dans la carte pendant la lecture

### Encoder des vidéos

1. Placer la vidéo sur la timeline pour synchroniser avec la trace GPS
2. Sélectionner les options d'overlay dans la carte "Current KML Node"
3. Cliquer **"Encode"** pour la vidéo
4. Suivre la progression dans le panneau **Active Jobs**
5. La vidéo finale inclura une boîte d'info semi-transparente en bas à gauche

### Lire des vidéos

- Attendre que la version SD soit prête (checkmark verte)
- Cliquer **"Play SD Version"** pour streamer la vidéo optimisée

## 📡 API Endpoints

### Workspaces

- `GET /api/workspaces` — Liste tous les workspaces
- `POST /api/workspaces` — Créer workspace (multipart: projectName, kml)
- `GET /api/workspaces/:projectName` — Métadonnées workspace
- `PUT /api/workspaces/:projectName/kml` — Mettre à jour KML
- `DELETE /api/workspaces/:projectName` — Supprimer workspace

### Vidéos

- `POST /api/workspaces/:projectName/videos` — Upload vidéos (multipart)
- `GET /api/workspaces/:projectName/videos` — Liste vidéos
- `GET /api/workspaces/:projectName/videos/:filename/sd` — Stream vidéo SD (avec Range)
- `DELETE /api/workspaces/:projectName/videos/:filename` — Supprimer vidéo

### Jobs & Progression

- `POST /api/encode` — Démarrer job d'encodage
- `GET /api/encode/events/:jobId` — Stream SSE pour progression job
- `DELETE /api/encode/:jobId` — Annuler job en cours
- `GET /api/health` — Health check

### Types d'événements SSE

```typescript
// Mise à jour progression
{ type: "progress", data: { percent: number, message?: string } }

// Message log
{ type: "log", data: { message: string, stream: "stdout" | "stderr" | "system" } }

// Job terminé
{ type: "done", data: { success: boolean, exitCode?: number } }

// Erreur
{ type: "error", data: { message: string } }
```

## 🛠️ Développement

### Build pour production

**Backend:**
```bash
cd guiv2/server
npm run build
# Output: server/dist/
```

**Frontend:**
```bash
cd guiv2/ui
npm run build
# Output: ui/dist/
```

### Linting & Formatting

```bash
# Backend
cd guiv2/server
npm run lint

# Frontend
cd guiv2/ui
npm run lint
npm run format
```

## 🧪 Tests

### Test manuel Docker

```bash
# Linux/Mac
chmod +x test-docker.sh
./test-docker.sh

# Windows - vérifier manuellement
curl http://localhost:3001/api/health
```

### Test workflow API

```bash
# Créer workspace
curl -F "projectName=test-project" \
     -F "kml=@sample.kml" \
     http://localhost:3001/api/workspaces

# Upload vidéo
curl -F "file=@video.mp4" \
     http://localhost:3001/api/workspaces/test-project/videos

# Suivre progression job (SSE)
curl -N http://localhost:3001/api/encode/events/{jobId}

# Stream vidéo SD
curl http://localhost:3001/api/workspaces/test-project/videos/video.mp4/sd \
     --output test_sd.mp4
```

## 📊 Format meta.json

Chaque workspace crée cette structure :

```json
{
  "projectName": "my-ride-2024",
  "createdAt": 1704067200000,
  "kmlSummary": {
    "start": 1704067200000,
    "end": 1704070800000,
    "durationMs": 3600000,
    "coords": [
      { "lat": 48.8566, "lon": 2.3522, "alt": 35 }
    ]
  },
  "videos": [
    {
      "name": "ride.mp4",
      "originalPath": "videos/ride.mp4",
      "sdPath": "sd/ride_sd.mp4",
      "sdExists": true,
      "sizeBytes": 1048576,
      "addedAt": 1704067200000
    }
  ]
}
```

## 🔒 Sécurité

- ✅ Sanitisation des entrées `projectName` (prévention path traversal)
- ✅ Validation type fichiers (vérification MIME)
- ✅ Pas d'injection shell (utilise `spawn` avec tableau args)
- ✅ Fichiers workspace isolés hors dépôt Git
- ⚠️ **TODO:** Ajouter authentification/autorisation pour production
- ⚠️ **TODO:** Ajouter rate limiting pour uploads

## 📝 Variables d'environnement

| Variable | Défaut | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Mode environnement |
| `PORT` | `3001` | Port serveur |
| `WORKSPACE_ROOT` | `./workspace` | Dossier stockage workspace |
| `SD_WIDTH` | `640` | Largeur vidéo SD (hauteur auto) |
| `SD_CRF` | `28` | Qualité vidéo (plus bas = meilleur) |
| `SD_PRESET` | `veryfast` | Preset encodage ffmpeg |
| `SD_AUDIO_BITRATE` | `96k` | Bitrate audio pour SD |
| `MAX_CONCURRENT_JOBS` | `3` | Max jobs simultanés |
| `JOB_CLEANUP_MS` | `30000` | Délai nettoyage jobs (ms) |

## 🗺️ Roadmap

### ✅ Milestone 1 — MVP
- Création et gestion workspace
- Upload vidéo avec génération SD
- Carte interactive avec visualisation GPS
- Synchronisation timeline
- UI moderne avec Tailwind

### ✅ Milestone 2 — Système d'overlay vidéo
- Checkboxes overlay personnalisables UI
- Génération overlay données GPS temps réel
- Rendu boîte info avec canvas
- Intégration FFmpeg pour encodage vidéo
- Marqueur cycliste animé sur carte
- Gestion queue de jobs

### 📅 Milestone 3 — Production Ready
- Authentification & autorisation utilisateurs
- Persistance base de données (SQLite/PostgreSQL)
- Isolation workspace multi-utilisateurs
- Queue de jobs avancée (Bull/BullMQ)
- Génération thumbnails
- UI trimming/édition vidéo
- Fonctionnalité backup & restore

## 🤝 Contribution

Voir `guiv2/WORKPLAN.md` pour les plans de développement détaillés.

## 📄 License

MIT

## 🙏 Crédits

- **React** — Framework UI
- **Node.js** — Runtime JavaScript
- **TypeScript** — Typage statique
- **Leaflet** — Cartes interactives
- **Tailwind CSS** — Framework CSS utilitaire
- **Vite** — Build tool rapide
- **Express** — Framework web
- **FFmpeg** — Traitement vidéo
- **Lucide** — Bibliothèque d'icônes
- **OpenStreetMap** — Tuiles cartographiques

## 📞 Support

Pour questions et problèmes, consulter :
- `guiv2/README.md` — Documentation détaillée application web
- `guiv2/WORKPLAN.md` — Plan de développement et progression
- `DOCKER-QUICKSTART.md` — Guide rapide Docker
- GitHub Issues (si applicable)

---

**Construit avec ❤️ pour une synchronisation KML + Vidéo sans couture**