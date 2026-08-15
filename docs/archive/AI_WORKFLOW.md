# AI Workflow — Archived

This file is retained for historical reference only. It is not an active instruction source.

The active AI workflow and development rules are maintained in `.agents/skills/krew-core/SKILL.md` and `AGENTS.md`.

Original archived content:

# AI Workflow – KREW

Ce document décrit la méthode de travail attendue pour toute IA intervenant sur le projet KREW.

## 1. Comprendre avant de modifier

Avant toute modification :
- Identifier précisément le problème.
- Identifier les fichiers et fonctions concernés.
- Vérifier les dépendances et consommateurs.
- Ne pas corriger « au hasard ».

## 2. Identifier la cause racine

Une IA ne doit pas traiter uniquement le symptôme.
Elle doit rechercher la cause réelle dans le code et les données.

## 3. Vérifier l’état existant

Avant modification :
- Vérifier l’état Git.
- Vérifier les modifications déjà présentes.
- Vérifier les tests existants.
- Vérifier les workflows concernés.

## 4. Choisir la modification

Privilégier :
- la modification minimale ;
- la conservation des comportements existants ;
- l’absence de refactorisation hors sujet.

## 5. Implémenter

Modifier uniquement ce qui est nécessaire à la résolution du problème identifié.

Ne jamais modifier les secrets ou les valeurs sensibles dans le code.

## 6. Tester

Après modification, vérifier selon le contexte :
- compilation / typecheck / lint ;
- tests automatisés ;
- déploiement / environnement ;
- parcours fonctionnel réel.

Un build réussi ne prouve pas qu’une fonctionnalité fonctionne.

## 7. Pull Request

Avant une PR :
- vérifier le diff ;
- vérifier les fichiers modifiés ;
- vérifier les checks ;
- distinguer les erreurs préexistantes des régressions.

## 8. Déploiement

Quand pertinent :
- vérifier le Preview ;
- tester le parcours concerné ;
- vérifier la production après merge.

## 9. Fin d’une tâche

Indiquer clairement :
- ce qui a été modifié ;
- pourquoi ;
- les fichiers concernés ;
- les validations effectuées ;
- ce qui reste non vérifié.

## 10. Principe important

Le code et les tests sont la source de vérité pour le comportement réel du projet. La documentation ne doit pas être considérée comme plus fiable que l’implémentation actuelle.
