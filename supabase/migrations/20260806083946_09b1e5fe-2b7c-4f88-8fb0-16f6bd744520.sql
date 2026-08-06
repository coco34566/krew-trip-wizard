
-- ENUMS
CREATE TYPE public.event_type AS ENUM ('evg','evjf','anniversaire','weekend','voyage_groupe');
CREATE TYPE public.trip_status AS ENUM ('brouillon','en_preparation','propositions','valide','termine');
CREATE TYPE public.participant_status AS ENUM ('invite','accepte','refuse');

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- CATALOG: DESTINATIONS
CREATE TABLE public.destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  country text NOT NULL,
  description text,
  image_url text,
  avg_daily_cost numeric NOT NULL DEFAULT 100,
  distance_from_paris_km integer NOT NULL DEFAULT 1000,
  popularity numeric NOT NULL DEFAULT 0.5,
  rating numeric NOT NULL DEFAULT 4.5,
  best_months integer[] NOT NULL DEFAULT '{}',
  score_fete numeric NOT NULL DEFAULT 0,
  score_aventure numeric NOT NULL DEFAULT 0,
  score_detente numeric NOT NULL DEFAULT 0,
  score_luxe numeric NOT NULL DEFAULT 0,
  score_insolite numeric NOT NULL DEFAULT 0,
  score_sportif numeric NOT NULL DEFAULT 0,
  score_culturel numeric NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'krew_seed',
  external_id text,
  synced_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.destinations TO anon, authenticated;
GRANT ALL ON public.destinations TO service_role;
ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "destinations public read" ON public.destinations FOR SELECT USING (true);

-- CATALOG: ACTIVITIES
CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_id uuid NOT NULL REFERENCES public.destinations(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL,
  description text,
  price_per_person numeric NOT NULL DEFAULT 0,
  duration_hours numeric NOT NULL DEFAULT 2,
  rating numeric NOT NULL DEFAULT 4.5,
  image_url text,
  source text NOT NULL DEFAULT 'krew_seed',
  external_id text
);
GRANT SELECT ON public.activities TO anon, authenticated;
GRANT ALL ON public.activities TO service_role;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activities public read" ON public.activities FOR SELECT USING (true);

-- CATALOG: ACCOMMODATIONS
CREATE TABLE public.accommodations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_id uuid NOT NULL REFERENCES public.destinations(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'appartement',
  description text,
  price_per_night_per_person numeric NOT NULL DEFAULT 40,
  capacity integer NOT NULL DEFAULT 10,
  rating numeric NOT NULL DEFAULT 4.5,
  distance_center_km numeric NOT NULL DEFAULT 1,
  image_url text,
  source text NOT NULL DEFAULT 'krew_seed',
  external_id text
);
GRANT SELECT ON public.accommodations TO anon, authenticated;
GRANT ALL ON public.accommodations TO service_role;
ALTER TABLE public.accommodations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "accommodations public read" ON public.accommodations FOR SELECT USING (true);

-- TRIPS
CREATE TABLE public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  event_type public.event_type NOT NULL DEFAULT 'evg',
  celebrated_person text,
  start_date date,
  end_date date,
  participants_count integer NOT NULL DEFAULT 8,
  budget_per_person numeric NOT NULL DEFAULT 350,
  departure_city text NOT NULL DEFAULT 'Paris',
  status public.trip_status NOT NULL DEFAULT 'brouillon',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO authenticated;
GRANT ALL ON public.trips TO service_role;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.trip_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL,
  display_name text,
  role text NOT NULL DEFAULT 'membre',
  status public.participant_status NOT NULL DEFAULT 'invite',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, email)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_participants TO authenticated;
GRANT ALL ON public.trip_participants TO service_role;
ALTER TABLE public.trip_participants ENABLE ROW LEVEL SECURITY;

-- membership helper (security definer avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.is_trip_member(_trip_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.trips t WHERE t.id = _trip_id AND t.owner_id = _user_id)
      OR EXISTS (
        SELECT 1 FROM public.trip_participants p
        WHERE p.trip_id = _trip_id
          AND (p.user_id = _user_id
               OR lower(p.email) = lower((SELECT u.email FROM auth.users u WHERE u.id = _user_id)))
      );
$$;
GRANT EXECUTE ON FUNCTION public.is_trip_member(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_trip_owner(_trip_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.trips t WHERE t.id = _trip_id AND t.owner_id = _user_id);
$$;
GRANT EXECUTE ON FUNCTION public.is_trip_owner(uuid, uuid) TO authenticated;

CREATE POLICY "trips select members" ON public.trips FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_trip_member(id, auth.uid()));
CREATE POLICY "trips insert own" ON public.trips FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "trips update own" ON public.trips FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "trips delete own" ON public.trips FOR DELETE TO authenticated USING (owner_id = auth.uid());
CREATE TRIGGER trips_updated_at BEFORE UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "participants select members" ON public.trip_participants FOR SELECT TO authenticated
  USING (public.is_trip_member(trip_id, auth.uid()));
CREATE POLICY "participants insert owner" ON public.trip_participants FOR INSERT TO authenticated
  WITH CHECK (public.is_trip_owner(trip_id, auth.uid()));
CREATE POLICY "participants update members" ON public.trip_participants FOR UPDATE TO authenticated
  USING (public.is_trip_owner(trip_id, auth.uid()) OR user_id = auth.uid()
         OR lower(email) = lower((SELECT u.email FROM auth.users u WHERE u.id = auth.uid())))
  WITH CHECK (true);
CREATE POLICY "participants delete owner" ON public.trip_participants FOR DELETE TO authenticated
  USING (public.is_trip_owner(trip_id, auth.uid()));

-- TRIP PREFERENCES
CREATE TABLE public.trip_preferences (
  trip_id uuid PRIMARY KEY REFERENCES public.trips(id) ON DELETE CASCADE,
  average_age integer,
  relation text,
  ambiances text[] NOT NULL DEFAULT '{}',
  activity_categories text[] NOT NULL DEFAULT '{}',
  desired_destination text,
  let_krew_decide boolean NOT NULL DEFAULT true,
  max_distance_km integer NOT NULL DEFAULT 2000,
  excluded_countries text[] NOT NULL DEFAULT '{}',
  duration_nights integer NOT NULL DEFAULT 2,
  max_budget numeric,
  needs_city_center boolean NOT NULL DEFAULT true,
  mobility_notes text,
  dietary_constraints text[] NOT NULL DEFAULT '{}',
  availability_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_preferences TO authenticated;
GRANT ALL ON public.trip_preferences TO service_role;
ALTER TABLE public.trip_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prefs select members" ON public.trip_preferences FOR SELECT TO authenticated USING (public.is_trip_member(trip_id, auth.uid()));
CREATE POLICY "prefs write owner" ON public.trip_preferences FOR ALL TO authenticated
  USING (public.is_trip_owner(trip_id, auth.uid())) WITH CHECK (public.is_trip_owner(trip_id, auth.uid()));
CREATE TRIGGER prefs_updated_at BEFORE UPDATE ON public.trip_preferences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RECOMMENDATIONS
CREATE TABLE public.recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  destination_id uuid REFERENCES public.destinations(id) ON DELETE SET NULL,
  accommodation_id uuid REFERENCES public.accommodations(id) ON DELETE SET NULL,
  score numeric NOT NULL DEFAULT 0,
  rationale text,
  match_reasons text[] NOT NULL DEFAULT '{}',
  itinerary jsonb NOT NULL DEFAULT '[]'::jsonb,
  budget jsonb NOT NULL DEFAULT '{}'::jsonb,
  activity_ids uuid[] NOT NULL DEFAULT '{}',
  is_selected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recommendations TO authenticated;
GRANT ALL ON public.recommendations TO service_role;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reco select members" ON public.recommendations FOR SELECT TO authenticated USING (public.is_trip_member(trip_id, auth.uid()));
CREATE POLICY "reco write owner" ON public.recommendations FOR ALL TO authenticated
  USING (public.is_trip_owner(trip_id, auth.uid())) WITH CHECK (public.is_trip_owner(trip_id, auth.uid()));

CREATE TABLE public.recommendation_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid NOT NULL REFERENCES public.recommendations(id) ON DELETE CASCADE,
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  value integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recommendation_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recommendation_votes TO authenticated;
GRANT ALL ON public.recommendation_votes TO service_role;
ALTER TABLE public.recommendation_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "votes select members" ON public.recommendation_votes FOR SELECT TO authenticated USING (public.is_trip_member(trip_id, auth.uid()));
CREATE POLICY "votes insert member" ON public.recommendation_votes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_trip_member(trip_id, auth.uid()));
CREATE POLICY "votes update own" ON public.recommendation_votes FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "votes delete own" ON public.recommendation_votes FOR DELETE TO authenticated USING (user_id = auth.uid());

-- SEED DESTINATIONS
INSERT INTO public.destinations (slug,name,country,description,image_url,avg_daily_cost,distance_from_paris_km,popularity,rating,best_months,score_fete,score_aventure,score_detente,score_luxe,score_insolite,score_sportif,score_culturel) VALUES
('barcelone','Barcelone','Espagne','Plage, tapas et clubs mythiques : le combo imbattable pour un week-end de groupe.','https://images.unsplash.com/photo-1583422409516-2895a77efded?w=1200&q=80',95,1030,0.95,4.7,'{4,5,6,7,8,9,10}',0.95,0.6,0.7,0.6,0.5,0.7,0.8),
('lisbonne','Lisbonne','Portugal','Rooftops, surf à 30 minutes et nuits interminables au Bairro Alto.','https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=1200&q=80',85,1450,0.9,4.7,'{3,4,5,6,7,8,9,10}',0.9,0.7,0.75,0.55,0.6,0.75,0.8),
('budapest','Budapest','Hongrie','Ruin bars, bains thermaux et croisières sur le Danube pour un budget mini.','https://images.unsplash.com/photo-1541849546-216549ae216d?w=1200&q=80',65,1250,0.85,4.6,'{4,5,6,7,8,9}',0.95,0.5,0.8,0.4,0.8,0.4,0.8),
('amsterdam','Amsterdam','Pays-Bas','Canaux, bars à bières et ambiance festive à seulement 3h en train.','https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=1200&q=80',110,500,0.88,4.5,'{4,5,6,7,8,9}',0.9,0.45,0.6,0.6,0.7,0.5,0.85),
('marrakech','Marrakech','Maroc','Riads privatisés, quad dans le désert et soirées rooftop.','https://images.unsplash.com/photo-1597212618440-806262de4f6b?w=1200&q=80',70,2350,0.8,4.6,'{2,3,4,5,9,10,11}',0.7,0.9,0.85,0.8,0.9,0.6,0.85),
('biarritz','Biarritz','France','Surf, pelote basque et apéros face à l''océan.','https://images.unsplash.com/photo-1502136969935-8d8eef54d77b?w=1200&q=80',105,770,0.72,4.6,'{5,6,7,8,9}',0.7,0.85,0.8,0.6,0.5,0.95,0.5),
('annecy','Annecy','France','Lac turquoise, parapente et via ferrata au pied des Alpes.','https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=1200&q=80',95,540,0.7,4.8,'{5,6,7,8,9}',0.4,0.95,0.85,0.6,0.6,0.95,0.5),
('prague','Prague','République tchèque','Bière la moins chère d''Europe et vieille ville de carte postale.','https://images.unsplash.com/photo-1519677100203-a0e668c92439?w=1200&q=80',60,1030,0.8,4.6,'{4,5,6,7,8,9,10}',0.9,0.5,0.6,0.4,0.7,0.4,0.9),
('valence','Valence','Espagne','Paella, plage urbaine et sports nautiques toute l''année.','https://images.unsplash.com/photo-1599484240524-b6b8e7f5e0d4?w=1200&q=80',80,1180,0.7,4.6,'{4,5,6,7,8,9,10}',0.8,0.7,0.8,0.5,0.5,0.85,0.7),
('ibiza','Ibiza','Espagne','Clubs légendaires, beach clubs et villas avec piscine.','https://images.unsplash.com/photo-1512632578888-169bbbc64f33?w=1200&q=80',150,1350,0.9,4.5,'{5,6,7,8,9}',1.0,0.5,0.8,0.95,0.6,0.5,0.3),
('krakow','Cracovie','Pologne','Le meilleur rapport fête/budget d''Europe, avec un centre historique superbe.','https://images.unsplash.com/photo-1606992894456-799462dc4d94?w=1200&q=80',50,1360,0.72,4.6,'{4,5,6,7,8,9}',0.9,0.5,0.6,0.3,0.7,0.5,0.9),
('chamonix','Chamonix','France','Montagne, sensations fortes et chalet privatisé pour le groupe.','https://images.unsplash.com/photo-1551524559-8af4e6624178?w=1200&q=80',120,610,0.68,4.7,'{1,2,3,6,7,8,12}',0.5,1.0,0.7,0.7,0.6,1.0,0.4);

-- SEED ACCOMMODATIONS
INSERT INTO public.accommodations (destination_id,name,type,description,price_per_night_per_person,capacity,rating,distance_center_km,image_url)
SELECT d.id, a.name, a.type, a.description, a.price, a.capacity, a.rating, a.dist, a.img
FROM public.destinations d
JOIN (VALUES
 ('barcelone','Loft Gothic Quarter','appartement','Loft de 200m² à 5 min de Las Ramblas',45,14,4.7,0.4,'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80'),
 ('barcelone','Villa Sitges avec piscine','villa','Villa privée avec piscine à 30 min de Barcelone',70,16,4.8,25.0,'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80'),
 ('lisbonne','Casa Alfama Rooftop','appartement','Terrasse panoramique sur le Tage',40,12,4.8,0.6,'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=80'),
 ('budapest','Danube Party Apartment','appartement','Grand appartement au coeur du quartier des ruin bars',25,16,4.5,0.3,'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80'),
 ('amsterdam','Canal House Jordaan','maison','Maison sur les canaux, quartier Jordaan',65,12,4.6,0.8,'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=1200&q=80'),
 ('marrakech','Riad Privatisé Medina','riad','Riad entier avec piscine, chef et hammam',38,18,4.9,0.5,'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?w=1200&q=80'),
 ('biarritz','Surf House Côte des Basques','maison','Maison surf à 100m du spot',55,12,4.6,1.2,'https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?w=1200&q=80'),
 ('annecy','Chalet du Lac','chalet','Chalet avec sauna vue lac',60,14,4.8,2.5,'https://images.unsplash.com/photo-1518602164578-cd0074062767?w=1200&q=80'),
 ('prague','Old Town Group Loft','appartement','Loft 3 étages au centre historique',22,16,4.5,0.4,'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1200&q=80'),
 ('valence','Beach Penthouse Malvarrosa','appartement','Penthouse face à la plage',35,12,4.6,3.0,'https://images.unsplash.com/photo-1502672023488-70e25813eb80?w=1200&q=80'),
 ('ibiza','Villa Sunset San Antonio','villa','Villa avec piscine à débordement et DJ booth',110,14,4.8,4.0,'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200&q=80'),
 ('krakow','Kazimierz Party Flat','appartement','Appartement géant dans le quartier festif',18,16,4.4,0.5,'https://images.unsplash.com/photo-1560185007-cde436f6a4d0?w=1200&q=80'),
 ('chamonix','Chalet Mont-Blanc','chalet','Chalet traditionnel avec jacuzzi vue Mont-Blanc',70,14,4.8,1.5,'https://images.unsplash.com/photo-1502786129293-79981df4e689?w=1200&q=80')
) AS a(slug,name,type,description,price,capacity,rating,dist,img) ON a.slug = d.slug;

-- SEED ACTIVITIES
INSERT INTO public.activities (destination_id,name,category,description,price_per_person,duration_hours,rating,image_url)
SELECT d.id, a.name, a.category, a.description, a.price, a.hours, a.rating, a.img
FROM public.destinations d
JOIN (VALUES
 ('barcelone','Boat party privatisée','soirees','Bateau privatisé 3h avec DJ et open bar',65,3,4.8,'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200&q=80'),
 ('barcelone','Tour des tapas du Born','gastronomie','5 bars, 10 tapas, 1 guide local',45,3,4.7,'https://images.unsplash.com/photo-1515443961218-a51367888e4b?w=1200&q=80'),
 ('barcelone','Entrée VIP Opium Beach Club','bars_clubs','Skip-the-line + table réservée',40,5,4.4,'https://images.unsplash.com/photo-1470229722913-7ea0d0d1c0c9?w=1200&q=80'),
 ('barcelone','Beach volley & paddle surf','nautique','Session encadrée à la Barceloneta',30,2,4.6,'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=1200&q=80'),
 ('lisbonne','Tuk-tuk tour des belvédères','experiences','Tour privé des miradouros',35,2,4.8,'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=1200&q=80'),
 ('lisbonne','Cours de surf à Costa da Caparica','nautique','2h de cours + matériel',45,3,4.7,'https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=1200&q=80'),
 ('lisbonne','Crawl des bars du Bairro Alto','bars_clubs','5 bars + shots offerts',25,4,4.5,'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=1200&q=80'),
 ('budapest','Croisière party sur le Danube','soirees','Bateau 2h avec open bar',30,2,4.6,'https://images.unsplash.com/photo-1565426873118-a17ed65d74b9?w=1200&q=80'),
 ('budapest','Bains Széchenyi + massage','detente','Accès journée aux thermes',25,3,4.7,'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=1200&q=80'),
 ('budapest','Ruin bar crawl','bars_clubs','Tournée guidée des ruin bars',20,4,4.6,'https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=1200&q=80'),
 ('amsterdam','Bateau privatisé sur les canaux','soirees','2h de croisière privée avec boissons',45,2,4.7,'https://images.unsplash.com/photo-1512470876302-972faa2aa9a4?w=1200&q=80'),
 ('amsterdam','Brasserie & dégustation de bières','gastronomie','Visite + 5 bières',30,2,4.5,'https://images.unsplash.com/photo-1436076863939-06870fe779c2?w=1200&q=80'),
 ('marrakech','Quad dans la palmeraie','sensations','2h de quad + thé à la menthe',45,3,4.7,'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=1200&q=80'),
 ('marrakech','Nuit sous tente dans le désert d''Agafay','insolite','Dîner, feu de camp et bivouac',80,14,4.9,'https://images.unsplash.com/photo-1548013146-72479768bada?w=1200&q=80'),
 ('marrakech','Hammam & massage traditionnel','detente','Rituel complet 90 min',35,2,4.8,'https://images.unsplash.com/photo-1610641818989-c2051b5e2cfd?w=1200&q=80'),
 ('biarritz','Cours de surf collectif','sport','2h avec moniteur diplômé',40,2,4.8,'https://images.unsplash.com/photo-1502933691298-84fc14542831?w=1200&q=80'),
 ('biarritz','Saut à l''élastique pont de la Nive','sensations','Saut encadré 30m',75,2,4.7,'https://images.unsplash.com/photo-1533130061792-64b345e4a833?w=1200&q=80'),
 ('annecy','Parapente biplace au Semnoz','sensations','Vol de 20 min au-dessus du lac',95,2,4.9,'https://images.unsplash.com/photo-1503220317375-aaad61436b1b?w=1200&q=80'),
 ('annecy','Canyoning Angon','sport','Descente encadrée 3h',60,3,4.8,'https://images.unsplash.com/photo-1533692328991-08159ff19fca?w=1200&q=80'),
 ('annecy','Bateau électrique sur le lac','nautique','Location 2h sans permis',25,2,4.7,'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1200&q=80'),
 ('prague','Beer bike dans la vieille ville','insolite','1h30 de vélo-bar',35,2,4.4,'https://images.unsplash.com/photo-1571613316887-6f8d5cbf7ef7?w=1200&q=80'),
 ('prague','Stand de tir & laser game','sensations','Session groupe 2h',55,2,4.5,'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=1200&q=80'),
 ('valence','Catamaran & baignade','nautique','Sortie 3h avec paella à bord',60,3,4.7,'https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?w=1200&q=80'),
 ('valence','Atelier paella','gastronomie','Cours de cuisine + repas',40,3,4.8,'https://images.unsplash.com/photo-1534080564583-6be75777b70a?w=1200&q=80'),
 ('ibiza','Table VIP Ushuaïa','bars_clubs','Entrée + table bouteille',150,6,4.6,'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&q=80'),
 ('ibiza','Yacht day à Formentera','nautique','Journée bateau avec skipper',180,8,4.9,'https://images.unsplash.com/photo-1544551763-92ab472cad5d?w=1200&q=80'),
 ('krakow','Tour vodka & pierogi','gastronomie','Dégustation guidée',20,3,4.6,'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=1200&q=80'),
 ('krakow','Paintball en forêt','sport','Session 2h tout inclus',25,2,4.5,'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1200&q=80'),
 ('chamonix','Aiguille du Midi & vallée Blanche','experiences','Téléphérique 3842m',70,4,4.9,'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&q=80'),
 ('chamonix','Rafting Arve','sensations','Descente encadrée 2h',55,3,4.7,'https://images.unsplash.com/photo-1530866495561-507c9faab2ed?w=1200&q=80')
) AS a(slug,name,category,description,price,hours,rating,img) ON a.slug = d.slug;
