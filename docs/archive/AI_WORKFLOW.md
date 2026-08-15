# KREW — Guide de travail pour les agents IA

## Objectif

Ce document définit la méthode de travail à suivre par toute IA intervenant sur KREW.

Il ne remplace pas les règles techniques du projet.

---

# 1. Comprendre avant de modifier

Lorsqu'un problème est signalé :

1. reformuler précisément le problème ;
2. identifier le parcours utilisateur concerné ;
3. localiser le code responsable ;
4. rechercher les fonctions et composants associés ;
5. rechercher les modifications récentes susceptibles d'avoir introduit le problème.

Ne pas commencer par modifier le premier fichier qui semble lié au problème.

---

# 2. Identifier la cause racine

Avant d'appliquer un correctif :

- déterminer où le comportement incorrect apparaît ;
- déterminer pourquoi il apparaît ;
- distinguer cause et symptôme ;
- vérifier si un changement récent est responsable.

Lorsque plusieurs causes sont possibles, les vérifier une par une.

---

# 3. Vérifier l'état existant

Avant de modifier :

- vérifier la branche ;
- vérifier les derniers commits ;
- vérifier les changements récents ;
- vérifier les workflows ;
- vérifier les variables d'environnement si elles sont pertinentes ;
- vérifier les dépendances externes.

Ne jamais supposer que le dépôt correspond à une ancienne version connue.

---

# 4. Choisir la modification

Privilégier :

- le plus petit changement permettant de résoudre le problème ;
- la conservation des interfaces existantes ;
- la conservation du comportement déjà validé ;
- une solution facile à tester et à revenir en arrière.

Éviter les refactorings non nécessaires.

---

# 5. Implémenter

Pendant l'implémentation :

- ne pas modifier des fichiers sans rapport ;
- ne pas supprimer de logique existante sans justification ;
- ne pas modifier les secrets ;
- ne pas modifier les variables d'environnement de production sans nécessité ;
- ne pas contourner les checks pour faire passer une PR.

---

# 6. Tester

Après implémentation :

### Niveau 1 — code

Vérifier :

- TypeScript ;
- lint ;
- build ;
- erreurs évidentes.

### Niveau 2 — fonctionnalité

Tester le parcours utilisateur directement concerné.

### Niveau 3 — régression

Tester les fonctionnalités qui utilisent la même logique.

### Niveau 4 — environnement

Vérifier :

- GitHub Actions ;
- Vercel Preview ;
- erreurs runtime ;
- logs pertinents.

---

# 7. Pull Request

Avant fusion :

1. inspecter le diff ;
2. vérifier que seuls les fichiers nécessaires ont changé ;
3. vérifier les checks ;
4. vérifier le déploiement Preview ;
5. tester la fonctionnalité sur la Preview.

Si un check échoue :

- identifier son origine ;
- déterminer s'il est lié au changement ;
- corriger la cause ;
- ou documenter pourquoi il est obsolète.

Ne jamais simplement ignorer un check rouge.

---

# 8. Déploiement

Après fusion :

1. vérifier que `main` contient bien le changement ;
2. attendre le déploiement Vercel ;
3. vérifier que le déploiement correspond au commit attendu ;
4. tester le parcours utilisateur en production.

---

# 9. Fin d'une tâche

Une tâche n'est terminée que lorsque :

- le problème initial est corrigé ;
- le code est intégré ;
- les checks pertinents sont compris ;
- le déploiement est terminé ;
- la fonctionnalité est testée.

Si une de ces étapes n'a pas pu être effectuée, l'indiquer explicitement.

---

# 10. Principe important

Ne jamais confondre :

- « le code a été modifié »
- « le build fonctionne »
- « le déploiement fonctionne »
- « la fonctionnalité fonctionne »

Ce sont quatre validations différentes.

Une tâche fonctionnelle doit être considérée comme terminée uniquement lorsque la fonctionnalité elle-même a été vérifiée.
