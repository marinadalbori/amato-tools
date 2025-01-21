-- Creazione della tabella series
CREATE TABLE series (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Creazione della tabella series_frame_types
CREATE TABLE series_frame_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID REFERENCES series(id) ON DELETE CASCADE,
    tipologia VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(series_id, tipologia)
);

-- Creazione della tabella series_profiles
CREATE TABLE series_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID REFERENCES series(id) ON DELETE CASCADE,
    nome_profilo VARCHAR(100) NOT NULL,
    prezzo_metro DECIMAL(10, 2) NOT NULL,
    lunghezza_barra DECIMAL(10, 2) NOT NULL,
    percentuale_sfrido DECIMAL(5, 2) NOT NULL DEFAULT 5.0,
    minimo_riutilizzabile DECIMAL(10, 2) NOT NULL DEFAULT 0.5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(series_id, nome_profilo)
);

-- Trigger per aggiornare updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_series_updated_at
    BEFORE UPDATE ON series
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_series_profiles_updated_at
    BEFORE UPDATE ON series_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 