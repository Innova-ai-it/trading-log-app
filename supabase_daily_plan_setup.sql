-- Tabella per i piani di trading giornalieri
CREATE TABLE IF NOT EXISTS public.trading_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_date DATE NOT NULL,
  plan_content TEXT NOT NULL, -- Piano in formato testo
  plan_data JSONB, -- Dati strutturati (partite, strategie, confidence)
  matches_analyzed JSONB, -- Array delle partite analizzate
  context_snapshot JSONB, -- Snapshot contesto al momento generazione
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabella per feedback sui match del piano
CREATE TABLE IF NOT EXISTS public.plan_match_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.trading_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_identifier TEXT NOT NULL, -- Competizione + squadre
  recommendation_text TEXT, -- Il consiglio specifico
  was_executed BOOLEAN DEFAULT false, -- Se è stato effettuato
  was_profitable BOOLEAN, -- Se è stato profittevole (null se non eseguito)
  actual_result TEXT, -- Risultato reale
  feedback_notes TEXT, -- Note aggiuntive
  trade_id UUID REFERENCES public.trades(id), -- Trade associato se eseguito
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_trading_plans_user_id ON public.trading_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_plans_plan_date ON public.trading_plans(plan_date DESC);
CREATE INDEX IF NOT EXISTS idx_plan_match_feedback_plan_id ON public.plan_match_feedback(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_match_feedback_user_id ON public.plan_match_feedback(user_id);

-- RLS
ALTER TABLE public.trading_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_match_feedback ENABLE ROW LEVEL SECURITY;

-- Policy per trading_plans
CREATE POLICY "Users can view their own plans"
  ON public.trading_plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own plans"
  ON public.trading_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own plans"
  ON public.trading_plans FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own plans"
  ON public.trading_plans FOR DELETE
  USING (auth.uid() = user_id);

-- Policy per plan_match_feedback
CREATE POLICY "Users can view their own feedback"
  ON public.plan_match_feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feedback"
  ON public.plan_match_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feedback"
  ON public.plan_match_feedback FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own feedback"
  ON public.plan_match_feedback FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger per aggiornare updated_at automaticamente
CREATE OR REPLACE FUNCTION update_trading_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_trading_plans_updated_at
  BEFORE UPDATE ON public.trading_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_trading_plans_updated_at();

CREATE OR REPLACE FUNCTION update_plan_match_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_plan_match_feedback_updated_at
  BEFORE UPDATE ON public.plan_match_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_plan_match_feedback_updated_at();

