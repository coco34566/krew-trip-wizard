# KREW — Zones sensibles et sécurité des modifications

## Objectif

Certaines parties de KREW ont un impact transversal important.

Elles doivent être modifiées avec davantage de précautions.

Ce document ne signifie pas que ces fichiers sont interdits de modification.

Il signifie qu'une modification doit être analysée et testée plus attentivement.

---

# 1. Authentification

### Zone sensible

- Supabase Auth ;
- JWT ;
- sessions ;
- cookies ;
- middleware ;
- auth-attacher ;
- Server Functions authentifiées.

### Risques

Une modification peut provoquer :

- `Invalid token` ;
- utilisateur considéré comme non authentifié ;
- session perdue ;
- accès refusé ;
- comportement différent entre Preview et production.

### Avant modification

Identifier :

- origine du token ;
- stockage du token ;
- mécanisme de refresh ;
- transmission au serveur ;
- validation côté serveur.

### Après modification

Tester :

1. connexion ;
2. création d'une session ;
3. création d'un questionnaire ;
4. appel serveur authentifié ;
5. rafraîchissement de session si applicable.

---

# 2. Durée du voyage

### Zone sensible

Toute logique utilisant :

- `duration_nights` ;
- dates de départ ;
- dates de retour ;
- nombre de nuits ;
- nombre de jours ;
- fenêtres de disponibilité.

### Règle

Si une durée explicite du voyage existe, elle doit être utilisée comme référence métier.

Ne pas remplacer cette valeur par :

- une moyenne des préférences individuelles ;
- une estimation ;
- un calcul implicite ;

sans raison métier explicite.

### Attention

Toujours distinguer :

- jours ;
- nuits ;
- dates calendaires.

Une modification doit vérifier les conséquences sur les fenêtres de dates proposées.

---

# 3. Questionnaire

### Zone sensible

Le questionnaire est un parcours central de KREW.

Toute modification doit préserver :

- création ;
- sauvegarde ;
- récupération ;
- validation ;
- association au voyage ;
- authentification ;
- préférences individuelles.

Après modification, créer au minimum un questionnaire de test complet.

---

# 4. Scoring

Toute modification du scoring doit vérifier :

- classement ;
- pondérations ;
- données manquantes ;
- résultats extrêmes ;
- cohérence des scores.

Ne pas modifier silencieusement les poids existants.

---

# 5. Disponibilités et prix

Les données de disponibilité et de prix sont sensibles car elles peuvent être dynamiques.

Le système doit éviter de présenter comme définitives des données qui peuvent avoir changé.

Lorsque cela est nécessaire :

1. utiliser le cache pour limiter les appels ;
2. vérifier les données finales ;
3. vérifier prix et disponibilité avant présentation ou réservation.

---

# 6. APIs externes

Avant de remplacer une API :

- identifier tous ses consommateurs ;
- vérifier le format des données ;
- vérifier la normalisation ;
- vérifier le scoring ;
- vérifier le cache ;
- vérifier les erreurs et timeouts.

Le moteur KREW doit rester aussi indépendant que possible du fournisseur.

---

# 7. Supabase

Avant une modification de :

- table ;
- colonne ;
- relation ;
- RLS ;
- requête ;
- fonction ;
- authentification ;

rechercher les usages existants.

Une modification de schéma doit être considérée comme potentiellement transversale.

---

# 8. Vercel

Toute modification pouvant affecter le runtime ou le déploiement doit être testée sur Preview avant production.

Vérifier :

- build ;
- variables d'environnement ;
- runtime ;
- logs ;
- comportement réel.

---

# 9. GitHub Actions

Les workflows peuvent modifier automatiquement le dépôt ou exécuter des scripts.

### Règles

Avant d'ajouter un workflow :

- rechercher les workflows existants ;
- vérifier qu'il n'y a pas déjà une solution ;
- définir clairement son objectif ;
- définir s'il est permanent ou temporaire.

### Workflows temporaires

Un workflow temporaire doit être supprimé une fois son objectif atteint.

Il ne doit pas rester actif simplement parce qu'il « fonctionne encore ».

### Scripts fragiles

Éviter les scripts qui recherchent une chaîne de code exacte pour appliquer une modification.

Si un tel script échoue avec :

`Expected source block not found`

il faut d'abord vérifier si le code ciblé a évolué ou si le workflow est devenu obsolète.

Ne pas déformer le code actuel pour satisfaire un ancien script.

---

# 10. Variables d'environnement

Ne jamais :

- committer des secrets ;
- afficher des tokens ;
- hardcoder des clés ;
- copier des secrets dans les fichiers Markdown ;
- transmettre des secrets dans des commits.

Les noms de variables peuvent être documentés.

Les valeurs ne doivent jamais l'être.

---

# 11. Règle générale des zones sensibles

Pour toute modification importante :

1. identifier les dépendances ;
2. modifier de manière ciblée ;
3. tester le parcours principal ;
4. tester les régressions évidentes ;
5. vérifier les checks ;
6. vérifier le déploiement ;
7. tester la fonctionnalité réelle.

Une modification dans une zone sensible ne doit jamais être considérée comme terminée uniquement parce que le build passe.
