# KREW — Guide de travail pour les agents IA

## Objectif

Ce document définit la méthode de travail à suivre par toute IA intervenant sur KREW.

## 1. Comprendre avant de modifier
Reformuler le problème, identifier le parcours, localiser le code responsable, rechercher fonctions/composants associés et modifications récentes.

## 2. Identifier la cause racine
Déterminer où et pourquoi le comportement incorrect apparaît, distinguer cause et symptôme et vérifier les hypothèses.

## 3. Vérifier l'état existant
Vérifier branche, commits, changements récents, workflows, environnement et dépendances pertinentes. Ne jamais supposer que le dépôt correspond à une ancienne version.

## 4. Choisir la modification
Privilégier le plus petit changement, les interfaces et comportements validés, une solution testable et réversible. Éviter les refactorings non nécessaires.

## 5. Implémenter
Ne pas modifier de fichiers sans rapport, supprimer de logique sans justification, toucher aux secrets ou contourner les checks.

## 6. Tester
Vérifier code/type/lint/build, fonctionnalité, régressions et environnement selon le contexte.

## 7. Pull Request
Inspecter diff, fichiers, checks, Preview et fonctionnalité. Comprendre tout échec avant fusion.

## 8. Déploiement
Après fusion, vérifier `main`, déploiement Vercel et fonctionnalité en production.

## 9. Fin d'une tâche
Une tâche n'est terminée que lorsque le problème est corrigé, le code intégré, les checks compris, le déploiement effectué et la fonctionnalité testée, ou lorsque les étapes non réalisées sont explicitement signalées.

> Archive historique. Le contenu durable a été absorbé dans `.agents/skills/krew-core/SKILL.md`.
