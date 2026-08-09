# Krew: Your Group Trip Planner 

Crée une application web complète appelée Krew, une plateforme intelligente d’organisation de voyages de groupe (principalement EVG/EVJF mais extensible à tous types de voyages entre amis).

Vision du projet

Krew permet à un groupe d’amis de créer facilement un voyage mémorable sans devoir organiser manuellement toutes les étapes. L’utilisateur remplit un questionnaire détaillé, puis la plateforme analyse les besoins du groupe et propose une expérience complète : destination, activités, hébergements, transports, budget et planning.

L’objectif est de devenir un assistant intelligent d’organisation de voyages de groupe.

Fonctionnement principal

1. Création d’un projet voyage

L’utilisateur crée un nouveau voyage avec :

Nom de l’événement

Type d’événement :



EVG

EVJF

Anniversaire

Weekend entre amis

Voyage de groupe

Date ou période souhaitée

Nombre de participants

Budget par personne

Ville de départ des participants

2. Questionnaire intelligent

Créer un parcours sous forme de wizard avec plusieurs étapes :

Profil du groupe

Nombre de personnes

Âge moyen

Relation avec la personne célébrée

Ambiance recherchée :



fête

aventure

détente

luxe

insolite

sportif

culturel

Préférences voyage

Destination souhaitée ou possibilité de laisser l’IA proposer

Distance maximale

Pays acceptés/refusés

Durée du séjour

Budget maximum

Activités recherchées

Catégories :

Soirées

Bars/clubs

Activités sportives

Sensations fortes

Activités nautiques

Gastronomie

Expériences locales

Activités insolites

Contraintes

Budget

Disponibilité

Mobilité

Besoin de logement proche du centre

Contraintes alimentaires éventuelles

Connexion obligatoire aux bases de données voyages

Dès la première version fonctionnelle, prévoir une architecture permettant de récupérer automatiquement des données externes.

L’application doit être pensée pour se connecter à des API et bases de données voyages afin d’obtenir :

Destinations

Informations villes/pays

Météo

Saisonnalité

Popularité

Prix moyens

Hébergements

Connexion possible à des bases de données d’hôtels, appartements et locations :

disponibilité

prix

localisation

capacité

notes utilisateurs

Activités

Connexion à des bases d’activités touristiques :

activités disponibles

prix

horaires

avis

localisation

Transport

Prévoir une architecture compatible avec :

vols

trains

transports locaux

transferts

L’objectif est que les recommandations Krew soient basées sur de vraies données actualisées et non uniquement sur du contenu statique.

Intelligence de recommandation

Créer un système de scoring qui analyse :

budget

profil du groupe

envies

contraintes

saison

disponibilité

Puis génère des propositions :

Exemple :
“Weekend EVG à Barcelone pour 10 personnes avec budget 350€/personne”

Résultat :

Destination recommandée

Pourquoi cette destination correspond au groupe

Programme jour par jour

Hébergement conseillé

Activités proposées

Budget estimé

Interface utilisateur

Créer une interface moderne type startup :

Style :

premium

simple

intuitive

mobile first

Pages principales :

Landing page

Présenter Krew :
“Organisez le voyage parfait avec vos amis, sans passer des heures à chercher.”

Dashboard utilisateur

Afficher :

voyages créés

voyages en préparation

invitations reçues

Création voyage

Wizard avec progression visuelle.

Résultat voyage

Afficher une proposition complète avec cartes, images, prix et détails.

Collaboration groupe

Permettre :

invitation des participants

votes

validation d’activités

partage du budget

Base de données

Utiliser Supabase comme backend.

Prévoir les tables :

Users

id

email

profil

Trips

id

user_id

nom

type

dates

budget

participants

statut

Trip_preferences

trip_id

activités souhaitées

ambiance

contraintes

Destinations

données récupérées depuis APIs externes

Activities

activités disponibles

Accommodations

logements disponibles

Recommendations

propositions générées par le moteur Krew

Authentification

Mettre en place :

création de compte

connexion utilisateur

gestion des sessions

protection des données

Architecture technique

Créer une base propre et scalable :

Frontend moderne React

Backend Supabase

Gestion des variables d’environnement

Structure permettant l’ajout futur d’IA et d’APIs externes

Code propre et documenté

Ne pas créer une simple maquette. Construire une vraie application fonctionnelle avec :

navigation complète

base de données connectée

authentification

stockage des voyages

préparation des intégrations API voyages

L’objectif est d’obtenir une première version exploitable de Krew pouvant évoluer vers une plateforme complète d’organisation de voyages de groupe.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://krew-trip-wizard.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5019176c-8e6a-4e8e-8b68-e953cf78c1b3).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
