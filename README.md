# Lioncount — personalized food discovery

## What's included
- Username/password accounts, no email field.
- Argon2id password hashing, session cookies, login rate limiting.
- Per-user SQLite profile storage.
- Profile fields: name, dietary goals, dietary restrictions, favorite foods/cuisines, least favorites.
- Editable profile and preference-based sample food ranking.
- Potential pros and cons shown for each sample food.
- Ranking controls: preference match, pros/cons balance, alphabetical.

## Run locally
Requires Node.js 20+.

```bash
npm install
```

Set a strong session secret before running:

macOS/Linux:
```bash
export SESSION_SECRET="$(node -e 'console.log(require("crypto").randomBytes(48).toString("hex"))')"
npm start
```

Windows PowerShell:
```powershell
$env:SESSION_SECRET = node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
npm start
```

Open http://localhost:3000.

## Important scope and safety notes
The food-ranking engine is an illustrative demo heuristic, not a nutrition, medical, or food-safety assessment. It ranks only the sample food ideas in `public/index.html`; it does not search a live recipe or restaurant database. The displayed pros and cons are general considerations, not individualized medical advice. Allergy/restriction keyword overlap is flagged for manual verification, never treated as a definitive safety check. Always verify ingredients and cross-contact with the food provider.

The sample ranking is intentionally transparent: it starts at 50, adds 13 points per matching favorite keyword and 5 per matching goal keyword, subtracts 18 per matching least-favorite keyword, then clamps to 0–100. This is a preference-fit indicator, not a health score. Change the weights only if you want a different preference-ranking behavior; do not interpret the number as quality or healthfulness.

## Langflow integration
This package does not yet connect the browser to Langflow. Your previous embedded widget used a browser-visible `api_key` attribute. Never publish a privileged API key in frontend HTML or JavaScript. For production, create a server-side chat proxy that:
1. checks the authenticated session,
2. loads only that user's profile,
3. calls the correct Langflow endpoint with a server-side secret,
4. passes a compact preference context to the flow,
5. returns the response without exposing the secret.

Confirm the endpoint and request schema for your deployed Langflow version/flow before implementing the proxy.

## Before public deployment
This is a starter project, not a fully audited production service. Deploy behind HTTPS, set a unique strong SESSION_SECRET in your host's secret manager, use persistent storage, configure secure session cookies, add CSRF protection suitable for your deployment, backups, monitoring, and a documented account recovery/admin process. No email means no email password reset. Do not expose the SQLite database, session store, or secrets publicly.
