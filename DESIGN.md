# KREW — DESIGN.md

> Source de vérité unique pour la direction visuelle et UX de KREW.
>
> Ce document décrit **comment KREW doit être présenté et ressenti**. Il ne remplace ni les règles produit ni les règles techniques existantes. En cas de conflit, le comportement produit actuel et les règles de sécurité du repository restent prioritaires.

---

## 1. ADN KREW

KREW doit provoquer trois réactions immédiates :

- **« Ça va être fun. »**
- **« C’est vraiment beau. »**
- **« Ça a l’air hyper simple. »**

La direction générale est :

**SOBRE + ÉDITORIALE + CONTEMPORAINE + HUMAINE + FUN**

KREW doit ressembler à une **marque européenne de voyage contemporaine devenue produit numérique**, pas à un SaaS, un dashboard corporate, un template généré par IA, une marketplace générique, un site de resort/luxe ou une app tropicale « Bali/plage ».

Principe central :

> **La complexité reste dans le moteur. La simplicité appartient à l’interface.**

Le vocabulaire de marque à préserver :

> **LA TEAM. LE PLAN. LE MOMENT.**

---

## 2. TERRITOIRE VISUEL

KREW doit fonctionner aussi naturellement pour un city trip européen que pour la campagne, les villages, la montagne, les restaurants, cafés, l’architecture, les trains, hôtels, la culture, la nature et la nightlife.

Éviter comme territoire principal : plages tropicales, palmiers, infinity pools, resorts, turquoise tropical, sunset orange et clichés de luxe-vacances.

Le voyage doit être **européen, culturel, urbain ou nature selon le contexte**, sans enfermer KREW dans un seul type de destination.

---

## 3. SYSTÈME TYPOGRAPHIQUE OFFICIEL

### Instrument Serif — Display & Titres

**Rôle : émotion, élégance éditoriale, esprit voyage.**

Usage : H1/H2, destinations, grands moments, titres éditoriaux, récits de voyage et « LA TEAM / LE PLAN / LE MOMENT ».

Ne pas l’utiliser pour les longs textes, formulaires ou informations fonctionnelles denses.

### Plus Jakarta Sans — Interface & Navigation

**Rôle : lisibilité, modernité, fluidité.**

Usage : navigation, sous-titres, corps de texte, boutons, formulaires, labels, dates, statuts et informations pratiques.

### Space Mono — Data & Comptabilité

**Rôle : précision, confiance, lecture des chiffres.**

Usage : prix, budget, coût par personne, dépenses, soldes et récapitulatifs chiffrés.

### Caveat — Annotations manuscrites KREW

**Rôle : chaleur, spontanéité et voix humaine ponctuelle.**

Caveat est utilisée uniquement dans les composants d’annotation manuscrite KREW :

- `KrewNote` ;
- `KrewCallout` ;
- petites annotations éditoriales ;
- post-it visuels.

Ne jamais utiliser Caveat pour :

- les titres de page ;
- le corps de texte ;
- les boutons ;
- les labels ;
- la navigation ;
- les données ;
- les formulaires ;
- les tableaux ;
- les contenus fonctionnels normaux.

> **Instrument Serif = ÉMOTION**  
> **Plus Jakarta Sans = ACTION**  
> **Space Mono = PRÉCISION**
> **Caveat = VOIX HUMAINE**

### Hiérarchie de référence

- H1 / hero : Instrument Serif, **40–44px mobile**, **48–58px desktop** selon le contexte.
- H2 / grand chapitre : Instrument Serif, **26–32px**.
- Titre fonctionnel : Plus Jakarta Sans SemiBold, **16–18px**.
- Corps principal : Plus Jakarta Sans Regular, **15–16px**.
- Corps secondaire : Plus Jakarta Sans Regular, **13–14px**.
- Micro-label : Plus Jakarta Sans Medium, **12–13px**.
- Données / montants courants : Space Mono, **14–16px**.
- Donnée importante : Space Mono Bold, **18–32px** selon le niveau.

`10px` ne doit pas être utilisé pour une information utilisateur normale.

`11px` doit rester réservé à des micro-labels réellement secondaires.

Ces valeurs peuvent s’adapter au responsive sans casser la hiérarchie.

---

## 4. PALETTE OFFICIELLE

| Rôle | Couleur | Hex |
|---|---|---|
| Accent principal / CTA / highlights | Prune Profond | `#6B3A5D` |
| Secondaire / équilibre / progression | Vert Sauge | `#8FA89B` |
| Fond principal | Blanc | `#FFFFFF` |
| Texte principal | Encre Prune | `#1C151B` |
| Surfaces secondaires / séparateurs | Gris Neutre | `#F7F8F7` |

Le **blanc + la photographie** doivent occuper la majorité de l’espace. Le prune est une **signature**, pas une couleur de remplissage omniprésente. Le sauge apporte fraîcheur, équilibre et mouvement. L’encre prune remplace le noir pur. Le gris neutre sert aux surfaces secondaires.

Utiliser le prune surtout pour les CTA principaux, états actifs, sélections, highlights et moments importants. Utiliser le sauge surtout pour la progression, les états secondaires, accents contextuels et éléments positifs/d’avancement.

Ne pas introduire comme couleurs de marque : rouge, jaune, orange, bleu SaaS générique ou violet IA générique.

Toujours préserver des contrastes accessibles.

### Densité colorée

Le blanc reste la base de KREW, mais il ne doit jamais produire de longs “murs blancs”.

Une longue page doit être rythmée par une alternance maîtrisée entre :

- blanc ;
- gris neutre / crème très léger ;
- sauge très léger ;
- prune très léger ;
- photographie ;
- grande composition graphique.

Le rythme visuel doit venir de ces surfaces, de la photographie et de la composition — pas d’une multiplication de cards.

Éviter plus de deux grands chapitres successifs sur exactement le même fond blanc lorsqu’aucune image, dataviz ou composition forte ne structure déjà l’espace.

Le prune reste une signature.
Le sauge reste un soutien.
Les fonds colorés doivent rester subtils.

---

## 5. PHOTOGRAPHIE + ILLUSTRATION

KREW utilise **les deux**, avec une hiérarchie claire.

### Photographie = le voyage réel

Prioritaire pour destinations, logements, restaurants, activités, expériences, grands moments et hero sections.

Style : éditorial, authentique, humain, désirable et légèrement spontané. Éviter les photos stock trop génériques ou artificiellement parfaites.

### Illustration = la personnalité KREW

Utiliser en petites touches : traits dessinés, flèches, tracés de trajet, étoiles, annotations, petits objets de voyage et motifs éditoriaux simples.

Style recherché : **carnet de voyage contemporain / magazine éditorial vivant**.

À éviter : 3D, isométrique, personnages génériques, packs d’illustrations startup, grosses illustrations IA ou illustrations qui remplacent la photographie réelle.

---

## 6. LOUTRES KREW

Les loutres sont des personnages de marque, pas des pictogrammes décoratifs.

Chaque loutre doit être utilisée uniquement dans son contexte sémantique.

Mapping officiel :

- `availability.png` → disponibilités
- `preferences.png` → questionnaires / préférences
- `destination.png` → destinations
- `accommodation.png` → hébergements
- `transport.png` → transport
- `planning.png` → planning
- `trip-preparation.png` → tâches / à emporter / préparation
- `trip-progress.png` → progression globale / parcours
- `next-action.png` → prochaine action réellement déterminée
- `searching.png` → vraie recherche ou génération en cours
- `completed.png` → état réellement terminé
- `lets-go.png` → lancement, voyage prêt ou CTA de départ pertinent

### Tailles de référence

- loutre de grand chapitre (Disponibilités, Questionnaire, Destination, Hébergement, Transport, Planning, Tâches, À emporter) : **72px mobile**, **84–88px desktop**
- micro exceptionnel : **40–48px**
- petite : **48–56px**
- moyenne : **64–84px**
- hero : **96–128px**

Règles :

- une loutre sémantique importante ne doit pas être masquée sur mobile simplement avec `hidden sm:block` ;
- sur mobile, réduire ou repositionner plutôt que supprimer ;
- maximum une loutre hero par grande zone ;
- une loutre ne doit jamais masquer un texte, bouton ou contrôle ;
- une loutre ne doit jamais être ajoutée uniquement pour remplir du vide.

---

## 7. KrewIcons — système iconographique officiel

`KrewIcon` est le système iconographique principal de KREW.

Si une `KrewIcon` sémantiquement correcte existe, elle doit être utilisée avant Lucide.

Mapping officiel :

- invitation → `invite`
- disponibilités → `availability`
- préférences → `preferences`
- profil → `profile`
- destination → `destination`
- hébergement → `accommodation`
- transport → `transport`
- avion → `plane`
- train → `train`
- voiture → `car`
- marche → `walk`
- bateau → `boat`
- planning → `planning`
- tâches → `tasks`
- à emporter → `packing`
- budget → `budget`
- dates → `calendar`
- participants → `group`
- carte / localisation → `map`
- photos → `camera`
- repas → `food`
- boissons → `drink`
- nature → `nature`
- plage → `beach`
- fête → `party`
- horaires / durée → `time`
- vote → `vote`
- favori / Star → `favorite`
- réservé → `booked`
- attention → `attention`
- terminé → `check`
- message → `message`
- recherche → `search`
- ajouter → `plus`

Lucide reste autorisé uniquement lorsqu’aucune `KrewIcon` correcte n’existe.

Ne jamais utiliser une mauvaise `KrewIcon` uniquement pour supprimer Lucide.

---

## 8. KrewMarks — annotations sémantiques

Les `KrewMarks` sont des annotations graphiques attachées à une information réelle.

Ils ne sont pas utilisés pour remplir un espace vide.

Usage officiel :

- `underline` / `underline-wave` → mot ou titre précis ;
- `highlight` → information ou expression précise ;
- `circle` → donnée ou sélection réellement entourée ;
- `heart` → vrai favori ;
- `check` → vrai état terminé ;
- `arrow-*` → cible réelle et identifiable ;
- `connector` → relation réelle entre deux éléments.

Règle absolue :

> Si l’on ne peut pas répondre précisément à “Qu’est-ce que ce mark désigne ?”, le mark doit être supprimé.

Interdit :

- cercle qui n’entoure rien ;
- ligne flottante ;
- flèche sans cible ;
- connector sans relation réelle ;
- symbole décoratif posé au hasard.

---

## 9. KrewNote & post-it

`KrewNote` et `KrewCallout` représentent la voix manuscrite de KREW.

Police obligatoire : **Caveat**.

Usage :

- commentaire sur une progression réelle ;
- rappel contextuel ;
- choix réellement effectué ;
- statut existant ;
- information courte issue des données.

Densité :

- écran court : **0 à 1**
- écran long : **1 à 2 visibles simultanément maximum**

Taille & style :

- police : **Caveat**
- taille : **14–15px minimum**
- padding généreux (`py-1.5 px-3`)
- rotation maximum : **±2°**
- ne jamais ajouter de `✦` décoratif automatique

Un post-it doit être physiquement proche de l’élément qu’il commente.

Ne jamais inventer :

- un chiffre ;
- un statut ;
- une décision ;
- un message métier ;
- une recommandation non présente dans les données.

Exemples légitimes :

- “2 réponses manquent”
- “choisi par le groupe”
- “réservé”
- “prochaine action”
- progression réelle

uniquement lorsque ces informations existent réellement.

---

## 10. KrewHighlight

`KrewHighlight` sert à faire ressortir une information importante.

Il doit être attaché au texte, jamais flotter comme décoration.

Cibles idéales :

- pourcentage de compatibilité ;
- budget ;
- prix ;
- date validée ;
- profil sélectionné ;
- total ;
- progression importante.

Le highlight reste visuellement derrière le texte.

Il ne remplace pas une surface de section entière.

---

## 11. Densité visuelle & anti-vide

KREW ne doit pas paraître vide simplement pour paraître premium.

Le whitespace doit être intentionnel.

Sur une grande zone, au moins un élément doit structurer l’espace :

- photo ;
- loutre ;
- surface sauge / neutre / prune très légère ;
- blob ;
- dataviz ;
- grande donnée ;
- post-it ;
- composition éditoriale.

Ne jamais combler le vide avec :

- petits traits aléatoires ;
- cercles sans cible ;
- micro-badges ;
- icônes décoratives gratuites ;
- shadows ;
- cards supplémentaires.

Une zone peut rester très blanche si une grande photographie, une dataviz ou une hiérarchie éditoriale forte suffit déjà à la structurer.

---

## 12. COMPOSITION, GRILLE & ESPACEMENT

KREW ne doit pas être construit comme **Titre → card → card → card → card**.

Les cards sont des composants, pas le langage visuel complet.

Privilégier grandes images, compositions ouvertes, whitespace, hiérarchie forte, asymétrie lorsque pertinente, variations de rythme et informations révélées progressivement.

### Headers de grandes sections produit

Pour les grands chapitres produit :

- mobile : **28–30px**
- desktop : **30–34px**
- Instrument Serif
- description : **15–16px**

### Placement loutre + texte

Une loutre ne doit jamais imposer un `padding-right` massif au texte pour exister.

Sur mobile, le titre conserve sa largeur fonctionnelle.
La loutre est repositionnée, décalée ou placée sur une ligne adjacente si nécessaire.

### Liens d’action

Une action importante doit être visible sans hover.

Taille : **14–15px minimum**.

Utiliser lorsque pertinent : `KrewIcon + libellé + arrow/external indicator`.

### Micro-textes

- 10px : exception extrêmement secondaire uniquement
- 11px : micro-label rare
- 12–13px : vrai micro-label
- 13–14px : texte secondaire normal
- 15–16px : corps principal

### Surfaces ouvertes

Les grands chapitres ne doivent pas systématiquement utiliser : `rounded + border + bg-card`.

Les surfaces sauge/crème/prune clair peuvent structurer un chapitre sans border ni card fermée.

### Containers officiels

KREW utilise trois familles de containers.

#### Product Narrow

Pour :

- création de voyage ;
- disponibilités ;
- questionnaires ;
- questionnaire Star ;
- compte ;
- formulaires comparables.

Règles :

- `width: 100%`
- `max-width: 820px`
- centrage horizontal
- gutter mobile 360–430px : **16px minimum**
- tablette : **24px**
- desktop : **32px**

#### Product Wide

Pour :

- Mes voyages ;
- Trip Hub ;
- Récap ;
- Memories / Souvenirs ;
- grandes vues produit.

Règles :

- `max-width: 1200–1280px`
- gutter mobile : **16px minimum**
- tablette : **24px**
- desktop : **40px**

#### Public Editorial

Pour :

- landing ;
- tarifs ;
- à propos ;
- grandes pages publiques.

Règles :

- `max-width: 1280px`
- gutter mobile : **20px**
- tablette : **24px**
- desktop : **40px**

### Règle de sécurité responsive

Le texte, les boutons, inputs, calendriers, listes, cards fonctionnelles et données ne doivent jamais sortir de ces gutters.

Seuls peuvent volontairement dépasser :

- photographie ;
- loutre ;
- blob ;
- KrewMark ;
- élément éditorial purement décoratif.

Tout débordement décoratif doit être contrôlé et ne jamais masquer une information.

### Alignement

**Organique ne signifie jamais mal aligné.**

Les éléments fonctionnels d’un même niveau doivent partager :

- le même axe ;
- le même padding ;
- la même logique de largeur ;
- des hauteurs cohérentes ;
- une hiérarchie typographique cohérente.

L’asymétrie KREW est réservée aux éléments éditoriaux et décoratifs :

- photos ;
- loutres ;
- KrewMarks ;
- blobs ;
- post-it ;
- compositions narratives.

Elle ne doit pas affecter :

- formulaires ;
- listes ;
- boutons ;
- données ;
- navigation ;
- tableaux ;
- contrôles.

### Échelle d’espacement de référence

- `4px` — micro-gap
- `8px` — petit espacement
- `12px` — éléments liés
- `16px` — espacement courant
- `24px` — groupes / cartes
- `32px` — sections compactes
- `48px` — respiration éditoriale
- `64px` — grande séparation
- `96px` — grands rythmes desktop / landing

Éviter les valeurs arbitraires répétées si un token existant peut être utilisé.

> **Plus l’utilisateur découvre, plus l’interface respire. Plus il décide, plus l’information devient précise.**

---

## 13. FORMES, SURFACES & PROFONDEUR

Direction : **Éditorial dans la structure. Doux dans l’interaction.**

Préférer arrondis modérés, bordures discrètes, surfaces simples, boutons légèrement arrondis et peu d’ombres.

Éviter gros `border-radius` partout, pill buttons systématiques, cards imbriquées, glow, ombres de dashboard, glassmorphism et gradients omniprésents.

La profondeur doit venir surtout de l’espace, la photographie, la hiérarchie et les contrastes subtils.

---

## 14. MOTION

Animation : **présente mais élégante**.

Utiliser pour transitions, reveal d’images, progression, sélection, hover/pressed, feedback et loading/success/error.

> Une animation doit expliquer, accompagner ou donner du plaisir à l’action. Elle ne doit jamais ralentir l’utilisateur.

Respecter `prefers-reduced-motion`.

---

## 15. RESPONSIVE

Le responsive doit être **natif**. Mobile ≠ desktop compressé.

Adapter réellement composition, ordre du contenu, navigation, taille et cadrage des images, CTA, densité, typography scale et interactions.

Chaque écran important doit être vérifié au minimum sur desktop et mobile.

Les breakpoints de contrôle visuel KREW sont :

- 360px
- 390px
- 430px
- 768px
- 1024px
- 1440px

À 390px :

- aucun contenu fonctionnel à moins de 16px du viewport ;
- aucun overflow horizontal ;
- aucun titre coupé ;
- aucune loutre sur un texte ;
- aucun post-it sur un CTA ;
- aucun mark flottant ;
- aucun blob sur une donnée ;
- aucun bouton ou input hors écran ;
- aucune modale ou dropdown hors viewport ;
- aucune différence de gutter entre loading, error et loaded state.

Le responsive doit repositionner les compositions, pas simplement réduire le desktop.

---

## 16. LANDING PAGE

Ne pas repartir de zéro.

Préserver les qualités actuelles : présentation claire du projet, narration, interactivité, section **« Comment ça marche »** et pédagogie.

Améliorer direction artistique, photographie, illustration, typographie, rythme, transitions et responsive.

Conserver **LA TEAM. LE PLAN. LE MOMENT.**

Ne pas transformer la landing en landing SaaS générique.

---

## 17. DASHBOARD & TEAM

Le dashboard doit rester **simple et peu verbeux**.

En quelques secondes, l’utilisateur doit comprendre : quel voyage, qui participe, qui a répondu, qui n’a pas encore répondu, où en est le groupe et quelle est la prochaine action importante.

### Bloc participants

Autorisé : progression visuelle légère, statuts clairs, prénoms/identifiants existants.

Interdit : photos des participants, galerie d’avatars décorative, profils détaillés, feed social, gamification, sous-dashboard ou longs paragraphes.

La progression visuelle ne remplace jamais **qui participe / qui a répondu / qui n’a pas répondu**.

---

## 18. QUESTIONNAIRES — ZONE PROTÉGÉE

Les questionnaires existants sont **fonctionnellement intouchables**.

Le redesign peut modifier uniquement : typographie, couleurs, spacing, layout, transitions, feedback, responsive et micro-interactions.

Ne jamais modifier : questions, réponses, formulation, ordre, validation, scoring, données collectées, mapping, persistance, conditions métier ou comportement de soumission.

Si une amélioration visuelle nécessite un changement fonctionnel : **NE PAS LA FAIRE.**

---

## 19. DESTINATIONS, EXPÉRIENCES & LOGEMENTS

### Destinations

Présenter une destination comme **une possibilité de voyage**, pas une fiche de base de données.

Priorité : image/identité, raison de pertinence déjà fournie par KREW, informations essentielles, action.

Ne jamais inventer une justification ou une donnée.

### Expériences

Présenter les activités comme des **moments du voyage** lorsque le contenu s’y prête : matinée, après-midi, dîner, soirée, détente, découverte.

Ne pas modifier les activités ou leur logique.

### Logements

Conserver strictement les catégories générées existantes, notamment Budget, Luxe, Bon rapport qualité-prix, Conviviale et autres catégories déjà présentes.

Ne pas créer une nouvelle taxonomie.

Faire ressortir immédiatement les informations utiles déjà disponibles : catégorie, photo, nom, configuration, capacité, prix, disponibilité lorsqu’elle est connue et action.

---

## 20. BUDGET

Objectif : **Comprendre le budget en environ trois secondes.**

Conserver dépenses du groupe, répartition du budget, coût, coût par personne et éléments clés déjà présents.

Utiliser Space Mono pour les chiffres importants.

Éviter dashboard financier, nouvelles métriques, graphiques inutiles et logique comptable complexe.

### Budget ≠ paiement

KREW ne doit pas devenir intermédiaire de paiement.

Ne jamais réintroduire « Payer ma part », checkout, wallet, collecte d’argent ou paiement intégré.

---

## 21. PLANNING & TÂCHES

Le planning doit ressembler à **un voyage**, pas à un calendrier professionnel.

Préserver chronologie, créneaux, données, génération et logique existante.

Les tâches doivent rester simples : à faire, fait, action.

Ne pas transformer KREW en Trello / Asana.

---

## 22. ACCESSIBILITÉ

Le design doit préserver contraste, focus visible, clavier, labels, structure sémantique, touch targets, reduced motion et lisibilité.

La beauté ne justifie jamais une perte d’accessibilité.

---

## 23. STACK UI À RESPECTER

Le redesign doit partir du stack existant du repository, pas en inventer un nouveau.

Stack actuel à privilégier :

- React ;
- TanStack Start / Router ;
- Vite ;
- Tailwind CSS 4 ;
- primitives Radix UI déjà installées ;
- composants UI existants ;
- `class-variance-authority`, `clsx`, `tailwind-merge` ;
- **KrewIcon** comme système iconographique principal de la marque ;
- **Lucide React** uniquement comme fallback lorsqu’aucune KrewIcon sémantiquement correcte n’existe.

Les primitives visuelles KREW officielles sont notamment :

- `KrewIcon`
- `KrewMark`
- `KrewHighlight`
- `KrewNote`
- `KrewCallout`
- `KrewAnnotation`
- `KrewConnector`
- `KrewOrganicBlob`
- `KrewSectionWave`
- `KrewProgressRing`
- `KrewPhotoOverlay`

Réutiliser ces primitives avant de créer un nouveau pattern one-off.

---

## 24. ANTI-AI-SLOP

Éviter explicitement :

- dashboard SaaS générique ;
- gradients violet/bleu gratuits ;
- glassmorphism ;
- cards partout ;
- pill buttons partout ;
- grosses ombres ;
- glow ;
- icônes décoratives inutiles ;
- emojis comme système graphique ;
- hero artificiellement énorme ;
- textes marketing inventés ;
- illustrations startup génériques ;
- design identique page après page sans composition ;
- fausses données pour « faire joli » ;
- micro-textes systématiques en 10–11px ;
- loutres minuscules utilisées comme pictogrammes ;
- lignes et cercles sans cible ;
- marks décoratifs gratuits ;
- murs blancs successifs sans rythme ;
- backgrounds colorés arbitraires ;
- post-it inventant une donnée ;
- répétition mécanique du même pattern sur toutes les pages.

---

## 25. DESIGN INTEGRITY CHECK

Avant de considérer une grande zone terminée, vérifier :

### Identité
- Est-ce clairement KREW ?
- Est-ce éditorial, contemporain, humain ?
- Est-ce suffisamment fun sans devenir enfantin ?

### Simplicité
- L’information essentielle se comprend-elle immédiatement ?
- Y a-t-il trop de texte ou trop de composants ?
- Le design masque-t-il correctement la complexité du moteur ?

### Cohérence
- Les tokens sont-ils respectés ?
- Les composants similaires se comportent-ils de la même manière ?
- Aucune couleur / typo / ombre / radius arbitraire n’a-t-il été introduit ?
- Les gutters sont-ils identiques entre pages comparables ?
- Le corps principal reste-t-il lisible à 15–16px ?
- Les éléments secondaires sont-ils au moins 13–14px sauf vrai micro-label ?
- Les loutres sont-elles suffisamment visibles ?
- Chaque KrewMark a-t-il une cible identifiable ?
- Chaque post-it commente-t-il une vraie donnée ?
- La page évite-t-elle les longs murs blancs ?
- Les surfaces colorées servent-elles réellement la composition ?

### Fonctionnel
- Questionnaires inchangés fonctionnellement ?
- Moteur inchangé ?
- Données non inventées ?
- Catégories logements conservées ?
- Budget simple ?
- Aucun paiement réintroduit ?

### Qualité
- Desktop vérifié ?
- Mobile vérifié ?
- Loading / empty / error / success vérifiés ?
- Accessibilité vérifiée ?
- Motion cohérente ?
- 360px vérifié ?
- 390px vérifié ?
- 430px vérifié ?
- 768px vérifié ?
- 1024px vérifié ?
- 1440px vérifié ?

---

## 26. DO / DON’T VISUEL KREW

### DO

- utiliser une vraie photo lorsque disponible ;
- utiliser KrewIcon avant Lucide ;
- utiliser une loutre uniquement dans son contexte sémantique ;
- utiliser KrewHighlight pour une vraie donnée importante ;
- utiliser KrewNote pour une information réelle et courte ;
- utiliser les surfaces sauge / neutres pour rythmer les longues pages ;
- garder les éléments fonctionnels parfaitement alignés ;
- réduire ou repositionner les éléments graphiques sur mobile.

### DON’T

- ne pas utiliser `10px` pour une information normale ;
- ne pas utiliser une loutre importante en 32–40px ;
- ne pas cacher automatiquement une loutre sémantique sur mobile ;
- ne pas mettre un cercle qui n’entoure rien ;
- ne pas mettre une flèche sans cible ;
- ne pas utiliser un connector sans relation réelle ;
- ne pas inventer une donnée pour alimenter un post-it ;
- ne pas créer une card uniquement pour séparer deux contenus ;
- ne pas remplir une page blanche avec des micro-décorations ;
- ne pas utiliser plusieurs héros graphiques concurrents dans la même zone ;
- ne pas utiliser Lucide lorsqu’une KrewIcon correcte existe ;
- ne pas sacrifier l’alignement au nom du style “organique”.

---

## 27. RÈGLE DE PRIORITÉ

En cas de conflit :

1. **Fonctionnement existant**
2. **Compréhension**
3. **Cohérence KREW**
4. **Esthétique**
5. **Nouveauté visuelle**

Le redesign doit transformer l’expérience visuelle sans transformer le produit.

Le résultat final doit donner envie de dire :

> **« Ça va être fun. »**  
> **« C’est vraiment beau. »**  
> **« Ça a l’air hyper simple. »**

---

## 28. GRAMMAIRE COMMUNE DES PAGES PRODUIT

Les pages du parcours doivent être reconnues comme appartenant au même produit **sans devenir des copies les unes des autres**.

La structure de lecture commune est :

1. contexte du voyage / retour ;
2. titre de page ;
3. vague ou soulignement KREW attaché au titre ;
4. introduction courte si nécessaire ;
5. contenu principal ;
6. action principale clairement identifiable.

Cette grammaire est commune, mais la composition du contenu doit rester adaptée au rôle réel de la page.

### Niveaux de titre — clarification

- **H1 éditorial / hero public ou dashboard principal** : 40–44px mobile, 48–58px desktop.
- **H1 de chapitre produit / page du parcours** : 28–30px mobile, 30–34px tablette/desktop.
- **H2 interne** : 26–32px selon le niveau de hiérarchie.

Ne jamais choisir arbitrairement entre ces niveaux selon l’espace disponible : le niveau dépend du rôle sémantique de la page.

### Largeur utile

Un container officiel définit les gutters, mais **ne suffit pas à composer la page**.

Sur tablette et desktop, une page ne doit pas laisser son contenu principal occuper une petite colonne au centre d’un grand écran si aucune raison fonctionnelle ne l’impose.

- une page réellement formulaire peut rester `Product Narrow` ;
- une page de comparaison, choix, logistique ou organisation doit exploiter une largeur plus généreuse lorsque cela améliore la lecture ;
- le contenu peut être distribué en deux zones ou en composition asymétrique sans enfermer chaque zone dans une card ;
- une grande zone vide doit être intentionnelle et structurée, pas simplement résulter d’un `max-width` trop faible.

### Une seule priorité d’action

Chaque page doit répondre immédiatement à : **« qu’est-ce que je dois faire maintenant ? »**

- une seule action principale doit dominer visuellement ;
- les actions secondaires doivent être clairement subordonnées ;
- un CTA principal ne doit pas rivaliser avec un post-it, une illustration ou un CTA secondaire de même poids ;
- l’action principale doit rester identifiable sans hover et sans devoir lire toute la page.

---

## 29. FAMILLES DE PAGES DU PARCOURS

Les pages du parcours sont regroupées en familles de composition. Ces familles servent à assurer la cohérence sans imposer un template unique.

### A. Questionnaire dense

Exemple principal : Préférences.

Objectif : permettre une longue saisie sans effet tunnel.

Règles :

- conserver strictement questions, réponses, ordre et logique métier ;
- créer une scansion visuelle nette entre grands chapitres ;
- mettre davantage d’espace **entre chapitres** qu’entre questions liées ;
- éviter que toutes les questions aient exactement le même poids visuel ;
- ne pas transformer chaque chapitre en card ;
- rendre la position dans le questionnaire perceptible sans ajouter une navigation métier nouvelle.

### B. Interaction structurée

Exemples : Invite, Disponibilités, Transport.

Objectif : faire accomplir une tâche principale claire.

Règles :

- hiérarchiser fortement action, résultat et informations secondaires ;
- sur tablette/desktop, exploiter la largeur pour rapprocher les informations qui se répondent ;
- éviter l’effet « petit widget au milieu d’une grande page » ;
- conserver une colonne simple sur mobile lorsque c’est plus lisible.

### C. Choix & propositions

Exemples : Profil du voyage, Destination, Hébergement.

Objectif : comparer puis choisir.

Règles :

- mettre d’abord en évidence l’objet du choix et sa pertinence ;
- préserver photos et données existantes ;
- différencier clairement sélectionné, disponible, verrouillé et secondaire ;
- ne pas créer une grille SaaS générique ;
- la personnalité de chaque chapitre doit venir de son contenu réel, pas d’une décoration gratuite.

### D. Organisation du voyage

Exemples : Planning, Tâches, À emporter.

Objectif : transformer les décisions en plan concret.

Règles :

- privilégier chronologie, listes, regroupements et progression naturelle ;
- ne pas transformer KREW en outil de gestion de projet ;
- réduire les bordures et cards lorsque la structure du contenu suffit ;
- conserver des signatures propres à chaque page : chronologie pour Planning, actions pour Tâches, catégories pour À emporter.

---

## 30. ÉTATS VIDES, VERROUILLÉS ET EN ATTENTE

Un état verrouillé ou incomplet doit rester une **vraie page KREW**, jamais donner l’impression d’un écran non terminé.

Il doit répondre visuellement à trois questions :

1. **Pourquoi cette étape n’est-elle pas disponible ?**
2. **Qu’attend-on maintenant ?**
3. **Qu’est-ce qui apparaîtra ensuite ?**

Autorisé :

- message court et concret ;
- progression réelle ;
- nombre de réponses manquantes si la donnée existe ;
- préfiguration visuelle très légère du futur contenu ;
- loutre sémantiquement correcte ;
- structure fantôme / exemple abstrait non présenté comme donnée réelle.

Interdit :

- fausses destinations, faux prix, fausses tâches, faux horaires ou faux statuts ;
- énorme card grise générique comme seule composition ;
- page composée uniquement d’un titre + deux lignes + un grand mur blanc ;
- décoration aléatoire ajoutée uniquement pour remplir l’espace.

Une préfiguration doit indiquer la **forme** du contenu futur, jamais inventer son **contenu**.

---

## 31. ZONES SÛRES & ANTI-CHEVAUCHEMENT

La non-collision est une règle de structure, pas une correction visuelle ponctuelle.

> **Aucun élément décoratif en position absolue ne doit dépendre d’une hauteur ou d’une largeur de texte dynamique pour ne pas chevaucher le contenu.**

### Zones fonctionnelles protégées

Les zones suivantes sont toujours prioritaires et doivent rester libres :

- titre et sous-titre ;
- paragraphes dynamiques ;
- CTA ;
- formulaires ;
- données ;
- listes ;
- résultats générés ;
- messages d’erreur, loading et success.

Loutres, KrewMarks, blobs, post-it et annotations peuvent être absolus uniquement lorsqu’une zone décorative sûre est explicitement réservée ou lorsque leur ancrage dépend d’un élément de taille maîtrisée.

### Règles pratiques

- ne pas résoudre la présence d’une loutre avec un `padding-right` arbitraire important ;
- si le titre peut passer sur deux ou trois lignes, la décoration doit rester valide ;
- un post-it dynamique doit rester dans le flux ou dans une zone dont la hauteur est réservée ;
- une flèche absolue doit conserver une cible claire sur tous les breakpoints ;
- tout contenu utilisateur ou généré doit pouvoir s’allonger sans collision ;
- une correction locale de chevauchement ne doit jamais introduire une nouvelle valeur magique uniquement valable pour un viewport.

---

## 32. TABLETTE — FORMAT DE PREMIER RANG

La tablette n’est ni un mobile élargi ni un desktop réduit.

Les contrôles visuels prioritaires sont **768px, 834px et 1024px** lorsque le layout change significativement.

À largeur tablette :

- les pages doivent exploiter l’espace sans étirer artificiellement les lignes de texte ;
- les compositions à deux zones sont autorisées et souvent préférables pour les pages d’interaction ou logistique ;
- les contenus `Product Narrow` ne doivent pas sembler perdus au centre d’un grand écran ;
- les loutres et annotations doivent rester liées au contenu qu’elles commentent ;
- aucune composition desktop absolue ne doit être simplement réduite proportionnellement ;
- portrait et paysage doivent rester lisibles sans overflow ni grandes zones mortes accidentelles.

Un écran validé en 390px et 1440px n’est **pas** considéré comme validé si sa version tablette est déséquilibrée.

---

## 33. DENSITÉ & RYTHME DE PAGE

Deux erreurs sont à éviter avec la même vigilance :

- **trop vide** : contenu minuscule entouré de murs blancs accidentels ;
- **trop dense** : suite continue d’éléments de même poids sans respiration ni chapitre identifiable.

### Page courte

Une page courte peut rester sobre, mais son espace doit être structuré par le contenu réel, une composition, une préfiguration d’état ou un élément de marque pertinent.

### Page longue

Une page longue doit créer un rythme perceptible : chapitres, changements de densité, surfaces légères, photographie ou composition.

Ne jamais ajouter des cards uniquement pour créer ce rythme.

### Principe

> **Espace respirant = espace qui améliore la compréhension. Vide accidentel = espace qui fait paraître le produit incomplet.**

---

## 34. INTERDITS STRUCTURELS

En complément des règles anti-AI-slop, les pratiques suivantes sont interdites dans les pages produit :

- créer un deuxième langage graphique local pour une seule page ;
- ajouter une card pour résoudre un problème de composition qui peut être résolu par grille, espacement ou hiérarchie ;
- ajouter une décoration uniquement pour combler un vide ;
- positionner un élément décoratif absolu au-dessus d’un contenu dynamique sans zone sûre ;
- choisir une largeur arbitraire page par page sans se rattacher à une famille de composition ;
- répéter le même pattern visuel sur toutes les pages au nom de la cohérence ;
- transformer une page simple en dashboard pour occuper l’espace ;
- transformer une page dense en empilement de cards ;
- ajouter un correctif CSS dont l’unique rôle est d’écraser un autre correctif CSS existant sans traiter la source du conflit.

---

## 35. GOUVERNANCE DU DESIGN & CSS

`DESIGN.md` est la **source de vérité visuelle** du repository.

Une correction UX/UI doit d’abord être rattachée à une règle de ce document ou à une exception explicitement justifiée.

### Principe de correction

> **Corriger à la source plutôt qu’empiler des overrides.**

Avant d’ajouter une nouvelle feuille de style, une nouvelle classe de patch ou une nouvelle variante locale :

1. identifier le composant ou la règle réellement responsable ;
2. vérifier si le problème existe sur plusieurs pages ;
3. corriger le composant partagé lorsque c’est bien la cause ;
4. préserver les pages déjà correctes ;
5. ne créer une exception locale que si le besoin est réellement propre à la page.

Les couches successives de type `review`, `polish`, `refinement`, `wavefix`, `alignment` ne doivent pas devenir la méthode normale de correction.

Une nouvelle couche CSS transverse n’est autorisée que si :

- elle possède un rôle unique et documenté ;
- elle remplace ou consolide les règles qu’elle rend obsolètes ;
- elle ne sert pas seulement à gagner la cascade CSS ;
- son impact mobile, tablette et desktop est vérifié.

### Validation visuelle obligatoire

Pour toute modification significative d’une page du parcours, vérifier au minimum :

- 390×844 ;
- 834×1112 ;
- 1440×1000 ;
- état pertinent parmi loading / empty / locked / loaded / error / success ;
- absence d’overflow horizontal ;
- absence de collision texte / loutre / post-it / KrewMark ;
- cohérence avec les pages adjacentes du parcours.

Une page n’est pas considérée terminée uniquement parce qu’elle est correcte isolément : **elle doit rester cohérente lorsqu’elle est comparée aux pages avant et après elle.**
