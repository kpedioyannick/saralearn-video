# SaraLearn Video API

Service Node.js qui génère automatiquement des vidéos pédagogiques à partir de slides JSON.
Il combine la synthèse vocale **Coqui XTTS v2** (optionnelle) et le rendu vidéo **Remotion** pour produire des fichiers MP4 animés avec sous-titres, musique de fond et contenu Markdown/LaTeX.

## Stack technique

| Couche | Technologie |
|---|---|
| Serveur API | Express 5 + Node.js |
| Rendu vidéo | Remotion 4 (React) |
| Synthèse vocale | Coqui XTTS v2 (Python, optionnel) |
| Markdown | react-markdown + remark-gfm |
| LaTeX | KaTeX (remark-math + rehype-katex) |
| Durée audio | music-metadata |

## Prérequis

- Node.js 18+
- Python 3.10+ + Coqui TTS *(uniquement si narration vocale souhaitée)*

```bash
pip install TTS
```

## Installation

```bash
npm install
```

## Configuration

| Variable d'environnement | Obligatoire | Description |
|---|---|---|
| `XTTS_SPEAKER_WAV` | si TTS activé | Chemin absolu vers le `.wav` de référence (voix à cloner) |
| `SKIP_TTS` | non | `true` pour désactiver la synthèse vocale (mode dev) |
| `XTTS_BIN` | non | Binaire TTS (défaut : `tts`) |
| `HOST` | non | URL publique de l'API (défaut : `http://localhost:3457`) |
| `PORT` | non | Port du serveur (défaut : `3457`) |

## Démarrer

```bash
# Avec narration vocale
export XTTS_SPEAKER_WAV=/chemin/absolu/vers/voice.wav
npm start

# Sans narration (mode dev)
SKIP_TTS=true npm start
```

API disponible sur `http://localhost:3457`.

## Musique de fond

Dépose des fichiers `.mp3` ou `.wav` dans le dossier `son/` à la racine du projet.
Un fichier est sélectionné aléatoirement à chaque génération et joué en fond sonore (volume 40%).

```
son/
  BriseDouce.wav
  BureauenDanse.wav
  ...
```

## Endpoints

### `GET /health`

```json
{ "ok": true, "service": "saralearn-video-api" }
```

### `POST /api/videos`

Soumet un job de génération. Réponse immédiate (202), rendu en arrière-plan.

**Body JSON :**

```json
{
  "title": "Cours de fractions",
  "format": "portrait",
  "wordByWord": true,
  "language": "fr",
  "slides": [
    {
      "id": "slide-1",
      "title": "📐 Définition",
      "description": "Une **fraction** représente une *partie* d'un tout.\n\nFormule : $\\frac{a}{b}$ avec $b \\neq 0$",
      "subtitlesSrt": "1\n00:00:00,000 --> 00:00:04,000\nUne fraction représente une partie d'un tout.\n"
    }
  ]
}
```

**Paramètres :**

| Champ | Type | Défaut | Description |
|---|---|---|---|
| `title` | string | `"Video pedagogique"` | Titre affiché en haut à droite |
| `format` | string | `"landscape"` | Format vidéo (voir tableau ci-dessous) |
| `wordByWord` | boolean | `false` | Animation mot par mot des sous-titres |
| `language` | string | `"fr"` | Langue TTS |
| `slides` | array | — | Tableau de slides (obligatoire, min. 1) |
| `slides[].id` | string | — | Identifiant de la slide |
| `slides[].title` | string | — | Titre de la slide (texte brut) |
| `slides[].description` | string | — | Corps de la slide (**Markdown** supporté) |
| `slides[].subtitlesSrt` | string | — | Sous-titres en SRT ou texte simple |

### Formats vidéo

| Valeur | Résolution | Usage |
|---|---|---|
| `landscape` *(défaut)* | 1920 × 1080 | YouTube, desktop (16:9) |
| `portrait` | 1080 × 1920 | TikTok, Reels, YouTube Shorts, mobile (9:16) |
| `square` | 1080 × 1080 | Instagram posts (1:1) |

### Animation `wordByWord`

| Valeur | Comportement |
|---|---|
| `false` *(défaut)* | Ligne de sous-titre affichée en entier |
| `true` | Chaque mot apparaît un par un avec fondu + glissement vers le haut |

### Markdown dans `description`

Le champ `description` supporte le Markdown complet :

| Syntaxe | Exemple |
|---|---|
| Gras / italique | `**gras**` / `*italique*` |
| Emojis | `📐 ✅ 🎯` (Unicode natif) |
| LaTeX inline | `$\frac{a}{b}$` |
| LaTeX bloc | `$$E = mc^2$$` |
| Tableau | syntaxe `\|col\|col\|` GFM |
| Listes | `- item` / `1. item` |
| Code | `` `code` `` |
| Titres | `## Titre` |

### `subtitlesSrt` — deux formats acceptés

- **SRT complet** (avec timecodes) : sous-titres synchronisés frame par frame
- **Texte simple** (sans timecodes) : affiché pendant toute la durée de la slide

**Réponse 202 :**

```json
{
  "videoId": "1713871711-ab12cd",
  "status": "queued",
  "statusUrl": "http://localhost:3457/api/videos/1713871711-ab12cd"
}
```

### `GET /api/videos/:id`

| Statut | Description |
|---|---|
| `queued` | En attente |
| `rendering` | Synthèse vocale et rendu en cours |
| `done` | Vidéo disponible (`videoUrl` présent) |
| `error` | Échec (`error` présent, message guidé) |

### `GET /videos/:file.mp4`
### `GET /audio/:jobId/:file.wav`
### `GET /son/:file`

## Pipeline de génération

1. **Synthèse vocale** — XTTS v2 génère un `.wav` par slide (ignoré si `SKIP_TTS=true`)
2. **Musique de fond** — un fichier aléatoire de `son/` est sélectionné
3. **Bundle Remotion** — compilation webpack de la composition React
4. **Rendu vidéo** — Remotion compose les slides (titre, Markdown, sous-titres, audio) et exporte en MP4 h264 aux dimensions du format choisi

## Structure du projet

```
server.js                        ← API Express, gestion des jobs
remotion-entry.jsx               ← entrée du bundle Remotion
son/                             ← fichiers audio de fond (.mp3 / .wav)
src/
  lib/
    tts-xtts.js                  ← appel CLI Coqui TTS (messages d'erreur guidés)
    audio-duration.js            ← lecture durée audio
    srt.js                       ← parsing sous-titres SRT
  remotion/
    Root.jsx                     ← composition Remotion (dimensions dynamiques)
    PedagogicalVideo.jsx         ← composant vidéo (slides, Markdown, animations)
public/
  videos/                        ← MP4 générés
  audio/                         ← WAV intermédiaires XTTS
```

## Exemple complet

```bash
# 1. Soumettre un job
RESPONSE=$(curl -s -X POST http://localhost:3457/api/videos \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Cours de fractions",
    "format": "portrait",
    "wordByWord": true,
    "slides": [
      {
        "title": "📐 Définition",
        "description": "Une **fraction** représente une *partie* d un tout.\n\nFormule : $\\frac{a}{b}$ avec $b \\neq 0$",
        "subtitlesSrt": "1\n00:00:00,000 --> 00:00:04,000\nUne fraction représente une partie d un tout.\n"
      },
      {
        "title": "📊 Comparaison",
        "description": "| Fraction | Valeur |\n|---|---|\n| $\\frac{1}{2}$ | 0.5 |\n| $\\frac{1}{4}$ | 0.25 |",
        "subtitlesSrt": "Voici quelques fractions courantes."
      }
    ]
  }')

VIDEO_ID=$(echo $RESPONSE | grep -o '"videoId":"[^"]*"' | cut -d'"' -f4)

# 2. Vérifier le statut
curl http://localhost:3457/api/videos/$VIDEO_ID

# 3. Télécharger la vidéo une fois status=done
curl -O http://localhost:3457/videos/$VIDEO_ID.mp4
```
