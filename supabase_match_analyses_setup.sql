-- Tabella per salvare le analisi delle partite
CREATE TABLE IF NOT EXISTS public.match_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id INTEGER NOT NULL, -- ID della partita dall'API
  match_date DATE NOT NULL, -- Data della partita per facilitare query
  analysis_data JSONB NOT NULL, -- Dati completi dell'analisi
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, match_id) -- Una sola analisi per utente per partita
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_match_analyses_user_id ON public.match_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_match_analyses_match_id ON public.match_analyses(match_id);
CREATE INDEX IF NOT EXISTS idx_match_analyses_match_date ON public.match_analyses(match_date DESC);

-- RLS (Row Level Security)
ALTER TABLE public.match_analyses ENABLE ROW LEVEL SECURITY;

-- Policy: Gli utenti possono vedere solo le proprie analisi
CREATE POLICY "Users can view their own match analyses"
  ON public.match_analyses
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Gli utenti possono inserire solo le proprie analisi
CREATE POLICY "Users can insert their own match analyses"
  ON public.match_analyses
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Gli utenti possono aggiornare solo le proprie analisi
CREATE POLICY "Users can update their own match analyses"
  ON public.match_analyses
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Gli utenti possono eliminare solo le proprie analisi
CREATE POLICY "Users can delete their own match analyses"
  ON public.match_analyses
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger per aggiornare updated_at automaticamente
CREATE OR REPLACE FUNCTION update_match_analyses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_match_analyses_updated_at
  BEFORE UPDATE ON public.match_analyses
  FOR EACH ROW
  EXECUTE FUNCTION update_match_analyses_updated_at();

