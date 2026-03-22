# Polyforge — Roadmap v1

> 36 semaines · 7 phases · ~2 développeurs seniors  
> Cliquez sur un lien du sommaire pour naviguer directement vers la phase.

---

## Sommaire

| Phase | Titre | Durée | Semaines |
|---|---|---|---|
| [Phase 1](#phase-1--fondations) | Fondations | 3 semaines | S1–S3 |
| [Phase 2](#phase-2--auth--données-marché) | Auth & Données Marché | 3 semaines | S4–S6 |
| [Phase 3](#phase-3--chemin-critique-trading) | Chemin critique trading 🔴 | 6 semaines | S7–S12 |
| [Phase 4](#phase-4--api--paper--backtest) | API & Paper & Backtest | 5 semaines | S13–S17 |
| [Phase 5](#phase-5--angular-user-app) | Angular User App 🔴 | 10 semaines | S18–S27 |
| [Phase 6](#phase-6--admin-bots--notifications) | Admin, Bots & Notifications | 5 semaines | S28–S32 |
| [Phase 7](#phase-7--qa--production) | QA & Production | 4 semaines | S33–S36 |
| [Phase 8](#phase-8--competitive-features-post-launch) | Competitive Features (Post-Launch) | ongoing | Post-S36 |

---

## Timeline globale

```
S01 S02 S03 S04 S05 S06 S07 S08 S09 S10 S11 S12 S13 S14 S15 S16 S17 S18 S19 S20 S21 S22 S23 S24 S25 S26 S27 S28 S29 S30 S31 S32 S33 S34 S35 S36
[── Phase 1 ──][──── Phase 2 ────][──────────── Phase 3 ────────────][──────── Phase 4 ────────][──────────────────── Phase 5 ──────────────────────][──────── Phase 6 ────────][──── Phase 7 ────]
  Fondations     Auth & Données         Chemin critique                API + Paper + Backtest              Angular User App                          Admin + Bots + Notifs      QA & Prod
```

---

## Phase 1 — Fondations

**Semaines 1–3 · 3 semaines**

Rien ne peut démarrer sans cette phase. Elle établit l'environnement de développement, la structure du monorepo, la base de données, et le mock Polymarket qui remplace l'API réelle en développement.

### Monorepo & infrastructure `S1–S2` `CRITIQUE`

- Turborepo + npm workspaces configurés
- `tsconfig.base.json` partagé + eslint commun
- Tous les packages partagés créés et compilables :
  - `shared-types` — toutes les interfaces TypeScript et enums
  - `shared-schemas` — schémas Zod de validation
  - `shared-auth` — guards JWT + client service-to-service
  - `shared-db` — module NestJS Prisma
  - `shared-redis` — factory ioredis + helpers streams
  - `logger` — pino + nestjs-pino
- `docker-compose.dev.yml` complet (Postgres + TimescaleDB, PgBouncer, Redis, Nginx, MailHog)
- `.env.example` documenté avec toutes les variables
- Pipeline CI/CD GitHub Actions : lint → typecheck → test → build

### Prisma schema + migrations `S2` `CRITIQUE`

- `schema.prisma` complet (29 tables — auth + trading + analytics)
- Migration initiale appliquée
- Hypertables TimescaleDB (`price_snapshots`, `portfolio_snapshots`)
- Indexes critiques en place
- Script `seed.ts` (5 comptes + données de test cohérentes)

### mock-polymarket `S3` `CRITIQUE`

- REST mock : Gamma API, CLOB API, Data API
- WebSocket mock : price feed temps réel, order book updates, order lifecycle events
- 5 scénarios configurables via `SCENARIO` dans `.env` : `normal`, `volatile`, `api_down`, `rate_limited`, `slow`
- 10 marchés fixtures alignés avec les données du seed

### ✅ Livrable de fin de phase

L'environnement local tourne intégralement. Un développeur qui clone le repo peut exécuter `docker compose up` + `npm run migrate` + `npm run seed` et obtenir un environnement fonctionnel en moins de 10 minutes.

---

## Phase 2 — Auth & Données Marché

**Semaines 4–6 · 3 semaines**

Les deux services fondamentaux dont dépendent tous les autres : la gestion des comptes utilisateurs et l'alimentation en données de marché temps réel.

### auth-service `S4–S5` `CRITIQUE`

- Inscription + vérification email (MailHog en dev, SES en prod)
- Login + émission JWT (7 jours)
- Reset password (token single-use, TTL 1h, réponse neutre anti-énumération)
- 2FA/TOTP complet : setup (QR + secret), confirm, 10 backup codes, disable
- Import credentials Polymarket (chiffrement AES-256-GCM, validation contre l'API mock)
- Suppression credentials (stop de toutes les stratégies actives en premier)
- Bot-link (code 6 chiffres, TTL 5 min)
- Rate limiting par IP sur toutes les routes sensibles

### market-data-service `S5–S6` `CRITIQUE`

- Connexion WebSocket Polymarket avec reconnect exponentiel (backoff 1s → 30s max)
- Écriture continue dans `price_snapshots` (TimescaleDB)
- Écriture cache Redis : prix par token (TTL 10s) + order book (TTL 5s)
- Détection et enregistrement des data gaps dans `data_gaps`
- Monitoring des marchés en cours de résolution (pour positions ouvertes)
- Filtre v1 : marchés binaires uniquement (neg-risk exclus)

### admin-auth-service `S6`

- Login admin (IP allowlist appliqué par Nginx)
- JWT admin (TTL 1 heure)
- Logout avec invalidation Redis immédiate

### ✅ Livrable de fin de phase

Un utilisateur peut s'inscrire, vérifier son email, activer la 2FA, et importer ses credentials Polymarket. Les prix de tous les marchés actifs sont disponibles en cache Redis en temps réel.

---

## Phase 3 — Chemin critique trading

**Semaines 7–12 · 6 semaines · 🔴 Phase la plus risquée**

Le cœur technique du produit. Ces trois services constituent la chaîne de valeur principale : signature → soumission → exécution. Rien du trading (live ou paper) ne fonctionne sans eux. Prévoir **+2 semaines de marge** sur cette phase.

### signer-service `S7–S8` `CRITIQUE`

- Vault chiffré : déchiffrement DEK uniquement à la demande, jamais persisté en clair
- EIP712 signing avec `@polymarket/clob-client`
- Attribution builder HMAC ajoutée à chaque ordre (Builder Program)
- Isolation réseau stricte : réseau `signer-only` uniquement
- Credentials utilisateur jamais loggés, jamais exposés hors du service

### order-service `S8–S9` `CRITIQUE`

- Consommation depuis Redis Stream `strategy.orders`
- Batching : jusqu'à 15 ordres par soumission vers le CLOB
- Cycle de vie complet des ordres :
  ```
  PENDING → SUBMITTED → LIVE → MATCHED → DELAYED → MINED → CONFIRMED
                                                   → PARTIAL
                                                   → CANCELLED
                                                   → UNMATCHED
                                                   → FAILED
                                                   → ERROR
  ```
- Retry avec backoff exponentiel (3 tentatives), puis DLQ
- Publication WebSocket : `ORDER_PLACED`, `ORDER_SUBMITTED`, `ORDER_FILLED`, `ORDER_PARTIAL`, `ORDER_CANCELLED`, `ORDER_FAILED`, `ORDER_ERROR`
- Close position manuelle (FOK sell, taille partielle supportée)

### strategy-engine `S9–S12` `CRITIQUE`

- Tick loop (floor 200ms — toute valeur inférieure est ignorée)
- Event loop (triggers basés sur événements prix Redis)
- Évaluation des blocs dans l'ordre imposé : **SAFETY → TRIGGER → CONDITION → ACTION**
- Implémentation des 36 blocs :

**SAFETY (6 blocs) :**

| Bloc | Comportement |
|---|---|
| `stop_if_daily_loss` | Arrête la stratégie si perte > seuil USDC/jour |
| `stop_if_orders_per_min` | Arrête si débit d'ordres > seuil/min |
| `stop_if_consecutive_loss` | Arrête après N trades perdants consécutifs |
| `stop_if_exposure_exceeds` | Arrête si exposition totale > seuil USDC |
| `pause_after_fill` | Pause N ms après chaque fill |
| `max_orders_total` | Arrête après N ordres total |

**TRIGGERS EVENT (6 blocs) :**

| Bloc | Comportement |
|---|---|
| `new_bet_opens` | Fire quand un nouveau marché s'ouvre dans une série |
| `price_crosses_up` | Fire quand le prix franchit un seuil vers le haut |
| `price_crosses_down` | Fire quand le prix franchit un seuil vers le bas |
| `time_before_close` | Fire N minutes avant la fermeture du marché |
| `win_streak` | Fire après N wins consécutifs |
| `loss_streak` | Fire après N losses consécutifs |

**TRIGGERS TICK (7 blocs) :**

| Bloc | Comportement |
|---|---|
| `price_above_tick` | Vrai si prix > seuil au tick courant |
| `price_below_tick` | Vrai si prix < seuil au tick courant |
| `spread_below_tick` | Vrai si spread < seuil |
| `volume_rate_tick` | Vrai si taux de volume > seuil |
| `price_momentum_tick` | Vrai si momentum dépasse un seuil dans une direction |
| `rsi_threshold_tick` | Vrai si RSI (période configurable) dépasse un niveau |
| `every_tick` | Toujours vrai — fire à chaque tick |

**CONDITIONS (9 blocs) :**

| Bloc | Comportement |
|---|---|
| `min_liquidity` | Passe si liquidité order book ≥ seuil USDC |
| `max_position` | Passe si position courante < seuil USDC |
| `max_bets_per_day` | Passe si nb trades aujourd'hui < max |
| `daily_loss_limit` | Passe si perte du jour < seuil USDC |
| `cooldown_after_trade` | Passe si délai depuis dernier trade > N ms |
| `price_in_range` | Passe si prix entre min et max |
| `no_reentry` | Passe si ce marché n'a pas été tradé aujourd'hui |
| `no_existing_position` | Passe si aucune position ouverte sur ce token |
| `time_window` | Passe si heure courante entre start et end |

**ACTIONS (8 blocs) :**

| Bloc | Comportement |
|---|---|
| `buy_yes` | Place un ordre d'achat YES (GTC, GTD, FOK, FAK) |
| `buy_no` | Place un ordre d'achat NO |
| `set_stop_loss` | Place un stop-loss en % du prix d'entrée |
| `take_profit` | Place un take-profit en % du prix d'entrée |
| `scale_in` | Achète une taille additionnelle sur une position existante |
| `scale_out` | Vend une partie d'une position existante |
| `cancel_all_orders` | Annule tous les ordres ouverts sur ce marché |
| `skip_bet` | Skip explicite du tick (pour le logging) |

- Stale data detection : si cache Redis > 5s, la stratégie se met en pause automatiquement
- Publication `OrderIntent` vers Redis Stream après évaluation ACTION
- Start / Stop / Pause / Resume par stratégie individuelle

### ✅ Livrable de fin de phase

Une stratégie simple (`price_crosses_up` → `buy_yes`) peut être démarrée et place un vrai ordre sur mock-polymarket. Le cycle de vie complet de l'ordre (PENDING → CONFIRMED) est observable en temps réel via les logs.

---

## Phase 4 — API & Paper & Backtest

**Semaines 13–17 · 5 semaines**

Tous les endpoints REST et WebSocket de l'api-service, le paper trading, le backtesting, et la configuration du pipeline openapi-generator-cli qui génèrera les clients Angular.

### paper-order-service `S13`

- Simulation de fills basée sur les prix réels du cache Redis
- Price improvement appliqué quand possible (meilleur prix du book)
- P&L paper calculé et stocké séparément du P&L réel
- Reset paper : efface positions + ordres + P&L en une commande

### backtest-service `S13–S15`

- Replay historique sur `price_snapshots` TimescaleDB
- Queue asynchrone (BullMQ) + progress via WebSocket (`BACKTEST_PROGRESS`, 0–100%)
- Quick mode : synchrone, 7 derniers jours, résultat inline (depuis le strategy builder)
- Métriques complètes : P&L total, win rate, max drawdown, ratio Sharpe, equity curve
- Signalement des data gaps : "⚠ Données manquantes — résultats potentiellement inexacts"
- Historique des runs par stratégie (statut, config, résultats)

### api-service — REST lot 1 : core `S14–S16` `CRITIQUE`

- `GET /markets` (liste paginée, filtre series, search, sort)
- `GET /markets/:id` (détail + description complète)
- `GET /markets/:tokenId/price-history` (OHLCV, résolutions 1m/1h/1d)
- `GET /markets/:tokenId/book` (order book temps réel)
- `GET/POST /strategies` (liste + création)
- `GET/PATCH/DELETE /strategies/:id`
- `POST /strategies/:id/start|stop|pause|resume|fork|like`
- `GET/POST/DELETE /strategies/:id/comments`
- `POST /strategies/:id/report`
- `GET /strategies/templates`
- `GET /api/v1/discover` (feed public, sort: popular/newest/top_pnl/most_forked)
- `GET /api/v1/leaderboard` (P&L, filtrable par période)
- `GET /orders` + `POST /orders/close-position`
- `GET /portfolio` + `GET /portfolio/pnl`
- `GET/POST/DELETE /alerts` (max 50 par utilisateur)
- `GET /paper/summary` + `POST /paper/reset`
- `GET/POST /backtests` + `GET /backtests/:id`

### api-service — REST lot 2 : social & settings `S16–S17`

- `GET /profile/:username` + `POST /profile/:username/follow`
- `PATCH /settings/profile` + `/settings/notifications` + `/settings/password`
- `GET /auth/v1/me`
- Pipeline OpenAPI : `swagger.json` généré depuis les décorateurs NestJS, `openapi-generator-cli` configuré, clients Angular générés et commitables

### api-service — WebSocket `S17` `CRITIQUE`

- Auth : `AUTH` → `AUTH_OK` / `AUTH_ERROR`
- Prices : `SUBSCRIBE_PRICES` / `UNSUBSCRIBE_PRICES` → `PRICE_UPDATE` (par tick)
- Stratégies : `SUBSCRIBE_STRATEGY` → `STRATEGY_STARTED`, `STRATEGY_STOPPED`, `STRATEGY_PAUSED`, `STRATEGY_RESUMED`, `STRATEGY_ERROR`
- Ordres : `ORDER_PLACED`, `ORDER_SUBMITTED`, `ORDER_FILLED`, `ORDER_PARTIAL`, `ORDER_CANCELLED`, `ORDER_FAILED`, `ORDER_ERROR`
- Backtests : `BACKTEST_PROGRESS`, `BACKTEST_COMPLETED`, `BACKTEST_FAILED`
- Marchés : `MARKET_RESOLVING`, `MARKET_RESOLVED`
- Alertes : `PRICE_ALERT_TRIGGERED`
- Positions : `POSITION_CLOSED`, `POSITION_REDEEMED`
- Notifications in-app : `NOTIFICATION`
- Keepalive : `PING` / `PONG`

### ✅ Livrable de fin de phase

Toutes les API backend sont fonctionnelles et testées contre mock-polymarket. Le pipeline `npm run generate:api` génère les clients Angular typés. Paper trading et backtest sont opérationnels.

---

## Phase 5 — Angular User App

**Semaines 18–27 · 10 semaines · 🔴 Strategy builder = composant le plus complexe**

L'application utilisateur est développée de l'intérieur vers l'extérieur : fondations → auth → pages critiques → social.

### Setup Angular + fondations `S18` `CRITIQUE`

- Routing complet avec guards : `AuthGuard`, `ConnectedGuard`, `VerifiedGuard`
- PrimeNG theme configuré + design system (couleurs, typographie, composants communs)
- Tous les services OpenAPI importés depuis `api/` (générés en phase 4)
- `WebSocketService` singleton avec reconnect automatique
- `AuthInterceptor` (injection Bearer token)
- `ErrorInterceptor` (401 → logout, 422 → toast, 500 → notification)
- Layout global : sidebar, topbar, cloche de notifications

### Pages d'auth `S18–S19` `CRITIQUE`

- Register, Login, Verify email, Forgot password, Reset password
- 2FA setup : QR code + saisie du code de confirmation + affichage des backup codes
- Import credentials Polymarket : stepper guidé (API Key → Secret → Passphrase → Wallet → Confirm)

### Market browser `S19–S20`

- Liste des marchés paginée (filtre series, search, sort, pagination)
- Détail marché : description, prix YES/NO, order book live (WebSocket)
- Composant chart OHLCV avec sélecteur de résolution (1m / 1h / 1d)
- Bouton "Créer une alerte" depuis le détail marché

### Strategy Builder `S20–S23` `CRITIQUE`

- Canvas drag-and-drop organisé en 4 colonnes : SAFETY / TRIGGER / CONDITION / ACTION
- Palette latérale de 36 blocs avec icône, nom, description courte
- Panel de configuration contextuel par bloc (market picker, number inputs, selects, sliders)
- Validation temps réel des combinaisons (ex: action sans trigger → erreur)
- Quick backtest intégré : bouton → panel résultats inline (P&L, win rate, data gaps)
- Sélecteur de templates (pre-fill le canvas)
- Sauvegarde avec incrémentation automatique de version
- Mode lecture pour les stratégies publiques (blocs visibles mais non éditables si UNLISTED)
- Paramètres stratégie : nom, description, mode (EVENT/TICK/HYBRID), tickMs, visibilité, tags

### Strategy management `S23–S24` `CRITIQUE`

- Liste des stratégies personnelles (filtres statut, sort)
- Badges de statut temps réel via WebSocket : `RUNNING` (vert), `PAUSED` (orange), `IDLE` (gris)
- Actions rapides : start, stop, pause, resume, edit, fork, delete
- Panneau d'exécution live : logs des ticks, erreurs de blocs, dernier ordre

### Portfolio & Orders `S24–S25` `CRITIQUE`

- Dashboard portfolio : positions ouvertes, unrealized P&L par position, total P&L
- Bouton "Close position" (saisie de taille optionnelle pour fermeture partielle)
- Graphique P&L dans le temps (filtres : 7j / 30j / 90j / tout, par stratégie)
- Tableau des ordres : statut, marché, side, size, fill price, fees, timestamps
- Onglet Paper trading : résumé + reset
- Positions résolues : statut REDEEMED + hash transaction

### Social & Discover `S25–S26`

- Feed Discover : cartes stratégies avec like, fork, lien vers l'auteur
- Tri : popular / newest / top P&L / most forked
- Filtre par catégorie de marché
- Leaderboard : tabs P&L / win rate / most forked / most followers (filtres période)
- Profil public : stratégies publiques, stats (opt-in), follow/unfollow
- Commentaires sur stratégies (ajout, suppression des siens)
- Bouton Signaler sur stratégies et commentaires

### Settings & Notifications `S26–S27`

- Page Settings complète : profil, sécurité (2FA, password), notifications, credentials
- Centre de notifications : cloche avec badge, liste, marquer comme lu, effacer
- Gestion alertes de prix : liste, créer (token, direction, seuil), supprimer
- Page Backtests : lancer un run, barre de progression live, résultats complets, historique

### ✅ Livrable de fin de phase

L'application utilisateur est complète et utilisable de bout en bout, du register au live trading avec stratégies complexes.

---

## Phase 6 — Admin, Bots & Notifications

**Semaines 28–32 · 5 semaines**

Les services périphériques importants mais non bloquants pour le cœur du produit.

### notification-service `S28–S29`

- Email via AWS SES : templates transactionnels (vérification, reset, 2FA) + trading (fill, erreur, résolution)
- Dispatch in-app via WebSocket (`NOTIFICATION` event)
- Préférences par canal (email, Telegram, Discord) et par type d'événement
- Seuil minimum de fill pour notification (ex: ne notifier que les fills > 10 USDC)
- Modes de fréquence : immédiat, digest horaire, digest quotidien
- Fallback si canal indisponible (log + retry)

### bot-service `S29–S30`

- Linking flow : `/connect <code>` → vérification du code → JWT bot 30 jours
- 15 commandes disponibles :

| Commande | Description |
|---|---|
| `/start` | Message de bienvenue + instructions |
| `/connect <code>` | Lier le compte Polyforge |
| `/status` | Toutes les stratégies actives + P&L courant |
| `/stop <nom>` | Arrêter une stratégie |
| `/pause <nom>` | Mettre en pause |
| `/resume <nom>` | Reprendre |
| `/pnl` | P&L du jour toutes stratégies |
| `/pnl <nom>` | P&L d'une stratégie spécifique |
| `/orders` | 5 derniers ordres |
| `/positions` | Positions ouvertes |
| `/paper` | Résumé paper trading |
| `/alerts` | Gérer les alertes de prix |
| `/disconnect` | Délier le compte |
| `/help` | Liste des commandes |

- Push notifications : fills, erreurs, alertes prix, résolutions de marchés
- `/disconnect` → révocation JWT immédiate dans Redis

### admin-api-service `S29–S31`

- Health dashboard : statut de tous les services + latence + métriques CloudWatch
- Users : liste, search, détail, suspend/unsuspend, modification des limites, suppression soft
- Strategies : liste globale, force-stop, unpublish
- Orders : monitoring temps réel, DLQ viewer (orders bloqués)
- Backtest queue : liste des jobs, annulation
- Cache dashboard : hit rate par pattern de clé, invalidation manuelle
- Rate limits Polymarket : consommation du budget API, historique des événements 429
- Content moderation : queue des signalements (≥1 signalement), approve/remove
  - Auto-masqué à ≥3 signalements (visible séparément dans "En attente de review")
  - Notifier le rapporteur de la décision
- Builder Program : volume attribué, tier actuel, rewards, historique hebdomadaire
- Logs : audit (immuable), events, logins, notifications

### Angular admin-app `S31–S32`

- Health dashboard avec indicateurs visuels (vert/orange/rouge par service)
- Toutes les vues admin avec tableaux, filtres, pagination
- Interface de modération : approve (bouton vert) / remove (bouton rouge) par rapport
- Builder Program dashboard avec graphique de volume hebdomadaire
- Log viewers avec filtres et export CSV

### ✅ Livrable de fin de phase

Les notifications fonctionnent sur tous les canaux. Les bots Telegram et Discord répondent à toutes les commandes. L'admin panel permet de gérer intégralement la plateforme.

---

## Phase 7 — QA & Production

**Semaines 33–36 · 4 semaines**

Tests, sécurité, infrastructure AWS, et go-live.

### Tests & qualité `S33–S34` `CRITIQUE`

- Tests unitaires strategy-engine : couverture des 36 blocs, edge cases (stale data, circuit breakers en cascade)
- Tests d'intégration : auth-service + signer-service + order-service end-to-end
- Tests e2e Playwright : parcours complet register → import credentials → créer stratégie → start → order filled
- Tests de charge : 100 stratégies en parallèle, 1000 ticks/seconde
- Tests de résilience : scénario `api_down`, comportement DLQ, reconnect WebSocket
- Audit de sécurité : credentials jamais en clair dans les logs, JWT rotation, rate limits, IP allowlist admin

### Setup infrastructure AWS `S33–S35` `CRITIQUE`

- EC2 (t3.medium minimum) avec Elastic IP
- RDS PostgreSQL 16 + TimescaleDB
- ElastiCache Redis 7
- ECR : un repository par service (14 au total)
- AWS Secrets Manager : les 14 secrets de production (JWT secrets, master encryption key, SES, Polymarket builder, bots)
- SES : vérification de domaine + accès production demandé (délai AWS ~24h)
- IAM role EC2 : least privilege (SES + Secrets Manager uniquement)
- Security groups : 80/443 public, tout le reste interne
- CloudWatch : log groups par service + alarms (CPU, erreurs 5xx, DLQ depth)
- DNS : `polyforge.app` + `admin.polyforge.app` → Elastic IP + SPF/DKIM/DMARC

### Go-live `S35–S36` `CRITIQUE`

- Builder Program Polymarket : account créé et inscription soumise **avant cette phase** (délai externe non maîtrisable — à initier dès la Phase 3)
- `docker-compose.prod.yml` déployé sur EC2
- Migrations production appliquées (pas de seed — vraies données uniquement)
- Smoke tests sur prod : register → login → browse markets → 2FA → import credentials
- Pages légales en ligne : `/terms` et `/privacy`
- Monitoring 48h intensif post-launch
- Soft launch : accès sur invitation (liste d'attente) avant ouverture publique

### ✅ Livrable final

🚀 Polyforge v1 est en production. Builder Program actif. Monitoring en place. Soft launch ouvert.

---

## Zones de risque

### 🔴 strategy-engine (Phase 3, S9–S12)

Le composant le plus imprévisible du projet. Les edge cases des blocs en cascade (un SAFETY qui déclenche pendant un ACTION en cours), la gestion du tick loop sous forte charge, et les comportements liés aux fills partiels mid-tick peuvent révéler des bugs difficiles à reproduire. **Prévoir +2 semaines de marge sur cette phase.**

### 🔴 Strategy Builder Angular (Phase 5, S20–S23)

L'éditeur drag-and-drop avec 36 blocs, validation temps réel, quick backtest intégré, et deux modes d'affichage (édition/lecture) est le composant frontend le plus complexe du projet. Si la librairie de drag-and-drop choisie ne supporte pas les contraintes du canvas (colonnes fixes, types de blocs restreints par colonne), ça peut doubler le temps de développement. **Évaluer la librairie dès le début de la Phase 5.**

### 🟡 Intégration Polymarket réelle (Phase 7, S35–S36)

L'API CLOB en production a des comportements non documentés, des rate limits plus strictes que le mock, et des délais de settlement variables. L'approbation du Builder Program est un processus externe avec un délai non maîtrisable. **Initier l'inscription au Builder Program dès la Phase 3, ne pas attendre la Phase 7.**

---

## Dépendances critiques entre services

```
mock-polymarket
    │
    └── market-data-service ──► cache Redis ──► strategy-engine
                                                      │
    auth-service ──► credentials DB ──► signer-service ──► order-service
                                              │
                              api-service ◄──┘
                                   │
                              Angular user-app
```

Un service en amont bloqué bloque tout ce qui est en dessous. L'ordre de développement des phases est donc non négociable pour le chemin critique (Phases 1 → 2 → 3 → 4).

---

---

## Phase 8 — Competitive Features (Post-Launch)

**Based on [Competitor Audit](./polyforge_competitor_audit.md) — 199 Polymarket Builders Program participants analyzed.**

### 8.1 · Copy Trading `HIGH PRIORITY`

The most contested feature space in the ecosystem. Polyforge's advantage: combine copy trading with our existing risk controls (Safety blocks) and self-custodial architecture.

- **Wallet tracking service** — monitor on-chain transactions of specified wallets
- **Copy trading engine** — automatically mirror trades from tracked wallets
  - Position sizing controls (percentage, fixed amount, max exposure)
  - Risk filters: min win-rate, max drawdown, min trade size
  - Price offset — adjust entry price relative to copied trade
- **Top traders discovery** — surface profitable wallets by P&L, win rate, volume
- **Copy trading UI** — user-app page to browse/follow/configure copy targets
- **Self-custodial** — user signs every trade (unlike PolyCop's custodial model)

### 8.2 · Whale Tracking & Alerts `HIGH PRIORITY`

Low-hanging fruit — monitor large on-chain trades and notify users.

- **Whale detection service** — monitor Polymarket CLOB for trades above configurable threshold ($5K+)
- **Real-time whale feed** — WebSocket events for large trades
- **Whale notifications** — Telegram/Discord/email alerts when whales move
- **Whale analytics** — track whale P&L, portfolio composition, market impact
- **Smart money dashboard** — admin + user-facing whale activity feed
- **Whale follow** — users can follow specific whale wallets for notifications

### 8.3 · AI News-to-Trade Pipeline `HIGH PRIORITY`

No dominant player exists. LLM-powered market intelligence.

- **News ingestion service** — aggregate news from RSS, Twitter/X, news APIs
- **LLM market matcher** — identify which Polymarket markets relate to breaking news
- **Trade signal generation** — suggest buy/sell based on news sentiment + market state
- **News feed UI** — curated news tied to user's positions and watchlist
- **AI market summaries** — auto-generated market analysis (similar to Polymtrade's 55K resolved markets AI)
- **API endpoint** — expose signals via API for external AI agents

### 8.4 · Advanced Order Types `MEDIUM PRIORITY`

Essential for serious traders. Stand.trade's TP/SL is the benchmark.

- **Take-Profit orders** — auto-sell when position reaches target profit
- **Stop-Loss orders** — auto-sell when position drops below threshold
- **Trailing Stop** — dynamic stop that follows price movement
- **Pegged (moving limit) orders** — for Polymarket Rewards farming
- **Multi-order management** — apply TP/SL across entire portfolio
- **Order automation UI** — simple interface for setting up advanced orders

### 8.5 · Multi-Platform Aggregation `MEDIUM PRIORITY`

Stand.trade + Kreo + Bullpen have proven demand for cross-platform trading.

- **Kalshi integration** — browse and trade Kalshi markets alongside Polymarket
- **Unified portfolio** — combined P&L across platforms
- **Cross-platform arbitrage scanner** — detect price discrepancies
- **Unified order book** — side-by-side comparison of same-topic markets
- **Market mapping** — auto-match equivalent markets across platforms

### 8.6 · Mobile App `MEDIUM PRIORITY`

Polymtrade proved mobile-first demand. React Native or Capacitor for code sharing.

- **React Native app** (or Capacitor wrapper of React web app)
- **Push notifications** — native mobile alerts
- **Biometric auth** — Face ID / fingerprint login
- **Quick trade** — simplified trading flow for mobile
- **Offline portfolio view** — cached positions accessible without network

### 8.7 · Social Reputation System `LOW PRIORITY`

Open infrastructure gap — no competitor has built this.

- **Trader score** — calculated from win rate, P&L, consistency, market diversity
- **Public track record** — verifiable trading history on user profiles
- **Reputation badges** — earned through trading milestones
- **Trust tiers** — unlock features based on reputation (e.g., copy trading eligibility)
- **On-chain verification** — optional blockchain-verifiable track record

### 8.8 · Gasless Trading `LOW PRIORITY`

UX improvement that reduces friction for new users.

- **Gas sponsorship** — platform absorbs Polygon gas fees
- **Meta-transactions** — use EIP-2771 for gasless execution
- **Fee model** — offset gas costs through platform fee (e.g., 0.5% trade fee)
- **Threshold** — gasless for trades under $100, user pays above

### 8.9 · Advanced Strategy Builder `HIGH PRIORITY`

Extends the strategy builder with import/export, variables UI, logic blocks, calculation blocks, and sub-strategies (strategy composition).

#### 8.9.1 · Strategy Import/Export `LOW EFFORT · HIGH VALUE`

- **Export strategies as `.polyforge` JSON files** — includes name, description, execMode, variables, blocks, and canvas layout
- **Import via upload or drag-and-drop** onto the strategy builder canvas
- **Share via link** — encoded URL containing the full strategy definition
- **Version field** for forward compatibility (schema versioning)
- **API endpoint** for programmatic export/import — AI agent friendly (`POST /api/v1/strategies/import`, `GET /api/v1/strategies/:id/export`)

#### 8.9.2 · Variables UI `MEDIUM EFFORT · MEDIUM VALUE`

- **Visual variable blocks on the canvas** — purple section color `#A855F7`
- **Variable definition** — name + expression (using `expr-eval`)
- **Variables panel** in builder sidebar showing all defined vars
- **Referenced variables highlighted** in block configs (`$varName` rendered with purple accent)
- Backend already implemented (`StrategyVariable` + `expr-eval` resolver)

#### 8.9.3 · Logic Blocks `MEDIUM EFFORT · HIGH VALUE`

- **IF/THEN/ELSE** — conditional branching with true/false output ports
- **AND gate** — all inputs must be true
- **OR gate** — any input must be true
- **NOT gate** — inverts boolean
- **Delay** — wait N seconds/ticks before propagating
- These blocks have **multiple output ports** (true/false paths)

#### 8.9.4 · Calculation Blocks `MEDIUM EFFORT · MEDIUM VALUE`

- **Math block** — arithmetic expression with named inputs
- **Aggregation** — moving average, min/max, cumulative sum over N ticks
- **Comparison** — outputs boolean (>, <, ==, between)
- These blocks have **typed input/output ports**

#### 8.9.5 · Sub-Strategies (Strategy Composition) `HIGH EFFORT · HIGH VALUE`

- **New "Run Strategy" action block type** — triggers another strategy from within a parent strategy
- **Three execution modes:**
  - **Fire-and-forget** — child runs independently
  - **Managed** — parent controls child lifecycle (start/stop/pause)
  - **Scoped** — child inherits parent context (variables, state)
- **`parentStrategyId` field** on Strategy model for lineage tracking
- **Circular dependency detection** — prevents infinite recursion
- **Resource limits:** max depth 3, max concurrent sub-strategies 10
- **P&L attribution** — sub-strategy P&L rolls up to parent
- **Parent lifecycle propagation** — stopping parent stops all children

---

## Phase 8 Priority Matrix

| Feature | Business Impact | Technical Effort | Competitive Urgency | Priority |
|---------|:-:|:-:|:-:|:-:|
| Copy Trading | 🔴 HIGH | 🟡 MEDIUM | 🔴 HIGH (most contested) | **P0** |
| Whale Tracking | 🔴 HIGH | 🟢 LOW | 🟡 MEDIUM | **P0** |
| News-to-Trade AI | 🔴 HIGH | 🔴 HIGH | 🟢 LOW (no dominant player) | **P1** |
| Advanced Orders (TP/SL) | 🟡 MEDIUM | 🟡 MEDIUM | 🟡 MEDIUM | **P1** |
| Multi-Platform | 🟡 MEDIUM | 🔴 HIGH | 🟡 MEDIUM | **P2** |
| Mobile App | 🟡 MEDIUM | 🟡 MEDIUM | 🟡 MEDIUM | **P2** |
| Social Reputation | 🟢 LOW | 🟡 MEDIUM | 🟢 LOW | **P3** |
| Gasless Trading | 🟢 LOW | 🟡 MEDIUM | 🟢 LOW | **P3** |
| Advanced Strategy Builder | 🔴 HIGH | 🔴 HIGH | 🟢 LOW (no competitor) | **P0** |

---

*Documents de référence : [Architecture](./01-architecture.md) · [Fonctionnalités](./00-features-and-functionalities.md) · [API Catalog](./06-api-catalog.md) · [Dev Setup](./09-dev-setup.md) · [Competitor Audit](./polyforge_competitor_audit.md)*
