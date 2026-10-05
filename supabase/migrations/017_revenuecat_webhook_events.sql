-- Idempotency log for RevenueCat webhooks (service role only).
CREATE TABLE IF NOT EXISTS public.revenuecat_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

ALTER TABLE public.revenuecat_webhook_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.revenuecat_webhook_events IS
  'Tracks RevenueCat webhook deliveries so BILLING_ISSUE emails are not sent twice for the same event.id.';
