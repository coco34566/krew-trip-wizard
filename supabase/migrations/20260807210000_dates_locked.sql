-- Verrouillage explicite des dates choisies par l'organisateur
-- Les dispos mettent à jour provisional_* seulement ;
-- start_date / end_date ne bougent qu'après "Choisir cette date".

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS dates_locked boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.trips.dates_locked IS
  'True quand l''organisateur a explicitement choisi une fenêtre (start_date/end_date figés pour les APIs).';
