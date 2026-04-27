# 🍽 FoodPrint – Journal Gastronomique IA

Une **PWA** (Progressive Web App) pour photographier, scanner et sauvegarder vos plats de restaurant avec reconnaissance d'ingrédients par IA et génération de recettes complètes.

---

## ✨ Fonctionnalités

### 📷 Scanner IA (fonctionnalité principale)
- **Analyse visuelle** : Photo → Groq Vision (llama-4-scout) identifie les ingrédients, méthode de cuisson, type de plat, allergènes, etc.
- **LogMeal API** (optionnel) : données nutritionnelles complémentaires
- **Recette IA complète** : Groq (llama-3.3-70b) génère une recette en 7 langues avec :
  - Ingrédients + quantités précises
  - Étapes détaillées avec durées et températures
  - Valeurs nutritionnelles
  - Accord mets-vins
  - Astuces du chef
  - Conseils de dressage
  - Variantes de la recette
  - Histoire du plat
  - Matériel nécessaire
- **Vérification utilisateur** : Modifier/valider les ingrédients avant génération
- **Options granulaires** : Niveau de détail, portions (1–12), régimes alimentaires, niveau cuisinier

### 🏪 Gestion des restaurants
- Ajout manuel ou automatique lors du scan
- Géolocalisation GPS + reverse geocoding (OpenStreetMap)
- Lien vers Apple Maps / Google Maps
- Statistiques par restaurant (visites, note moyenne)

### 📋 Journal des plats
- Photo HD + miniature auto-générée
- Catégories (entrée, plat, dessert, boisson, autre)
- Note ★★★★★, prix, tags, notes personnelles
- Favoris
- Partage natif (Web Share API)
- Modification inline

### 🔍 Recherche avancée
- Recherche full-text (nom, restaurant, ingrédients, tags, recette)
- Filtres : catégorie, restaurant, note minimale, favoris, avec recette
- Tri : date, note, prix, alphabétique

### 📊 Statistiques
- KPIs : plats, restaurants, note moyenne, dépenses
- Graphique d'activité mensuelle (6 derniers mois)
- Distribution par type et par note
- Top ingrédients détectés
- Répartition des cuisines
- Classement des restaurants

### 📵 Mode hors-ligne
- Toutes les données stockées localement (IndexedDB via idb)
- Service Worker (Workbox) : cache des assets + fonts
- Navigation, consultation et recherche 100% offline
- Scanner et génération de recettes nécessitent internet

---

## 🚀 Déploiement sur Vercel + GitHub

### 1. Cloner et préparer le dépôt

```bash
# Créer un nouveau repo GitHub et cloner
git clone https://github.com/VOTRE_USER/foodprint.git
cd foodprint

# Copier tous les fichiers du projet ici

# Installer les dépendances
npm install

# Tester en local
npm run dev
```

### 2. Configurer les variables d'environnement Vercel

Dans **Vercel Dashboard → Settings → Environment Variables**, ajouter :

| Variable | Valeur | Obligatoire |
|----------|--------|-------------|
| `GROQ_API_KEY` | `gsk_...` obtenu sur [console.groq.com](https://console.groq.com) | ✅ Oui |
| `LOGMEAL_API_KEY` | clé LogMeal | ❌ Optionnel |

> **Groq** offre un généreux plan gratuit : 14 400 req/jour, 500 000 tokens/minute.

### 3. Déployer sur Vercel

**Option A – Interface Vercel (recommandé) :**
1. Aller sur [vercel.com](https://vercel.com) → "New Project"
2. Importer depuis GitHub
3. Framework : **Vite** (auto-détecté)
4. Build Command : `npm run build`
5. Output Directory : `dist`
6. Ajouter les variables d'environnement
7. Deploy ✅

**Option B – Vercel CLI :**
```bash
npm i -g vercel
vercel --prod
```

### 4. Pousser sur GitHub

```bash
git add .
git commit -m "feat: FoodPrint PWA v1.0"
git push origin main
```
Vercel se redéploie automatiquement à chaque push sur `main`.

---

## 🏗 Structure du projet

```
foodprint/
├── api/
│   ├── analyze.js          # Groq Vision + LogMeal – analyse photo
│   └── recipe.js           # Groq – génération recette complète
├── public/
│   └── icons/              # Icônes PWA (générées auto)
├── scripts/
│   └── generate-icons.js   # Génération des icônes via sharp
├── src/
│   ├── components/
│   │   ├── DishCard.jsx    # Carte plat (grille & liste)
│   │   ├── Layout.jsx      # Navigation bottom bar
│   │   ├── StarRating.jsx  # Composant notation
│   │   └── Toast.jsx       # Notifications
│   ├── pages/
│   │   ├── Dashboard.jsx   # Accueil + stats rapides
│   │   ├── Scanner.jsx     # Scanner IA (wizard 8 étapes)
│   │   ├── Restaurants.jsx # Liste des restaurants
│   │   ├── RestaurantDetail.jsx
│   │   ├── AddDish.jsx     # Ajout manuel
│   │   ├── DishDetail.jsx  # Détail + recette complète
│   │   ├── Search.jsx      # Recherche + filtres
│   │   └── Stats.jsx       # Statistiques & graphiques
│   ├── App.jsx
│   ├── db.js               # IndexedDB (idb) – toute la persistance
│   ├── index.css           # Design system complet
│   └── main.jsx
├── .env.example
├── index.html
├── package.json
├── vercel.json
└── vite.config.js          # PWA + Workbox config
```

---

## 🧩 APIs utilisées

| Service | Usage | Coût |
|---------|-------|------|
| **Groq** (llama-4-scout-17b) | Vision – analyse photos | Gratuit |
| **Groq** (llama-3.3-70b) | Génération de recettes | Gratuit |
| **LogMeal** | Nutrition détaillée (optionnel) | Freemium |
| **Nominatim / OSM** | Reverse geocoding | Gratuit |

---

## 📱 Installation comme app (PWA)

- **iOS** : Safari → Partager → "Sur l'écran d'accueil"
- **Android** : Chrome → Menu → "Ajouter à l'écran d'accueil"
- **Desktop** : Chrome → barre d'adresse → icône d'installation

---

## 🛠 Développement local

```bash
npm run dev          # Dev server avec HMR
npm run build        # Build production
npm run preview      # Preview du build
```

### Variables locales (`.env.local`)
```
GROQ_API_KEY=gsk_votre_cle
LOGMEAL_API_KEY=votre_cle_optionnelle
```

---

## 📄 Licence

CC 4.0
