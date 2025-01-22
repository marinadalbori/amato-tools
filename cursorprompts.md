Ecco una serie di step per implementare il calcolo delle griglie in GridPage.tsx:
Step 1: Definizione dei Tipi
// ... existing code ...

// Aggiungi questi nuovi tipi
type Profile = {
  id: string;
  name: string;
  cost_per_meter: number;
  bar_length: number;
  scrap_percentage: number;
  min_reusable_length: number;
};

type ProfileRule = {
  profile_id: string;
  multiplier_height: number;
  multiplier_width: number;
};

type MaterialCalculation = {
  profileName: string;
  requiredLength: number;
  lengthWithScrap: number;
  fullBars: number;
  leftover: number;
  isReusable: boolean;
  cost: number;
};

// Modifica il tipo GridResult esistente
type GridResult = {
  height: number;
  width: number;
  totalCost: number;
  materials: MaterialCalculation[];
};

Step 2: Funzioni di Calcolo
// ... existing code ...

const generateDimensions = (minHeight: number, maxHeight: number, minWidth: number, maxWidth: number, increment: number) => {
  const dimensions: { height: number; width: number }[] = [];
  for (let height = minHeight; height <= maxHeight; height += increment) {
    for (let width = minWidth; width <= maxWidth; width += increment) {
      dimensions.push({ height, width });
    }
  }
  return dimensions;
};

const calculateProfileMaterial = ({
  height,
  width,
  multiplierHeight,
  multiplierWidth,
  scrapPercentage,
  barLength,
  costPerMeter,
  minReusableLength,
  profileName,
}: {
  height: number;
  width: number;
  multiplierHeight: number;
  multiplierWidth: number;
  scrapPercentage: number;
  barLength: number;
  costPerMeter: number;
  minReusableLength: number;
  profileName: string;
}): MaterialCalculation => {
  const requiredLength = (height * multiplierHeight) + (width * multiplierWidth);
  const lengthWithScrap = requiredLength * (1 + scrapPercentage / 100);
  const fullBars = Math.ceil(lengthWithScrap / barLength);
  const leftover = (fullBars * barLength) - lengthWithScrap;
  const isReusable = leftover >= minReusableLength;
  const cost = fullBars * barLength * costPerMeter;

  return {
    profileName,
    requiredLength,
    lengthWithScrap,
    fullBars,
    leftover,
    isReusable,
    cost
  };
};

Step 3: Funzione di Calcolo Principale
// ... existing code ...

const calculateGrid = async (formData: FormValues): Promise<GridResult[]> => {
  try {
    // Recupera profili e regole dal database
    const { data: profiles } = await supabase
      .from('series_profiles')
      .select('*')
      .eq('series_id', formData.serie);

    const { data: rules } = await supabase
      .from('frame_type_profile_rules')
      .select('*')
      .eq('frame_type_id', formData.tipologia);

    if (!profiles || !rules) throw new Error('Dati non trovati');

    // Genera dimensioni
    const dimensions = generateDimensions(
      formData.altezzaMin,
      formData.altezzaMax,
      formData.larghezzaMin,
      formData.larghezzaMax,
      formData.incremento
    );

    // Calcola la griglia
    return dimensions.map(({ height, width }) => {
      const materials = profiles.map(profile => {
        const rule = rules.find(r => r.profile_id === profile.id);
        if (!rule) throw new Error(`Regola non trovata per il profilo ${profile.id}`);

        return calculateProfileMaterial({
          height,
          width,
          multiplierHeight: rule.multiplier_height,
          multiplierWidth: rule.multiplier_width,
          scrapPercentage: profile.scrap_percentage,
          barLength: profile.bar_length,
          costPerMeter: profile.cost_per_meter,
          minReusableLength: profile.min_reusable_length,
          profileName: profile.name
        });
      });

      return {
        height,
        width,
        totalCost: materials.reduce((sum, mat) => sum + mat.cost, 0),
        materials
      };
    });
  } catch (error) {
    console.error('Errore nel calcolo della griglia:', error);
    throw error;
  }
};

Step 4: Aggiornamento della Funzione onSubmit
// ... existing code ...

const onSubmit = async (data: FormValues) => {
  try {
    const gridResults = await calculateGrid(data);
    setResults(gridResults);
    
    // Salva i risultati nel database
    const rowsToSave = gridResults.map(row => ({
      series_id: data.serie,
      frame_type_id: data.tipologia,
      height: row.height,
      width: row.width,
      total_cost: row.totalCost,
      details: row.materials
    }));

    const { error } = await supabase
      .from('price_grids')
      .insert(rowsToSave);

    if (error) throw error;
    
    toast.success("Griglia generata e salvata con successo!");
  } catch (error) {
    console.error('Errore:', error);
    toast.error("Errore nella generazione della griglia");
  }
};

Step 5: Implementazione Export
// ... existing code ...

const handleExportCSV = () => {
  const csvContent = results.map(row => {
    return `${row.height},${row.width},${row.totalCost},${row.materials.map(m => 
      `${m.profileName}:${m.requiredLength}:${m.cost}`).join(';')}`;
  }).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'griglia_prezzi.csv';
  a.click();
};

Questi step dovrebbero essere implementati in ordine. Ogni step costruisce sulla base del precedente. Fammi sapere se hai bisogno di chiarimenti su qualche parte specifica!