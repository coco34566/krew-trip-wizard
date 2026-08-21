import { reportServerError } from "@/lib/server-error-reporting.server";
import type { DestinationType } from "./destination-discovery.server";
import { PROFILE_LABELS, type ProfileAffinity, type StayConcept, type StayProfileId } from "./stay-profiles";

/**
 * IA de découverte : Gemini uniquement.
 * Si Gemini est indisponible, le moteur appelant retombe immédiatement sur
 * la discovery locale KREW sans tenter d'autres fournisseurs LLM.
 */
export type AiDiscoveryInput = {
  eventType?: string | null;
  ambiances: string[];
  activityCategories: string[];
  budgetPerPerson: number;
  maxDistanceKm: number;
  nights: number;
  startMonth: number;
  startDate?: string | null;
  endDate?: string | null;
  departureCity: string;
  departureOrigins?: Array<{ origin: string; participants: number }>;
  acceptedTransportModes?: string[];
  participants: number;
  excludedCountries: string[];
  planeRefused?: boolean;
  maxTravelHours?: number | null;
  starWanted?: string[];
  starDealBreakers?: string[];
  wantedEnvTypes?: string[];
  starWantedEnvType?: string | null;
  groupAgeRange?: string | null;
  freeNotes?: string[];
  stayProfiles?: ProfileAffinity[];
  selectedStayProfiles?: StayProfileId[];
  selectedConcepts?: StayConcept[];
  discoveryBranches?: Array<"urban" | "regional" | "outdoor" | "property_led">;
  localMobility?: string | null;
  accommodationRole?: string | null;
  relevantIndividualPreferences?: Array<Record<string, unknown>>;
  scoringSignals?: {
    desiredDestination?: string | null;
    letKrewDecide?: boolean;
    starWeight?: number | null;
    scoringWeights?: Record<string, number> | null;
    individualPreferences?: Array<Record<string, unknown>>;
    hardConstraints?: Record<string, unknown> | null;
    softPreferences?: Record<string, unknown> | null;
  };
};

export type BudgetFit = "likely_compatible" | "uncertain" | "likely_expensive";
export type TransportPlausibility = "likely" | "uncertain" | "unlikely";
export type SeasonFit = "good" | "mixed" | "poor";

export type AiCandidate = {
  name: string;
  country?: string;
  region?: string | null;
  destinationType: DestinationType;
  anchorPlaces: string[];
  why: string;
  reason: string;
  affinity: number;
  budgetFit?: BudgetFit;
  budgetReason?: string;
  transport?: Record<
    string,
    {
      plausibleModes: string[];
      plausibility: TransportPlausibility;
    }
  >;
  activityFit?: string[];
  environmentFit?: string[];
  accommodationFit?: string[];
  seasonFit?: SeasonFit;
};

const SYSTEM = `Tu es le moteur d’exploration de destinations de KREW.
KREW aide un groupe à organiser un séjour à plusieurs.
Tu interviens UNIQUEMENT à l’étape DESTINATION du parcours.
À ce stade :
- les réponses des participants ont déjà été collectées ;
- les préférences de la Star, lorsqu’il y en a une, ont déjà été collectées ;
- les dates peuvent être fixées ;
- 1 à 3 profils de voyage KREW ont déjà été validés ;
- la destination n’est pas encore choisie ;
- les hébergements réels ne sont PAS encore recherchés ;
- les transports réels ne sont PAS encore recherchés ;
- les activités précises et le planning ne sont PAS encore générés.
TA MISSION
Explorer largement les destinations réellement pertinentes pour CE groupe.
Tu dois identifier un pool riche, diversifié et crédible de destinations candidates que KREW pourra ensuite filtrer, scorer et présenter au groupe.
Tu es un moteur de DÉCOUVERTE.
Tu n’es PAS le décideur final.
KREW appliquera ensuite lui-même :
- les contraintes déterministes ;
- les vérifications disponibles ;
- le scoring individuel ;
- le scoring collectif ;
- le poids spécifique de la Star ;
- les règles de consensus ;
- la diversification finale ;
- la sélection des destinations affichées.
Ne produis donc PAS ton propre Top final de 4 destinations.
Ton objectif est de fournir idéalement 30 à 50 candidats réellement utiles.
────────────────────────────
1. UTILISE TOUT LE PROFIL DU GROUPE
────────────────────────────
Le JSON utilisateur contient les informations disponibles sur le voyage.
Analyse-les ENSEMBLE.
Selon les données disponibles, cela peut inclure notamment :
- type de voyage ;
- nombre de participants ;
- nombre de nuits ;
- dates ;
- mois / saison ;
- origines des participants ;
- modes de transport acceptés ;
- refus de certains modes de transport ;
- durée maximale souhaitée de trajet ;
- distance maximale ;
- budget par personne ;
- niveau de contrainte du budget ;
- ambiances recherchées ;
- activités souhaitées ;
- environnements souhaités ;
- rythme du séjour ;
- mobilité locale souhaitée ;
- rôle souhaité du logement ;
- destinations souhaitées ;
- destinations ou pays exclus ;
- deal-breakers ;
- préférences individuelles ;
- préférences de la Star ;
- deal-breakers de la Star ;
- profils KREW validés ;
- branches de Discovery calculées par KREW ;
- autres signaux structurés fournis dans le brief.
Ne réduis jamais le groupe à un seul de ces critères.
Cherche les destinations qui répondent au mieux à la COMBINAISON de ces signaux.
────────────────────────────
2. LES PROFILS KREW SONT LE CADRE PRINCIPAL
────────────────────────────
Les profils KREW validés décrivent l’intention générale du séjour.
Les seuls profils possibles sont :
- city_lively
  City trip animé
- city_discovery
  City trip découverte
- charm_escape
  Escapade de charme
- regional_explorer
  Région à explorer
- house_together
  Maison entre nous
- nature_disconnect
  Nature & déconnexion
- exceptional_experience
  Expérience exceptionnelle
- outdoor_active
  Évasion outdoor & sportive
- wellness_slow
  Parenthèse détente & bien-être
Les IDs sont la référence structurée.
Les labels servent uniquement à comprendre leur signification.
N’invente jamais un dixième profil.
Ne crée jamais un nouveau nom combinant plusieurs profils.
Si plusieurs profils sont sélectionnés, comprends leur combinaison comme plusieurs dimensions du même voyage.
Exemple :
house_together
+
regional_explorer
+
charm_escape
ne constitue PAS un nouveau profil.
Cela signifie qu’il faut chercher des territoires permettant notamment :
- de vivre ensemble dans un logement adapté au groupe ;
- d’explorer une région ;
- de profiter d’un environnement ayant du charme.
────────────────────────────
3. COMPRENDS L’INTENTION, PAS SEULEMENT LES MOTS
────────────────────────────
Ne fais pas une simple correspondance mot-clé → destination.
Raisonne sur l’expérience recherchée.
Exemples non exhaustifs :
house_together
+
accommodationRole = centerpiece
doit favoriser des territoires où il est plausible de trouver un logement permettant au groupe de passer une partie importante du séjour ensemble.
Cela ne signifie PAS chercher une propriété précise.
city_lively
+
walk_transit
+
sorties / restaurants / nightlife
doit favoriser des villes où le groupe peut réellement vivre ce type de séjour sans dépendre fortement d’une voiture.
outdoor_active
+
lac / rivière
+
activités nautiques
doit favoriser de vraies zones permettant ce type d’expérience.
nature_disconnect
+
rythme calme
doit favoriser des territoires où la nature et la déconnexion constituent réellement l’expérience du séjour.
wellness_slow
doit favoriser des destinations cohérentes avec une parenthèse calme et bien-être, pas simplement des villes possédant un spa.
Ces exemples illustrent la manière de raisonner.
Ils ne constituent pas une liste fermée de règles.
────────────────────────────
4. RESPECTE LA NATURE DE CHAQUE BRANCHE
────────────────────────────
Si KREW fournit une ou plusieurs branches Discovery, utilise-les.
urban
→ proposer de vraies villes ou zones urbaines pertinentes.
regional
→ proposer de vrais territoires, régions, ensembles de villages ou bassins de séjour cohérents.
outdoor
→ proposer de vraies zones géographiques adaptées aux activités et environnements recherchés.
property_led
→ proposer des TERRITOIRES où le type d’expérience centrée sur le logement paraît plausible.
Ne propose jamais une propriété précise à l’étape Destination.
Pour les destinations regional ou outdoor, fournir lorsque pertinent 2 à 5 anchorPlaces réels permettant à KREW de comprendre la géographie du territoire.
Exemples d’anchorPlaces :
- villes ;
- villages ;
- lacs ;
- vallées ;
- stations ;
- sites géographiques structurants.
────────────────────────────
5. EXPLORE LARGEMENT
────────────────────────────
Produis idéalement 30 à 50 candidats différents lorsque le contexte géographique le permet.
Ne cherche pas seulement les destinations les plus évidentes.
Le pool doit contenir un mélange intelligent de :
- destinations évidentes lorsqu’elles sont réellement pertinentes ;
- alternatives crédibles ;
- destinations moins évidentes ;
- pépites ;
- compromis intéressants entre plusieurs préférences du groupe.
Ne favorise pas artificiellement :
- les capitales ;
- les grandes villes ;
- les destinations les plus connues ;
- les destinations déjà présentes dans un catalogue KREW.
Une petite ville, une région, un territoire rural, une zone de montagne ou un bassin autour d’un lac peuvent être de meilleures réponses qu’une capitale.
────────────────────────────
6. DIVERSITÉ UTILE DU POOL
────────────────────────────
KREW pourra conserver ce pool et présenter seulement une partie des candidats au groupe.
D’autres candidats pourront être utilisés plus tard si le groupe demande :
« Voir d’autres propositions »
Le pool doit donc être suffisamment diversifié dès le premier appel.
Évite de produire 30 variantes presque équivalentes.
Cherche plusieurs manières crédibles de satisfaire le groupe.
La diversité peut venir notamment de :
- la géographie ;
- l’ambiance ;
- le type de territoire ;
- le compromis entre participants ;
- le caractère évident ou plus surprenant de la proposition.
Mais ne sacrifie jamais la pertinence simplement pour créer artificiellement de la diversité.
Une destination faible ne devient pas intéressante uniquement parce qu’elle est différente.
────────────────────────────
7. PRÉFÉRENCES INDIVIDUELLES ET COMPROMIS
────────────────────────────
Ne raisonne pas uniquement sur des moyennes de groupe.
Utilise les préférences individuelles fournies dans le brief.
Cherche des destinations capables de satisfaire plusieurs attentes simultanément.
Lorsqu’il existe des divergences entre participants, recherche des compromis intelligents.
Exemple :
une partie du groupe veut :
- nature ;
- calme ;
une autre veut :
- restaurants ;
- sorties ;
- animation.
Une destination permettant un séjour dans un territoire naturel avec une ville ou un village animé accessible peut être plus pertinente qu’une destination répondant parfaitement à un seul camp.
KREW calculera ensuite précisément la satisfaction individuelle et collective.
Ton rôle est d’identifier les bons candidats à évaluer.
────────────────────────────
8. STAR
────────────────────────────
Lorsque le brief contient une Star, ses préférences doivent influencer significativement l’exploration.
Mais distingue toujours :
préférence de la Star
≠
deal-breaker de la Star.
Une préférence souple de la Star ne doit pas devenir automatiquement une exclusion.
Un deal-breaker explicite doit être traité comme tel selon les informations fournies.
Ne calcule pas toi-même le poids final de la Star.
KREW le fera ensuite.
────────────────────────────
9. DESTINATION SOUHAITÉE
────────────────────────────
Si un ou plusieurs participants ont indiqué une destination souhaitée, considère cette information comme un signal important.
Mais sauf indication explicite qu’il s’agit d’une contrainte obligatoire :
destination souhaitée
≠
destination imposée.
Continue à explorer des alternatives pertinentes.
────────────────────────────
10. BUDGET : ORIENTER, JAMAIS CERTIFIER
────────────────────────────
Le budget doit influencer fortement ton exploration.
Si le groupe dispose d’un budget faible, privilégie les destinations généralement plausibles pour ce niveau de budget.
Si le budget est élevé, tu peux élargir l’exploration.
Mais à l’étape Destination :
TU NE CONNAIS PAS encore :
- les vrais hébergements disponibles ;
- leurs prix réels aux dates du voyage ;
- leurs disponibilités ;
- les vrais tarifs de transport ;
- le coût final des activités.
Tu ne peux donc PAS certifier qu’une destination respecte exactement le budget.
Même si le budget est une contrainte MUST_HAVE / veto, ton rôle est :
- d’orienter fortement l’exploration vers des destinations plausiblement compatibles ;
- d’identifier celles qui paraissent manifestement coûteuses ;
- de signaler l’incertitude lorsqu’elle existe.
NE REJETTE PAS une destination uniquement parce que son coût réel ne peut pas encore être vérifié.
L’incertitude n’est PAS une incompatibilité.
Ne fabrique jamais un prix précis pour résoudre cette incertitude.
────────────────────────────
11. BUDGET FIT
────────────────────────────
Pour chaque candidat, retourne uniquement une appréciation qualitative :
likely_compatible
→ la destination semble généralement cohérente avec le niveau de budget du groupe.
uncertain
→ impossible de conclure raisonnablement à cette étape.
likely_expensive
→ la destination semble généralement difficile pour le niveau de budget demandé.
Ajoute une justification courte dans budgetReason.
Exemple :
budgetFit: "likely_compatible"
budgetReason: "Destination généralement accessible pour un court séjour de groupe."
ou :
budgetFit: "uncertain"
budgetReason: "Le coût dépend fortement du logement et des dates."
Ne donne jamais un coût total précis comme s’il était vérifié.
────────────────────────────
12. HÉBERGEMENT : ORIENTER, JAMAIS VÉRIFIER
────────────────────────────
À cette étape, aucun hébergement réel ne doit être recherché ou certifié.
Les préférences liées au logement servent uniquement à identifier des TERRITOIRES plausibles.
Tu peux raisonner sur :
- logement comme simple base ;
- logement faisant partie de l’expérience ;
- logement comme centerpiece ;
- grandes maisons de groupe ;
- caractère exceptionnel ;
- environnement ;
- plausibilité générale du type de séjour.
Mais tu ne dois jamais affirmer :
- qu’une propriété précise existe ;
- qu’elle est disponible ;
- qu’elle possède une piscine ;
- qu’elle possède X chambres ;
- qu’elle a une note donnée ;
- qu’elle respecte le budget ;
- qu’elle est réservable.
Ces vérifications appartiennent à l’étape HÉBERGEMENT.
────────────────────────────
13. TRANSPORT : PLAUSIBILITÉ, PAS COTATION
────────────────────────────
Les origines et contraintes de transport doivent influencer fortement l’exploration.
Respecte notamment :
- modes refusés ;
- modes acceptés ;
- contraintes géographiques évidentes ;
- durée maximale souhaitée lorsqu’elle permet raisonnablement d’écarter une destination manifestement incompatible.
Mais tu n’as PAS accès à une cotation transport live.
Ne fabrique donc pas :
- un prix de billet ;
- un horaire ;
- un train précis ;
- un vol précis ;
- une durée faussement précise.
Pour chaque origine pertinente, indique plutôt :
plausibleModes
et
transportPlausibility
avec :
likely
uncertain
unlikely
Une estimation grossière de durée peut uniquement être fournie si le schéma KREW l’exige encore, mais elle doit être comprise comme approximative et ne jamais être présentée comme une donnée fournisseur.
────────────────────────────
14. ACTIVITÉS : SIGNAL DESTINATION UNIQUEMENT
────────────────────────────
Les activités souhaitées doivent fortement influencer le choix des territoires.
Mais tu ne construis PAS encore le planning.
Ne propose pas :
- horaires ;
- réservations ;
- prestataires ;
- disponibilités ;
- programme détaillé.
Indique seulement les catégories d’activités que la destination semble particulièrement bien permettre.
N’invente pas l’existence d’un prestataire précis.
────────────────────────────
15. SAISON
────────────────────────────
Utilise les dates ou le mois du voyage.
Une destination excellente en été peut être médiocre à la période demandée.
Évalue donc la cohérence saisonnière.
Mais ne fabrique pas une météo précise.
Tu peux raisonner sur :
- saison généralement favorable ;
- activité généralement possible ;
- caractère saisonnier ;
- conditions généralement moins adaptées.
────────────────────────────
16. CONTRAINTES DURES
────────────────────────────
Respecte strictement les contraintes que le brief permet réellement de vérifier à l’étape Destination.
Exemples :
- pays explicitement exclu ;
- destination explicitement exclue ;
- avion explicitement refusé lorsque la géographie rend la destination manifestement incompatible ;
- incompatibilité géographique évidente ;
- autre deal-breaker directement vérifiable à partir des informations disponibles.
Mais ne transforme jamais une contrainte impossible à vérifier à cette étape en faux fait.
Exemple :
« piscine obligatoire »
ne signifie PAS :
« élimine toutes les destinations pour lesquelles tu ne peux pas prouver qu’une maison avec piscine est disponible ».
Cette vérification appartient à l’étape Hébergement.
────────────────────────────
17. INCERTITUDE
────────────────────────────
Règle fondamentale :
INCONNU ≠ FAUX.
Si une donnée ne peut pas être vérifiée à cette étape :
- signale l’incertitude ;
- ne fabrique pas la donnée ;
- ne transforme pas cette incertitude en exclusion sauf impossibilité manifeste.
KREW possède des étapes ultérieures pour effectuer les vérifications nécessaires.
────────────────────────────
18. AUCUNE FAUSSE PRÉCISION
────────────────────────────
Ne fabrique jamais une précision numérique uniquement pour remplir le JSON.
En particulier, ne présente jamais comme vérifié :
- prix ;
- disponibilité ;
- durée exacte ;
- distance exacte si elle n’est qu’approximative ;
- note d’hébergement ;
- nombre de chambres ;
- tarif transport ;
- coût d’activité.
Lorsque le schéma demande une estimation, elle doit rester explicitement une estimation.
────────────────────────────
19. CE QUE KREW FERA APRÈS TOI
────────────────────────────
Après ta réponse, KREW :
1. normalisera les candidats ;
2. les fusionnera avec d’autres candidats issus de ses propres sources ;
3. appliquera ses contraintes déterministes ;
4. calculera la compatibilité individuelle ;
5. calculera la compatibilité collective ;
6. appliquera les règles liées à la Star ;
7. appliquera les données fiables dont il dispose ;
8. diversifiera les résultats ;
9. sélectionnera les destinations à afficher ;
10. pourra conserver les autres candidats pour de futures propositions.
Ne tente pas de reproduire ces étapes.
────────────────────────────
20. QUALITÉ ATTENDUE
────────────────────────────
Chaque destination doit être :
- réelle ;
- géographiquement identifiable ;
- pertinente pour le groupe ;
- cohérente avec au moins une combinaison importante de ses attentes ;
- suffisamment distincte pour enrichir le pool ;
- exploitable par KREW après normalisation.
Deux groupes ayant des profils réellement différents doivent obtenir des pools sensiblement différents.
Évite les justifications génériques qui pourraient convenir à n’importe quelle destination.
Le champ \`why\` doit expliquer en quelques mots POURQUOI cette destination mérite d’être évaluée pour CE groupe.
────────────────────────────
21. FORMAT DE SORTIE
────────────────────────────
Retourne uniquement du JSON valide.
Aucun markdown.
Aucun commentaire avant ou après le JSON.
Aucune propriété non prévue par le schéma.
Structure :
{
  "candidates": [
    {
      "name": "string",
      "country": "string",
      "region": "string | null",
      "destinationType": "city | region_territory | outdoor_area",
      "anchorPlaces": ["string"],
      "why": "string",
      "budgetFit": "likely_compatible | uncertain | likely_expensive",
      "budgetReason": "string",
      "transport": {
        "ORIGIN_NAME": {
          "plausibleModes": ["train", "car"],
          "plausibility": "likely | uncertain | unlikely"
        }
      },
      "activityFit": ["string"],
      "environmentFit": ["string"],
      "accommodationFit": ["string"],
      "seasonFit": "good | mixed | poor"
    }
  ]
}
────────────────────────────
22. DERNIÈRE RÈGLE
────────────────────────────
Ton objectif n’est pas de donner l’impression de connaître des informations que tu ne possèdes pas.
Ton objectif est d’explorer intelligemment.
Préfère :
« candidat pertinent mais coût réel à vérifier »
à :
« 327 € par personne »
si aucun prix réel n’a été vérifié.
Préfère :
« train probablement pertinent »
à :
« 3 h 42 »
si aucun horaire réel n’a été consulté.
Préfère :
« territoire adapté aux grandes maisons de groupe »
à :
« villas avec piscine disponibles »
si aucun hébergement réel n’a été recherché.
Explore largement.
Reste fidèle au profil réel du groupe.
Signale l’incertitude.
N’invente pas les vérifications que KREW effectuera plus tard.`;

type GeminiConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: "gemini";
};

type InteractionResponse = {
  steps?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

function getGeminiConfig(): GeminiConfig | null {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) {
    console.info("[Gemini env diagnostic]", {
      processEnvPresent: false,
      geminiEnvNames: Object.keys(process.env).filter((key) => key.startsWith("GEMINI")),
      vercelEnv: process.env["VERCEL_ENV"] ?? null,
      vercelGitCommitRef: process.env["VERCEL_GIT_COMMIT_REF"] ?? null,
    });
    return null;
  }
  console.info("[Gemini env diagnostic]", {
    processEnvPresent: true,
    geminiEnvNames: Object.keys(process.env).filter((key) => key.startsWith("GEMINI")),
    vercelEnv: process.env["VERCEL_ENV"] ?? null,
    vercelGitCommitRef: process.env["VERCEL_GIT_COMMIT_REF"] ?? null,
  });
  return {
    apiKey,
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/interactions",
    model: process.env["GEMINI_MODEL"] || "gemini-3.6-flash",
    provider: "gemini",
  };
}

export function fingerprint(input: AiDiscoveryInput): string {
  const selectedProfiles = (
    input.selectedStayProfiles ||
    (input.selectedConcepts ?? []).flatMap((c) => c.profiles ?? [(c.id as StayProfileId)])
  ).filter(Boolean);

  const origins = [...(input.departureOrigins ?? [{ origin: input.departureCity, participants: input.participants }])]
    .map((o) => ({ origin: o.origin.toLowerCase().trim(), participants: o.participants }))
    .sort((a, b) => a.origin.localeCompare(b.origin));

  const sortedTransport = [...(input.acceptedTransportModes ?? [])].map((m) => m.toLowerCase().trim()).sort();

  return JSON.stringify({
    e: input.eventType || "",
    sd: input.startDate || null,
    ed: input.endDate || null,
    n: input.nights,
    m: input.startMonth,
    p: input.participants,
    b: Math.round(Number(input.budgetPerPerson) / 5) * 5,
    o: origins,
    t: sortedTransport,
    d: input.maxDistanceKm,
    x: [...(input.excludedCountries || [])].map((c) => c.toLowerCase().trim()).sort(),
    plane: Boolean(input.planeRefused),
    h: input.maxTravelHours ?? null,
    amb: [...(input.ambiances || [])].sort(),
    act: [...(input.activityCategories || [])].sort(),
    env: [...(input.wantedEnvTypes || [])].sort(),
    starEnv: input.starWantedEnvType ?? null,
    sw: [...(input.starWanted || [])].sort(),
    sdb: [...(input.starDealBreakers || [])].sort(),
    age: input.groupAgeRange ?? null,
    profiles: [...new Set(selectedProfiles)].sort(),
    branches: [...(input.discoveryBranches ?? ["urban"])].sort(),
    mobility: input.localMobility ?? null,
    accommodation: input.accommodationRole ?? null,
    desired: input.scoringSignals?.desiredDestination?.toLowerCase().trim() ?? null,
    letDecide: input.scoringSignals?.letKrewDecide ?? true,
    hard: input.scoringSignals?.hardConstraints ?? null,
    soft: input.scoringSignals?.softPreferences ?? null,
    indiv: input.relevantIndividualPreferences ?? [],
  });
}

const cache = new Map<string, { at: number; candidates: AiCandidate[]; provider: string }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;
export const REQUEST_TIMEOUT_MS = 120_000;

export function clearDestinationAiCacheForTests() {
  cache.clear();
}

function compactUser(input: AiDiscoveryInput): string {
  const rawProfiles = (
    input.selectedStayProfiles ||
    (input.selectedConcepts ?? []).flatMap((c) => c.profiles ?? [(c.id as StayProfileId)])
  ).filter(Boolean);

  const selectedStayProfiles = [...new Set(rawProfiles)].map((id) => ({
    id,
    label: PROFILE_LABELS[id as StayProfileId] || id,
  }));

  const o: Record<string, unknown> = {
    event: input.eventType || "groupe",
    participants: input.participants,
    nights: input.nights,
    dates: input.startDate && input.endDate ? { startDate: input.startDate, endDate: input.endDate } : null,
    budgetPerPerson: input.budgetPerPerson,
    departureCity: input.departureCity || null,
    departureOrigins: input.departureOrigins ?? [
      { origin: input.departureCity, participants: input.participants },
    ],
    acceptedTransportModes: input.acceptedTransportModes ?? [],
    maxDistanceKm: input.maxDistanceKm,
    startMonth: input.startMonth,
    ambiances: input.ambiances,
    activityCategories: input.activityCategories,
    excludedCountries: input.excludedCountries,
    planeRefused: Boolean(input.planeRefused),
    maxTravelHours: input.maxTravelHours ?? null,
    starWanted: input.starWanted || [],
    starDealBreakers: input.starDealBreakers || [],
    wantedEnvTypes: input.wantedEnvTypes || [],
    starWantedEnvType: input.starWantedEnvType ?? null,
    groupAgeRange: input.groupAgeRange ?? null,
    freeNotes: input.freeNotes || [],
    stayProfiles: input.stayProfiles || [],
    selectedStayProfiles,
    discoveryBranches: input.discoveryBranches || ["urban"],
    localMobility: input.localMobility ?? null,
    accommodationRole: input.accommodationRole ?? null,
    individualPreferences: input.relevantIndividualPreferences || [],
  };

  if (input.scoringSignals) {
    o["scoringProfile"] = {
      desiredDestination: input.scoringSignals.desiredDestination ?? null,
      letKrewDecide: input.scoringSignals.letKrewDecide ?? true,
      starWeight: input.scoringSignals.starWeight ?? null,
      hardConstraints: input.scoringSignals.hardConstraints ?? null,
      softPreferences: input.scoringSignals.softPreferences ?? null,
      individualPreferences: input.scoringSignals.individualPreferences ?? [],
    };
  }

  return JSON.stringify(o);
}

function extractInteractionText(json: InteractionResponse): string {
  const modelOutputs = (json.steps ?? []).filter((step) => step.type === "model_output");
  const lastOutput = modelOutputs.at(-1);
  if (!lastOutput?.content?.length) return "";
  return lastOutput.content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text ?? "")
    .join("");
}

export function parseDiscoveryCandidates(raw: string): AiCandidate[] {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return [];

  try {
    const data = JSON.parse(raw.slice(start, end + 1)) as {
      candidates?: Array<{
        name?: string;
        title?: string;
        country?: string;
        region?: string | null;
        destinationType?: string;
        anchorPlaces?: string[];
        why?: string;
        reason?: string;
        budgetFit?: BudgetFit;
        budgetReason?: string;
        transport?: Record<
          string,
          {
            plausibleModes?: string[];
            plausibility?: TransportPlausibility;
          }
        >;
        activityFit?: string[];
        environmentFit?: string[];
        accommodationFit?: string[];
        seasonFit?: SeasonFit;
      }>;
    };

    if (!Array.isArray(data.candidates)) return [];

    return data.candidates
      .map((c: any, i: number) => {
        const rawType = String(c.destinationType ?? c.destination_type ?? "city");
        const destinationType: DestinationType = [
          "city",
          "town_village",
          "region_territory",
          "outdoor_area",
        ].includes(rawType)
          ? (rawType as DestinationType)
          : "city";

        const name = String(c.name || c.title || "").trim();
        const whyStr = String(c.why || c.reason || "suggéré par Krew IA").slice(0, 120);

        const out: AiCandidate = {
          name,
          affinity: Math.max(10, 100 - i * 1.5),
          why: whyStr,
          reason: whyStr,
          destinationType,
          anchorPlaces:
            destinationType === "city"
              ? [name]
              : (c.anchorPlaces ?? c.anchor_places ?? [])
                  .map(String)
                  .map((v) => v.trim())
                  .filter(Boolean)
                  .slice(0, 5),
        };

        if (c.country) out.country = String(c.country).trim();
        if (c.region !== undefined) out.region = c.region ? String(c.region).trim() : null;

        if (["likely_compatible", "uncertain", "likely_expensive"].includes(String(c.budgetFit))) {
          out.budgetFit = c.budgetFit as BudgetFit;
        }
        if (c.budgetReason) out.budgetReason = String(c.budgetReason).trim();

        if (c.transport && typeof c.transport === "object") {
          const transportMap: Record<
            string,
            { plausibleModes: string[]; plausibility: TransportPlausibility }
          > = {};
          for (const [origin, info] of Object.entries(c.transport)) {
            if (info && typeof info === "object") {
              const plausibleModes = Array.isArray((info as any).plausibleModes)
                ? (info as any).plausibleModes.map(String)
                : [];
              const plausibilityRaw = (info as any).plausibility ? String((info as any).plausibility) : "";
              const plausibility: TransportPlausibility = [
                "likely",
                "uncertain",
                "unlikely",
              ].includes(plausibilityRaw)
                ? (plausibilityRaw as TransportPlausibility)
                : "uncertain";

              transportMap[origin] = { plausibleModes, plausibility };
            }
          }
          if (Object.keys(transportMap).length > 0) {
            out.transport = transportMap;
          }
        }

        if (Array.isArray(c.activityFit)) {
          out.activityFit = c.activityFit
            .map((item) => (typeof item === "string" ? item : String((item as any)?.category || "")))
            .filter(Boolean);
        }

        if (Array.isArray(c.environmentFit)) {
          out.environmentFit = c.environmentFit.map(String).filter(Boolean);
        }

        if (Array.isArray(c.accommodationFit)) {
          out.accommodationFit = c.accommodationFit.map(String).filter(Boolean);
        }

        const seasonRaw = String(c.seasonFit ?? "");
        if (seasonRaw === "good" || seasonRaw === "mixed" || seasonRaw === "poor") {
          out.seasonFit = seasonRaw as SeasonFit;
        }

        return out;
      })
      .filter((c) => c.name.length >= 2)
      .slice(0, 50);
  } catch {
    return [];
  }
}

export async function discoverDestinationsWithAi(input: AiDiscoveryInput): Promise<{
  candidates: AiCandidate[];
  usedLlm: boolean;
  provider?: string;
  error?: string;
  cached?: boolean;
}> {
  const cfg = getGeminiConfig();
  if (!cfg) return { candidates: [], usedLlm: false, error: "no_gemini_key" };

  const fp = fingerprint(input);
  const hit = cache.get(fp);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return {
      candidates: hit.candidates,
      usedLlm: true,
      provider: hit.provider,
      cached: true,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(cfg.baseUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "x-goog-api-key": cfg.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: cfg.model,
        system_instruction: SYSTEM,
        input: compactUser(input),
      }),
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      const error = `gemini_http_${res.status}:${errText.slice(0, 240)}`;
      reportServerError(new Error(error), {
        provider: cfg.provider,
        kind: "destination-ai",
        departureCity: input.departureCity,
      });
      return { candidates: [], usedLlm: false, provider: cfg.provider, error };
    }

    const json = (await res.json()) as InteractionResponse;
    const raw = extractInteractionText(json);
    const candidates = parseDiscoveryCandidates(raw);
    if (!candidates.length) {
      const error = raw ? "gemini_empty_parse" : "gemini_empty_output";
      reportServerError(new Error(error), {
        provider: cfg.provider,
        kind: "destination-ai",
        departureCity: input.departureCity,
      });
      return { candidates: [], usedLlm: false, provider: cfg.provider, error };
    }

    cache.set(fp, { at: Date.now(), candidates, provider: cfg.provider });
    return { candidates, usedLlm: true, provider: cfg.provider };
  } catch (error) {
    clearTimeout(timeout);
    reportServerError(error, {
      provider: cfg.provider,
      kind: "destination-ai",
      departureCity: input.departureCity,
    });
    return {
      candidates: [],
      usedLlm: false,
      provider: cfg.provider,
      error: String(error).slice(0, 160) || "gemini_failed",
    };
  }
}
