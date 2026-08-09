-- Supprime tous les hôtels fictifs issus du seed d'origine (ceux qui ont source = 'krew_seed')
DELETE FROM public.accommodations WHERE source = 'krew_seed';
