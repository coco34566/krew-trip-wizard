# KREW

KREW est une application d'organisation de voyages en groupe : disponibilités, préférences, profil du séjour, recommandations de destinations, hébergements, transports, activités, planning, tâches, budget et préparation du voyage.

## Stack actuelle

- React 19
- TanStack Start / TanStack Router
- Vite + TypeScript
- Tailwind CSS
- Supabase (base de données, Auth, Storage)
- Vercel pour le déploiement
- Vitest + Playwright pour les tests

Le routage est file-based sous `src/routes/`. Voir `src/routes/README.md` pour les conventions.

## Architecture produit

Le moteur KREW suit globalement la chaîne :

questionnaires + disponibilités → profil de groupe/séjour → découverte de candidats → enrichissement externe → contraintes dures → scoring déterministe → shortlist → hébergement/transport → activités/planning → préparation du voyage.

Les LLM peuvent participer à la découverte ou à la formulation, mais les contraintes dures et le scoring déterministe KREW restent autoritaires. Les données externes réelles et les estimations doivent rester distinguables.

## Intégrations voyage

Les intégrations évoluent ; `docs/external_search.md` est la référence opérationnelle avant toute modification d'un provider.

État actuel important :
- activités réservables : GetYourGuide affilié lorsqu'un résultat pertinent existe ;
- avion sans offre live exploitable : Kiwi via Travelpayouts est la recherche externe principale ; Google Flights peut rester secondaire ;
- Kayak et Omio ne sont pas les fallbacks principaux actuels ;
- train : SNCF Connect / Trainline selon le flux ;
- voiture/covoiturage : comportement existant Google Maps / BlaBlaCar à préserver ;
- Booking.com / Trip.com via Travelpayouts : ne pas considérer comme live tant que validation/configuration et tests ne sont pas terminés.

## Règles de contribution pour agents

Commencer par `AGENTS.md` puis lire uniquement le skill/document pertinent :
- `.agents/skills/krew-core/SKILL.md` — méthode, sécurité des changements, validation ;
- `.agents/skills/krew-product/SKILL.md` — invariants produit et moteurs ;
- `.agents/skills/krew-technical/SKILL.md` — architecture, Supabase, APIs, déploiement ;
- `DESIGN.md` — langage visuel KREW ;
- `docs/external_search.md` — providers voyage, fallbacks, affiliation ;
- `docs/recommendation-engine-audit.md` — détails du moteur de recommandation.

Les fichiers sous `archive/`, `docs/archive/` et `.lovable/plan/` sont historiques et ne sont pas des sources de vérité actuelles.

## Développement

```sh
bun install --frozen-lockfile
bun run dev
```

Validation selon le périmètre :

```sh
npx tsc --noEmit
npm test
npm run build
npm run test:e2e
```

Ne pas exécuter systématiquement toute la suite lorsqu'un test ciblé suffit, mais toujours distinguer tests unitaires, build, Preview/runtime et validation fonctionnelle réelle.

## Principes de sécurité

- ne jamais committer de secret, clé API ou token ;
- inspecter les consommateurs avant toute modification Supabase/RLS/auth/API ;
- ne pas contourner une contrainte produit pour faire fonctionner un provider ;
- préserver la provenance des prix, disponibilités, durées et liens externes ;
- éviter les refactors hors périmètre.

## Documentation légale

`README_LEGAL.md` et les documents `docs/data-*` / `docs/legal-*` sont des documents de travail de conformité. Ils doivent être réévalués lorsque les fournisseurs, traceurs, traitements ou le modèle commercial changent.
<!-- vercel-production-redeploy: 2026-09-02 -->
