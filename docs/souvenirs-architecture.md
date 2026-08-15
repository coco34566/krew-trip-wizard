# KREW — Souvenirs : architecture cible

## Phase 1 — fondation sécurisée

La fonctionnalité Photos du voyage existe historiquement, mais elle utilisait les données image directement dans `trip_photos.url` sous forme Base64. Cette architecture n'est pas retenue pour la suite de Souvenirs KREW.

La nouvelle architecture sépare :

- **Storage privé** : fichier image réel ;
- **`trip_photos`** : métadonnées, appartenance au voyage, propriétaire, empreintes et informations utiles ;
- **RLS** : accès conditionné à l'appartenance au voyage ;
- **Storage policies** : même cloisonnement au niveau des fichiers ;
- **IA** : traitement séparé, sans droit implicite d'entraînement.

## Stockage

Bucket privé : `trip-photos`.

Chemin cible :

`{trip_id}/{user_id}/{photo_id}.{extension}`

Aucune photo ne doit être rendue publique par une URL permanente. Les accès utilisateur doivent utiliser les mécanismes d'accès privé Supabase adaptés au besoin.

## Contrôle d'accès

Un utilisateur doit être membre du voyage concerné pour :

- consulter les métadonnées des photos du voyage ;
- lire les fichiers correspondants ;
- ajouter une photo ;
- accéder aux futurs téléchargements collectifs.

Le propriétaire d'une photo peut la supprimer. La sortie d'un utilisateur du voyage doit immédiatement retirer son accès via les mêmes contrôles d'appartenance.

## Déduplication

`content_hash` est prévu pour les doublons exacts.

`perceptual_hash` est réservé aux détections de similarité et ne doit jamais déclencher à lui seul une suppression automatique.

Une contrainte unique sur `(trip_id, content_hash)` est utilisée pour éviter plusieurs copies exactes actives dans un même voyage lorsque l'empreinte est disponible.

## Migration des anciennes photos

La fondation ne migre pas automatiquement les anciennes valeurs Base64. Toute migration éventuelle devra être traitée séparément après inventaire des données existantes et validation de la stratégie de conservation.

## IA

Les futures fonctions IA seront traitées comme une finalité fonctionnelle distincte :

- analyse des doublons ;
- classement ;
- sélection équilibrée ;
- génération d'album.

L'upload d'une photo ne constitue pas une autorisation d'utiliser cette photo pour entraîner ou améliorer les modèles KREW.

## Étapes suivantes

1. remplacer l'upload Base64 par Storage privé ;
2. générer des accès privés contrôlés pour l'affichage ;
3. ajouter suppression fichier + métadonnée ;
4. calculer le hash exact côté upload ;
5. ajouter la détection de similarité sans suppression automatique ;
6. construire le téléchargement collectif ;
7. ajouter l'analyse IA ;
8. construire la sélection et l'album ;
9. documenter les durées de conservation et les traitements IA dans les documents Legal/Data Processing.
