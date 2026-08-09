-- Enable extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the cron job to run once a day at 2:00 AM (server time)
-- Calling the /api/recalibrate endpoint securely using pg_net
SELECT cron.schedule(
  'recalibrate-scoring-weights-job',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://' || COALESCE(current_setting('app.settings.site_url', true), 'localhost:3000') || '/api/recalibrate',
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  $$
);
