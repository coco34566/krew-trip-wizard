# KREW — Règles de développement

## 1. Règle principale

Toute modification doit résoudre le problème identifié tout en préservant les fonctionnalités déjà fonctionnelles.

Ne pas réécrire une partie fonctionnelle du projet uniquement parce qu'une autre implémentation semble plus simple.

Privilégier les modifications ciblées.

---

## 2. Avant de modifier du code

Avant toute modification :

1. identifier le fichier concerné ;
2. rechercher les fonctions qui utilisent la logique concernée ;
3. identifier les dépendances ;
4. vérifier si le comportement existe déjà ailleurs ;
5. rechercher les tests ou workflows qui dépendent du code ;
6. déterminer la cause racine avant de modifier le code.

Ne pas corriger uniquement le symptôme lorsqu'une cause racine identifiable existe.

---

## 3. Préservation des fonctionnalités

Une modification ne doit pas casser une fonctionnalité indépendante.

Avant de modifier une logique existante, identifier :

- ses entrées ;
- ses sorties ;
- ses consommateurs ;
- ses effets secondaires ;
- ses dépendances.

Après modification, tester au minimum le parcours directement concerné.

Si la modification touche une zone critique, tester également les parcours dépendants.

---

## 4. Modifications minimales

Lorsque plusieurs solutions sont possibles, privilégier celle qui :

- modifie le moins de fichiers ;
- modifie le moins de logique existante ;
- conserve les interfaces existantes ;
- limite les effets secondaires ;
- est facilement réversible.

Ne pas effectuer de refactoring général lorsqu'un correctif ciblé suffit.

---

## 5. Authentification

Toute modification concernant :

- Supabase Auth ;
- JWT ;
- middleware ;
- cookies ;
- sessions ;
- tokens ;
- Server Functions protégées ;

doit être considérée comme sensible.

Après modification, vérifier explicitement :

1. connexion ;
2. récupération de session ;
3. rafraîchissement du token si nécessaire ;
4. appel d'une fonction serveur authentifiée ;
5. parcours utilisateur concerné.

Ne jamais remplacer une méthode d'authentification fonctionnelle sans comprendre précisément son fonctionnement actuel.

---

## 6. Base de données

Avant de modifier une requête ou un schéma :

- vérifier le schéma actuel ;
- rechercher les usages de la table ;
- vérifier les relations ;
- vérifier les politiques RLS si elles sont concernées ;
- vérifier les données attendues par le frontend et le backend.

Ne pas modifier une structure de données uniquement pour adapter un script temporaire.

---

## 7. Variables d'environnement

Les secrets doivent uniquement être stockés dans les variables d'environnement appropriées.

Ne jamais :

- écrire une clé secrète dans le code ;
- écrire une clé secrète dans un fichier Markdown ;
- committer un `.env` contenant des secrets ;
- afficher une clé complète dans les logs.

---

## 8. GitHub Actions

Avant de créer ou modifier un workflow :

- rechercher les workflows existants ;
- vérifier s'il existe déjà un workflow pour le même objectif ;
- comprendre quand et pourquoi le workflow s'exécute.

Les workflows temporaires doivent être explicitement identifiés comme tels.

Lorsqu'un workflow temporaire a terminé son objectif, il doit être supprimé.

Un workflow ne doit pas dépendre inutilement de la présence exacte d'un bloc de code fragile.

Si un workflow échoue parce qu'il ne retrouve plus un bloc de code attendu :

> ne pas modifier le code uniquement pour satisfaire le workflow.

Vérifier d'abord si le workflow est devenu obsolète.

---

## 9. Pull Requests

Avant de considérer une Pull Request comme prête :

- vérifier le diff ;
- vérifier les fichiers modifiés ;
- vérifier les checks GitHub ;
- vérifier les erreurs de build ;
- vérifier le déploiement Vercel ;
- tester la fonctionnalité concernée.

Un check rouge doit être compris avant fusion.

Ne pas ignorer un check sous prétexte qu'il semble sans rapport avec la fonctionnalité.

---

## 10. Vercel

Après une modification ayant un impact applicatif :

1. vérifier le build ;
2. vérifier le déploiement Preview ;
3. tester la fonctionnalité sur la Preview ;
4. seulement ensuite fusionner si nécessaire ;
5. vérifier le déploiement de production après fusion.

---

## 11. Règle de non-régression

Une correction réussie doit être évaluée selon deux critères :

### Correction

Le problème initial est réellement résolu.

### Non-régression

Les fonctionnalités précédemment fonctionnelles continuent de fonctionner.

Les deux conditions sont nécessaires.

---

## 12. Communication avec le développeur

Lorsqu'une modification est terminée, indiquer clairement :

- ce qui a été modifié ;
- pourquoi ;
- les fichiers concernés ;
- les tests effectués ;
- les checks vérifiés ;
- ce qui reste éventuellement à vérifier.

Ne jamais déclarer une fonctionnalité « corrigée » uniquement sur la base d'une modification de code non testée.
