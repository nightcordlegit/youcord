# YouCord Premium — Serveur

Backend qui gère : connexion Discord (OAuth2), paiement Stripe, et le statut premium consulté automatiquement par le plugin `YouCordPremium` du client. Dès qu'un paiement Stripe est confirmé, le badge et les cosmétiques premium se débloquent tout seuls côté client (polling toutes les 10 min, ou toutes les 15s pendant les 10 minutes qui suivent un paiement).

## 1. Créer l'application Discord (OAuth2)

1. Va sur https://discord.com/developers/applications → **New Application**.
2. Onglet **OAuth2** → note le **Client ID** et régénère/copie le **Client Secret**.
3. Toujours dans OAuth2 → **Redirects** → ajoute :
   `https://TON-URL-RAILWAY.up.railway.app/api/oauth2/callback`
   (tu mettras l'URL réelle une fois Railway déployé, tu peux la modifier après coup).

## 2. Créer le produit Stripe

1. https://dashboard.stripe.com/products → **Add product** → nomme-le "YouCord Premium".
2. Ajoute un prix **récurrent** (mensuel ou annuel) → copie l'ID du prix (`price_...`).
3. Récupère ta clé secrète : https://dashboard.stripe.com/apikeys (`sk_test_...` pour tester, `sk_live_...` en prod).
4. Le webhook (étape 4) te donnera `STRIPE_WEBHOOK_SECRET` — pas encore maintenant.

## 3. Déployer sur Railway

1. https://railway.app → **New Project** → **Deploy from GitHub repo** (ou **Empty Project** puis upload de ce dossier `youcord-premium-server/` séparément — tu peux aussi le pousser dans un repo GitHub dédié, séparé de `youcord` lui-même, c'est plus propre).
2. Ajoute le plugin **PostgreSQL** au projet (bouton **+ New** → **Database** → **PostgreSQL**). Railway crée automatiquement une variable `DATABASE_URL`.
3. Dans le service Node, va dans **Variables** et ajoute :
   - `PUBLIC_URL` → l'URL Railway générée pour ce service (ex: `https://youcord-premium-production.up.railway.app`), **sans slash final**
   - `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` (étape 1)
   - `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID` (étape 2)
   - `STRIPE_WEBHOOK_SECRET` (étape 4, à ajouter après)
   - `DATABASE_URL` → référence celle de Postgres : `${{Postgres.DATABASE_URL}}`
4. Railway build & déploie automatiquement (`npm install && npm start`).
5. Retourne dans l'app Discord (étape 1) et met à jour le Redirect avec la vraie `PUBLIC_URL`.

## 4. Créer le webhook Stripe

1. https://dashboard.stripe.com/webhooks → **Add endpoint**.
2. URL : `{PUBLIC_URL}/api/stripe/webhook`
3. Événements à écouter : `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
4. Copie le **Signing secret** (`whsec_...`) → ajoute-le comme `STRIPE_WEBHOOK_SECRET` dans Railway → redéploie.

## 5. Brancher le client YouCord

Dans le repo `youcord`, fichier `src/api/OAuth2.ts` :

```ts
export const API_BASE = "https://TON-URL-RAILWAY.up.railway.app"; // sans slash final
export const YOUCORD_OAUTH_AVAILABLE = true;
```

Puis rebuild/réinjecte YouCord normalement (`pnpm build` + réinjection).

## 6. Tester

1. Dans Discord (avec YouCord injecté) → menu YouCord (toolbox) → **Devenir Premium**.
2. Une fenêtre de navigateur s'ouvre → connexion Discord → autorise l'app.
3. Le navigateur ouvre ensuite Stripe Checkout → utilise une carte de test Stripe (`4242 4242 4242 4242`, n'importe quelle date future, n'importe quel CVC) si `STRIPE_SECRET_KEY` est en mode test.
4. Après paiement, la page "Paiement réussi" s'affiche → retourne sur Discord → le badge Premium apparaît sous 15 secondes.

## Notes de sécurité

- Le "session token" YouCord (stocké côté client via `DataStore`) est un secret opaque : quiconque le possède peut interroger le statut premium et créer des sessions de paiement en ton nom. Ne le partage jamais et régénère-le (`clearToken` + reconnexion) si besoin.
- Une seule session active par compte Discord dans cette version (une reconnexion invalide l'ancien token). Pour du multi-appareils il faudrait une table de tokens au lieu d'une colonne unique — pas nécessaire pour un MVP.
- Le endpoint `/api/stripe/webhook` DOIT rester en `express.raw()` (corps brut) pour que la vérification de signature Stripe fonctionne — ne le fais jamais passer par `express.json()`.
