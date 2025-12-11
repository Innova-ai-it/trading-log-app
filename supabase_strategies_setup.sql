-- Tabella per le strategie utente
CREATE TABLE IF NOT EXISTS public.user_strategies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL, -- Contenuto Markdown completo (per lettura umana)
  structured_data JSONB, -- Dati strutturati JSON (per parsing AI)
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_user_strategies_user_id ON public.user_strategies(user_id);
CREATE INDEX IF NOT EXISTS idx_user_strategies_is_active ON public.user_strategies(is_active);
CREATE INDEX IF NOT EXISTS idx_user_strategies_created_at ON public.user_strategies(created_at DESC);

-- RLS (Row Level Security)
ALTER TABLE public.user_strategies ENABLE ROW LEVEL SECURITY;

-- Policy: Gli utenti possono vedere solo le proprie strategie
CREATE POLICY "Users can view their own strategies"
  ON public.user_strategies
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Gli utenti possono inserire solo le proprie strategie
CREATE POLICY "Users can insert their own strategies"
  ON public.user_strategies
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Gli utenti possono aggiornare solo le proprie strategie
CREATE POLICY "Users can update their own strategies"
  ON public.user_strategies
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Gli utenti possono eliminare solo le proprie strategie
CREATE POLICY "Users can delete their own strategies"
  ON public.user_strategies
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger per aggiornare updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_strategies_updated_at
  BEFORE UPDATE ON public.user_strategies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

