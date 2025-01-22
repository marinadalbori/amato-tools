in pag @gridPage.tsx

Input Manuali dall’Utente:
Serie:

Selezione di una serie (ID) dalla lista delle serie disponibili (series.id).
Tipologia di Serramento:

Selezione di una tipologia (es. Battente 1 Anta) (frame_types.id).
Dimensioni della Griglia:

Altezza minima (es. 1000 mm).
Altezza massima (es. 2000 mm).
Larghezza minima (es. 1000 mm).
Larghezza massima (es. 2000 mm).
Incremento per altezza/larghezza (es. 200 mm).
Input Recuperati dal Database:
Profili e Dati Associati (Tabella series_profiles):

Nome del Profilo (es. Telaio, Anta, Fermavetro).
Prezzo al Metro (cost_per_meter).
Lunghezza della Barra (bar_length).
Percentuale di Sfrido (scrap_percentage).
Lunghezza Minima Riutilizzabile (min_reusable_length).
Regole per i Profili (Tabella frame_type_profile_rules):

Moltiplicatore Altezza (multiplier_height).
Moltiplicatore Larghezza (multiplier_width).
Funzioni per il Calcolo della Griglia
1. Struttura Generale del Calcolo
Il calcolo deve essere eseguito in più fasi:

Generazione delle Dimensioni:

Genera tutte le combinazioni di altezza e larghezza in base ai range e all’incremento specificati dall’utente.
Calcolo del Materiale Necessario:

Per ogni combinazione:
Calcola la lunghezza totale richiesta per ogni profilo.
Aggiungi lo sfrido.
Determina il numero di barre necessarie e il residuo.
Ottimizzazione del Residuo:

Verifica se il residuo è riutilizzabile in base alla lunghezza minima riutilizzabile.
Calcolo del Costo Totale:

Calcola il costo per ogni profilo e somma i costi per ottenere il costo totale della combinazione.
2. Funzioni Specifiche
a) Generazione Combinazioni Dimensioni
Crea un array di combinazioni altezza x larghezza in base ai range e all’incremento:

javascript
Copia
Modifica
function generateDimensions(minHeight, maxHeight, minWidth, maxWidth, increment) {
  const dimensions = [];
  for (let height = minHeight; height <= maxHeight; height += increment) {
    for (let width = minWidth; width <= maxWidth; width += increment) {
      dimensions.push({ height, width });
    }
  }
  return dimensions;
}
b) Calcolo Materiale per Profilo
Calcola la lunghezza richiesta per un profilo e il numero di barre necessarie:

javascript
Copia
Modifica
function calculateProfileMaterial({
  height,
  width,
  multiplierHeight,
  multiplierWidth,
  scrapPercentage,
  barLength,
  costPerMeter,
  minReusableLength,
}) {
  const requiredLength = (height * multiplierHeight) + (width * multiplierWidth);
  const lengthWithScrap = requiredLength * (1 + scrapPercentage / 100);
  const fullBars = Math.ceil(lengthWithScrap / barLength);
  const leftover = (fullBars * barLength) - lengthWithScrap;
  const isReusable = leftover >= minReusableLength;
  const cost = fullBars * barLength * costPerMeter;

  return { requiredLength, lengthWithScrap, fullBars, leftover, isReusable, cost };
}
c) Calcolo Griglia Completa
Combina tutto per generare la griglia:

javascript
Copia
Modifica
function calculateGrid(dimensions, profiles, rules) {
  return dimensions.map(({ height, width }) => {
    const row = { height, width, totalCost: 0, materials: [] };

    profiles.forEach((profile) => {
      const rule = rules.find((r) => r.profileId === profile.id);
      const result = calculateProfileMaterial({
        height,
        width,
        multiplierHeight: rule.multiplierHeight,
        multiplierWidth: rule.multiplierWidth,
        scrapPercentage: profile.scrapPercentage,
        barLength: profile.barLength,
        costPerMeter: profile.costPerMeter,
        minReusableLength: profile.minReusableLength,
      });

      row.materials.push({
        profileName: profile.name,
        ...result,
      });

      row.totalCost += result.cost;
    });

    return row;
  });
}
3. Librerie da Utilizzare
a) Backend (Node.js o API in Next.js)
Librerie Base:
Axios (per richieste HTTP, se necessario per comunicare con il database).
Math.js (per calcoli numerici avanzati, se necessario).
Installazione:
bash
Copia
Modifica
npm install axios mathjs
b) Frontend
React Query o SWR per sincronizzare i dati con l’API backend.
Ant Design o React Table per mostrare la griglia.
Installazione:
bash
Copia
Modifica
npm install @tanstack/react-query antd
4. Scrittura dei Dati a Database
a) Creazione della Tabella price_grids
Utilizza la tabella proposta:

sql
Copia
Modifica
CREATE TABLE price_grids (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  frame_type_id TEXT NOT NULL REFERENCES frame_types(id) ON DELETE CASCADE,
  height INT NOT NULL,
  width INT NOT NULL,
  total_cost DECIMAL(10,2) NOT NULL,
  details JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
b) Inserimento dei Dati
Dopo aver calcolato la griglia, salva ogni riga nel database. Esempio:

javascript
Copia
Modifica
async function saveGridToDatabase(grid, seriesId, frameTypeId) {
  const rows = grid.map((row) => ({
    series_id: seriesId,
    frame_type_id: frameTypeId,
    height: row.height,
    width: row.width,
    total_cost: row.totalCost,
    details: JSON.stringify(row.materials),
  }));

  await axios.post('/api/save-grid', { rows });
}
Flusso Completo
Input Utente: Serie, tipologia, dimensioni.
Recupero Dati dal DB: Profili, regole.
Calcolo Griglia: Usa le funzioni sopra.
Salvataggio: Scrivi i risultati in price_grids.
Con questa struttura, il calcolo sarà ottimizzato e scalabile. Fammi sapere se vuoi dettagli su una parte specifica!