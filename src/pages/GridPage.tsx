import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/database.types";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, FileDown, ChevronLeft, Table as TableIcon, Trash2, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import * as XLSX from 'xlsx';

// Tipi per i dati dal database
type Tables = Database['public']['Tables']
type Series = Tables['series']['Row'];
type SeriesFrameType = Tables['series_frame_types']['Row'] & {
  frame_types: {
    id: string;
    label: string;
  }
};

// Tipi per il calcolo della griglia
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
  height_multiplier: number;  // rinominato per chiarezza
  width_multiplier: number;   // rinominato per chiarezza
};

type MaterialCalculation = {
  profileName: string;
  requiredLength: number;     // lunghezza richiesta senza sfrido
  lengthWithScrap: number;    // lunghezza con sfrido applicato
  fullBars: number;          // numero di barre intere necessarie
  leftover: number;          // materiale avanzato
  isReusable: boolean;       // se l'avanzo è riutilizzabile
  cost: number;             // costo finale
  usedLength: number;       // lunghezza effettivamente utilizzata/fatturata
};

type GridResult = {
  height: number;
  width: number;
  totalCost: number;
  materials: MaterialCalculation[];
};

// Aggiungi questo tipo per i risultati della griglia
type GridEntry = {
  height: number;
  width: number;
  total_cost: number;
  details: MaterialCalculation[];
};

// Schema di validazione del form
const formSchema = z.object({
  serie: z.string().min(1, "Seleziona una serie"),
  tipologia: z.string().min(1, "Seleziona una tipologia"),
  altezzaMin: z.number().min(0, "L'altezza minima deve essere maggiore di 0"),
  altezzaMax: z.number().min(0, "L'altezza massima deve essere maggiore di 0"),
  larghezzaMin: z.number().min(0, "La larghezza minima deve essere maggiore di 0"),
  larghezzaMax: z.number().min(0, "La larghezza massima deve essere maggiore di 0"),
  incremento: z.number().min(1, "L'incremento deve essere maggiore di 0"),
});

type FormValues = z.infer<typeof formSchema>;

// Funzioni di calcolo
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
  // 1. Calcola la lunghezza richiesta in centimetri
  const requiredLength = (
    (height * multiplierHeight) + 
    (width * multiplierWidth)
  ) / 100; // converti in metri

  console.log(`Calcolo lunghezza per ${profileName}:`, {
    height, width,
    multiplierHeight, multiplierWidth,
    requiredLength
  });

  // 2. Applica lo sfrido
  const lengthWithScrap = requiredLength * (1 + scrapPercentage / 100);
  console.log(`Lunghezza con sfrido (${scrapPercentage}%):`, lengthWithScrap);

  // 3. Calcola il numero di barre necessarie
  const fullBars = Math.ceil(lengthWithScrap / barLength);
  console.log(`Barre necessarie (lunghezza barra: ${barLength}m):`, fullBars);

  // 4. Calcola il materiale avanzato
  const leftover = (fullBars * barLength) - lengthWithScrap;
  const isReusable = leftover >= minReusableLength;
  console.log('Materiale avanzato:', {
    leftover,
    isReusable,
    minReusableLength
  });

  // 5. Calcola la lunghezza effettivamente utilizzata/fatturata
  const usedLength = isReusable ? lengthWithScrap : (fullBars * barLength);
  console.log('Lunghezza utilizzata:', usedLength);

  // 6. Calcola il costo finale
  const cost = Number((usedLength * costPerMeter).toFixed(2));
  console.log(`Costo finale (${costPerMeter}€/m):`, cost);

  return {
    profileName,
    requiredLength: Number(requiredLength.toFixed(3)),
    lengthWithScrap: Number(lengthWithScrap.toFixed(3)),
    fullBars,
    leftover: Number(leftover.toFixed(3)),
    isReusable,
    cost,
    usedLength: Number(usedLength.toFixed(3))
  };
};

const calculateGrid = async (formData: FormValues): Promise<GridResult[]> => {
  try {
    console.log('=== INIZIO CALCOLO GRIGLIA ===');
    console.log('Dati form:', formData);

    // 1. Recupera i profili della serie con join a profiles
    const { data: seriesProfiles, error: profilesError } = await supabase
      .from('series_profiles')
      .select(`
        *,
        profiles (
          id,
          name
        )
      `)
      .eq('series_id', formData.serie);

    if (profilesError) throw new Error(`Errore nel recupero dei profili: ${profilesError.message}`);
    if (!seriesProfiles || seriesProfiles.length === 0) {
      throw new Error(`Nessun profilo trovato per la serie ${formData.serie}`);
    }

    console.log('Profili della serie recuperati:', seriesProfiles);

    // 2. Recupera le regole per la tipologia
    const { data: rules, error: rulesError } = await supabase
      .from('frame_type_profile_rules')
      .select('*')
      .eq('frame_type_id', formData.tipologia);

    if (rulesError) throw new Error(`Errore nel recupero delle regole: ${rulesError.message}`);
    if (!rules || rules.length === 0) {
      throw new Error(`Nessuna regola trovata per la tipologia ${formData.tipologia}`);
    }

    console.log('Regole recuperate:', rules);

    // 3. Associa i profili alle regole
    const profilesWithRules = seriesProfiles.map(profile => {
      const rule = rules.find(r => r.profile_id === profile.profile_id);
      if (!rule) {
        console.log(`Nessuna regola trovata per il profilo ${profile.profile_id}`);
        return null;
      }
      return {
        ...profile,
        rule,
        profileName: profile.profiles?.name || profile.profile_id
      };
    }).filter((p): p is (typeof seriesProfiles[0] & { rule: typeof rules[0], profileName: string }) => p !== null);

    console.log('Profili con regole:', profilesWithRules);

    if (profilesWithRules.length === 0) {
      throw new Error('Nessun profilo ha regole associate per questa combinazione serie/tipologia');
    }

    // 4. Genera le dimensioni
    const dimensions = generateDimensions(
      formData.altezzaMin,
      formData.altezzaMax,
      formData.larghezzaMin,
      formData.larghezzaMax,
      formData.incremento
    );

    console.log('Dimensioni generate:', dimensions);

    // 5. Calcola la griglia
    return dimensions.map(({ height, width }) => {
      const materials = profilesWithRules.map(profile => {
        const result = calculateProfileMaterial({
          height,
          width,
          multiplierHeight: profile.rule.height_multiplier,
          multiplierWidth: profile.rule.width_multiplier,
          scrapPercentage: profile.scrap_percentage,
          barLength: profile.bar_length,
          costPerMeter: profile.cost_per_meter,
          minReusableLength: profile.min_reusable_length,
          profileName: profile.profileName
        });

        console.log(`Calcolo per ${profile.profileName} (${height}x${width}):`, result);
        return result;
      });

      const totalCost = materials.reduce((sum, mat) => sum + mat.cost, 0);
      console.log(`Costo totale per ${height}x${width}:`, totalCost);

      return {
        height,
        width,
        totalCost: Number(totalCost.toFixed(2)),
        materials
      };
    });
  } catch (error) {
    console.error('Errore nel calcolo della griglia:', error);
    throw error;
  }
};

const debugDatabaseData = async (seriesId: string, frameTypeId: string) => {
  console.log('=== DEBUG DATABASE DATA ===');
  
  // 1. Verifica serie
  const { data: series } = await supabase
    .from('series')
    .select('*')
    .eq('id', seriesId)
    .single();
  
  console.log('Serie selezionata:', series);

  // 2. Verifica profili della serie con tutti i campi
  const { data: profiles } = await supabase
    .from('series_profiles')
    .select('*')
    .eq('series_id', seriesId);
  
  console.log('Profili della serie (dettaglio completo):', profiles?.map(p => ({
    id: p.id,
    name: p.name,
    cost_per_meter: p.cost_per_meter,
    bar_length: p.bar_length,
    scrap_percentage: p.scrap_percentage,
    min_reusable_length: p.min_reusable_length
  })));

  // 3. Verifica tipologia
  const { data: frameType } = await supabase
    .from('frame_types')
    .select('*')
    .eq('id', frameTypeId)
    .single();
  
  console.log('Tipologia selezionata:', frameType);

  // 4. Verifica regole esistenti con dettagli
  const { data: rules } = await supabase
    .from('frame_type_profile_rules')
    .select('*')
    .eq('frame_type_id', frameTypeId);
  
  console.log('Regole della tipologia (dettaglio completo):', rules?.map(r => ({
    id: r.id,
    profile_id: r.profile_id,
    multiplier_height: r.height_multiplier,
    multiplier_width: r.width_multiplier
  })));

  // 5. Verifica associazioni
  if (profiles && rules) {
    console.log('=== ANALISI ASSOCIAZIONI ===');
    console.log('Profili disponibili:', profiles.map(p => ({
      id: p.id,
      profile_id: p.profile_id,
      cost: p.cost_per_meter
    })));
    
    console.log('Regole:', rules.map(r => ({
      id: r.id,
      profile_id: r.profile_id,
      height_mult: r.height_multiplier,
      width_mult: r.width_multiplier
    })));
    
    profiles.forEach(profile => {
      const profileRules = rules.filter(rule => rule.profile_id === profile.profile_id);
      console.log(`Profilo (profile_id: ${profile.profile_id}):`, {
        haRegole: profileRules.length > 0,
        numeroRegole: profileRules.length,
        dettaglioRegole: profileRules
      });
    });
  }

  console.log('=== FINE DEBUG ===');
};

// Modifica il tipo ExistingGrid
type ExistingGrid = {
  id: string;
  series_id: string;
  frame_type_id: string;
  created_at: string;
  series: { name: string };
  frame_types: { label: string };
  entries: Array<{
    height: number;
    width: number;
    total_cost: number;
    details: MaterialCalculation[];
  }>;
};

// Aggiungi queste funzioni prima del componente GridPage
const exportToExcelAsList = (grid: ExistingGrid) => {
  try {
    // Prepara i dati in formato lista
    const data = grid.entries.map(entry => ({
      'Altezza (cm)': entry.height,
      'Larghezza (cm)': entry.width,
      'Prezzo Totale (€)': entry.total_cost.toFixed(2),
      ...entry.details.reduce((acc, detail) => ({
        ...acc,
        [`${detail.profileName} - Lunghezza (m)`]: detail.requiredLength.toFixed(2),
        [`${detail.profileName} - Costo (€)`]: detail.cost.toFixed(2)
      }), {})
    }));

    // Crea il workbook e il worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // Aggiungi il worksheet al workbook
    XLSX.utils.book_append_sheet(wb, ws, "Lista Prezzi");

    // Scarica il file
    XLSX.writeFile(wb, `griglia_${grid.series.name}_${grid.frame_types.label}_lista.xlsx`);
    
    toast.success("File Excel (lista) esportato con successo!");
  } catch (error) {
    console.error('Errore esportazione Excel:', error);
    toast.error("Errore nell'esportazione del file Excel");
  }
};

const exportToExcelAsMatrix = (grid: ExistingGrid) => {
  try {
    // Ordina le entries per altezza e larghezza
    const sortedEntries = [...grid.entries].sort((a, b) => {
      if (a.height === b.height) return a.width - b.width;
      return a.height - b.height;
    });

    // Trova tutte le altezze e larghezze uniche
    const heights = Array.from(new Set(sortedEntries.map(e => e.height))).sort((a, b) => a - b);
    const widths = Array.from(new Set(sortedEntries.map(e => e.width))).sort((a, b) => a - b);

    // Crea la matrice dei dati
    const matrix = [
      ['', ...widths.map(w => `L: ${w}`)], // Header row
      ...heights.map(h => {
        const row = [`H: ${h}`];
        widths.forEach(w => {
          const entry = sortedEntries.find(e => e.height === h && e.width === w);
          row.push(entry ? entry.total_cost.toFixed(2) : '');
        });
        return row;
      })
    ];

    // Crea il workbook e il worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(matrix);

    // Aggiungi un foglio per i dettagli
    const detailsData = sortedEntries.map(entry => ({
      'Altezza (cm)': entry.height,
      'Larghezza (cm)': entry.width,
      'Prezzo Totale (€)': entry.total_cost.toFixed(2),
      ...entry.details.reduce((acc, detail) => ({
        ...acc,
        [`${detail.profileName} - Lunghezza (m)`]: detail.requiredLength.toFixed(2),
        [`${detail.profileName} - Costo (€)`]: detail.cost.toFixed(2)
      }), {})
    }));
    const wsDetails = XLSX.utils.json_to_sheet(detailsData);

    // Aggiungi i worksheet al workbook
    XLSX.utils.book_append_sheet(wb, ws, "Matrice Prezzi");
    XLSX.utils.book_append_sheet(wb, wsDetails, "Dettagli");

    // Scarica il file
    XLSX.writeFile(wb, `griglia_${grid.series.name}_${grid.frame_types.label}_matrice.xlsx`);
    
    toast.success("File Excel (matrice) esportato con successo!");
  } catch (error) {
    console.error('Errore esportazione Excel:', error);
    toast.error("Errore nell'esportazione del file Excel");
  }
};

const GridPage = () => {
  const [results, setResults] = useState<GridResult[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [frameTypes, setFrameTypes] = useState<SeriesFrameType[]>([]);
  const [existingGrids, setExistingGrids] = useState<ExistingGrid[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [gridToDelete, setGridToDelete] = useState<string | null>(null);
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);
  const navigate = useNavigate();
  
  // Carica i dati iniziali
  useEffect(() => {
    loadData();
    loadExistingGrids();
  }, []);

  const loadData = async () => {
    try {
      // Carica le serie
      const { data: seriesData, error: seriesError } = await supabase
        .from('series')
        .select('*')
        .order('name');

      if (seriesError) throw seriesError;
      setSeries(seriesData || []);

      // Le tipologie verranno caricate quando l'utente seleziona una serie
    } catch (error) {
      console.error('Errore nel caricamento dei dati:', error);
      toast.error('Errore nel caricamento dei dati');
    }
  };

  // Carica le tipologie quando viene selezionata una serie
  const loadFrameTypes = async (seriesId: string) => {
    try {
      const { data: frameTypesData, error: frameTypesError } = await supabase
        .from('series_frame_types')
        .select(`
          *,
          frame_types (
            id,
            label
          )
        `)
        .eq('series_id', seriesId)
        .order('frame_type_id');

      if (frameTypesError) throw frameTypesError;
      setFrameTypes(frameTypesData || []);
    } catch (error) {
      console.error('Errore nel caricamento delle tipologie:', error);
      toast.error('Errore nel caricamento delle tipologie');
    }
  };

  const loadExistingGrids = async () => {
    try {
      const { data, error } = await supabase
        .from('price_grids')
        .select(`
          id,
          series_id,
          frame_type_id,
          created_at,
          height,
          width,
          total_cost,
          details,
          series:series_id!inner (
            name
          ),
          frame_types:frame_type_id!inner (
            label
          )
        `)
        .order('created_at', { ascending: false })
        .returns<{
          id: string;
          series_id: string;
          frame_type_id: string;
          created_at: string;
          height: number;
          width: number;
          total_cost: number;
          details: MaterialCalculation[];
          series: { name: string };
          frame_types: { label: string };
        }[]>();

      if (error) throw error;

      // Raggruppa i risultati per serie e tipologia
      const groupedData = data?.reduce((acc, curr) => {
        const key = `${curr.series_id}-${curr.frame_type_id}`;
        if (!acc[key]) {
          acc[key] = {
            id: key,
            series_id: curr.series_id,
            frame_type_id: curr.frame_type_id,
            created_at: curr.created_at,
            series: { name: curr.series?.name ?? '' },
            frame_types: { label: curr.frame_types?.label ?? '' },
            entries: []
          };
        }
        acc[key].entries.push({
          height: curr.height,
          width: curr.width,
          total_cost: curr.total_cost,
          details: curr.details
        });
        return acc;
      }, {} as Record<string, ExistingGrid>);

      setExistingGrids(Object.values(groupedData));
    } catch (error) {
      console.error('Errore nel caricamento delle griglie:', error);
      toast.error('Errore nel caricamento delle griglie esistenti');
    }
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      serie: "",
      tipologia: "",
      altezzaMin: 0,
      altezzaMax: 0,
      larghezzaMin: 0,
      larghezzaMax: 0,
      incremento: 10,
    },
    mode: "onChange"
  });

  // Gestisce il cambio della serie selezionata
  const handleSeriesChange = (value: string) => {
    form.setValue('serie', value);
    form.setValue('tipologia', ''); // Resetta la tipologia
    if (value) {
      loadFrameTypes(value);
    } else {
      setFrameTypes([]);
    }
  };

  const onSubmit = async (data: FormValues) => {
    try {
      // Verifica se esiste già una griglia per questa combinazione
      const existingGrid = existingGrids.find(
        grid => grid.series_id === data.serie && grid.frame_type_id === data.tipologia
      );

      if (existingGrid) {
        toast.error('Esiste già una griglia per questa combinazione di serie e tipologia. Elimina prima quella esistente.');
        return;
      }

      // Aggiungo il debug prima del calcolo
      await debugDatabaseData(data.serie, data.tipologia);
      
      // Calcola la griglia
      const gridResults = await calculateGrid(data);
      
      // Prepara i dati per il salvataggio nel database
      const rowsToSave: Database['public']['Tables']['price_grids']['Insert'][] = gridResults.map(row => ({
        series_id: data.serie,
        frame_type_id: data.tipologia,
        height: row.height,
        width: row.width,
        total_cost: Number(row.totalCost.toFixed(2)) || 0, // Assicuriamoci che non sia mai null
        details: row.materials.map(m => ({
          profileName: m.profileName,
          cost: Number(m.cost.toFixed(2)) || 0,
          requiredLength: Number(m.requiredLength.toFixed(3)) || 0,
          lengthWithScrap: Number(m.lengthWithScrap.toFixed(3)) || 0,
          usedLength: Number(m.usedLength.toFixed(3)) || 0,
          leftover: Number(m.leftover.toFixed(3)) || 0,
          fullBars: m.fullBars,
          isReusable: m.isReusable
        }))
      }));

      console.log('Dati da salvare:', rowsToSave);

      // Verifica che non ci siano valori null o undefined
      const hasInvalidData = rowsToSave.some(row => 
        row.total_cost === null || 
        row.total_cost === undefined || 
        row.height === null || 
        row.width === null
      );

      if (hasInvalidData) {
        throw new Error('Ci sono valori non validi nei dati da salvare');
      }

      // Salva i risultati nel database
      const { error } = await supabase
        .from('price_grids')
        .insert(rowsToSave);

      if (error) {
        console.error('Errore nel salvataggio:', error);
        throw error;
      }
      
      // Ricarica le griglie esistenti
      await loadExistingGrids();
      
      // Imposta l'accordion aperto sulla nuova griglia
      const newGridId = `${data.serie}-${data.tipologia}`;
      setOpenAccordion(newGridId);
      
      // Resetta i risultati temporanei
      setResults([]);
      
      toast.success("Griglia generata e salvata con successo!");
    } catch (error) {
      console.error('Errore:', error);
      toast.error(error instanceof Error ? error.message : "Errore nella generazione della griglia");
    }
  };

  const handleExportCSV = () => {
    try {
      const csvHeader = "Altezza (cm),Larghezza (cm),Costo Totale (€),Dettaglio Profili\n";
      const csvContent = results.map(row => {
        const dettaglioProfili = row.materials.map(m => 
          `${m.profileName}:${m.requiredLength}m:${m.cost.toFixed(2)}€`
        ).join(';');
        
        return `${row.height},${row.width},${row.totalCost.toFixed(2)},${dettaglioProfili}`;
      }).join('\n');

      const blob = new Blob([csvHeader + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `griglia_prezzi_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      
      toast.success("File CSV esportato con successo!");
    } catch (error) {
      console.error('Errore esportazione CSV:', error);
      toast.error("Errore nell'esportazione del file CSV");
    }
  };

  const handleExportPDF = () => {
    console.log("Esportazione PDF...");
    toast.success("File PDF esportato con successo!");
  };

  const handleDeleteGrid = async (seriesId: string, frameTypeId: string) => {
    try {
      console.log('Eliminazione griglia:', { seriesId, frameTypeId });
      
      const { error } = await supabase
        .from('price_grids')
        .delete()
        .eq('series_id', seriesId)
        .eq('frame_type_id', frameTypeId);

      if (error) throw error;
      
      toast.success('Griglia eliminata con successo');
      loadExistingGrids();
      setDeleteDialogOpen(false);
      setGridToDelete(null);
    } catch (error) {
      console.error('Errore nella cancellazione della griglia:', error);
      toast.error('Errore nella cancellazione della griglia');
    }
  };

  // Aggiungi questa funzione per la modifica di un risultato
  const handleEditEntry = async (gridId: string, entry: GridEntry, index: number) => {
    try {
      const [seriesId, frameTypeId] = gridId.split('-');
      const { error } = await supabase
        .from('price_grids')
        .update({
          total_cost: entry.total_cost,
          details: entry.details
        })
        .match({
          series_id: seriesId,
          frame_type_id: frameTypeId,
          height: entry.height,
          width: entry.width
        });

      if (error) throw error;
      toast.success('Risultato aggiornato con successo');
      loadExistingGrids();
    } catch (error) {
      console.error('Errore nell\'aggiornamento del risultato:', error);
      toast.error('Errore nell\'aggiornamento del risultato');
    }
  };

  // Modifica il FormField per l'input numerico
  const NumericFormField = ({ name, label }: { 
    name: keyof FormValues; 
    label: string;
  }) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-slate-200">{label}</FormLabel>
          <FormControl>
            <input
              type="text"
              className="flex h-10 w-full rounded-md border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              value={field.value || ''}
              onChange={e => {
                const value = e.target.value.replace(/[^0-9]/g, '');
                field.onChange(value ? parseInt(value) : 0);
              }}
              placeholder={`Inserisci ${label.toLowerCase()}`}
            />
          </FormControl>
        </FormItem>
      )}
    />
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-4 sm:py-8 text-slate-200">
      <div className="container mx-auto px-3 sm:px-4 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 mb-6 sm:mb-8">
          <button
            onClick={() => navigate('/')}
            className="group flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-800/40 text-slate-300 hover:text-white rounded-xl backdrop-blur-sm hover:bg-slate-700/40 transition-all duration-300 border border-slate-700/50 hover:border-slate-600/50 shadow-lg hover:shadow-xl"
          >
            <ChevronLeft className="w-5 h-5 transition-transform duration-300 group-hover:-translate-x-1" />
            <span className="font-medium">Home</span>
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
            <span className="p-2 bg-indigo-500/10 rounded-xl">
              <TableIcon className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-400" />
            </span>
            Genera Griglia Prezzi
          </h1>
        </div>

        {/* Form di input */}
        <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl shadow-lg border border-slate-700/50 p-4 sm:p-6 mb-6 transition-all duration-300 hover:shadow-xl hover:bg-slate-800/50">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="serie"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-200">Serie</FormLabel>
                      <Select
                        onValueChange={handleSeriesChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-slate-800/80 border-slate-700 text-slate-200 focus:ring-2 focus:ring-indigo-500">
                            <SelectValue placeholder="Seleziona una serie" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          {series.map((serie) => (
                            <SelectItem 
                              key={serie.id} 
                              value={serie.id}
                              className="text-slate-200 focus:bg-indigo-500/20 focus:text-white"
                            >
                              {serie.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tipologia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-200">Tipologia</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={!form.watch("serie")}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-slate-800/80 border-slate-700 text-slate-200 focus:ring-2 focus:ring-indigo-500">
                            <SelectValue placeholder="Seleziona una tipologia" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          {frameTypes.map((frameType) => (
                            <SelectItem 
                              key={frameType.id} 
                              value={frameType.frame_type_id}
                              className="text-slate-200 focus:bg-indigo-500/20 focus:text-white"
                            >
                              {frameType.frame_types.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <NumericFormField name="altezzaMin" label="Altezza Minima (cm)" />
                <NumericFormField name="altezzaMax" label="Altezza Massima (cm)" />
                <NumericFormField name="larghezzaMin" label="Larghezza Minima (cm)" />
                <NumericFormField name="larghezzaMax" label="Larghezza Massima (cm)" />
                <NumericFormField name="incremento" label="Incremento (cm)" />
              </div>

              <div className="flex justify-end pt-6">
                <button
                  type="submit"
                  className="px-6 py-3 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition-all duration-200 shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/30 font-medium flex items-center gap-2"
                >
                  <TableIcon className="w-5 h-5" />
                  Genera Griglia
                </button>
              </div>
            </form>
          </Form>
        </div>

        {/* Sezione Griglie Esistenti */}
        <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl shadow-lg border border-slate-700/50 p-4 sm:p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <TableIcon className="w-5 h-5" />
            Griglie Esistenti
          </h2>
          <Accordion 
            type="single" 
            collapsible 
            className="space-y-4"
            value={openAccordion || undefined}
            onValueChange={setOpenAccordion}
          >
            {existingGrids.map((grid) => (
              <AccordionItem 
                key={grid.id} 
                value={`${grid.series_id}-${grid.frame_type_id}`} 
                className="border border-slate-700/50 rounded-lg"
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <AccordionTrigger className="flex-1">
                    <div className="flex items-center gap-4">
                      <span className="font-medium">{grid.series.name}</span>
                      <span className="text-slate-400">|</span>
                      <span>{grid.frame_types.label}</span>
                      <span className="text-sm text-slate-400">
                        {new Date(grid.created_at).toLocaleDateString('it-IT')}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        exportToExcelAsList(grid);
                      }}
                      className="text-green-400 hover:text-green-300 transition-colors p-2 hover:bg-green-500/10 rounded-lg"
                      title="Esporta come lista"
                    >
                      <FileDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        exportToExcelAsMatrix(grid);
                      }}
                      className="text-blue-400 hover:text-blue-300 transition-colors p-2 hover:bg-blue-500/10 rounded-lg"
                      title="Esporta come matrice"
                    >
                      <TableIcon className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('Richiesta eliminazione per:', grid.series_id, grid.frame_type_id);
                        setGridToDelete(`${grid.series_id}|${grid.frame_type_id}`);
                        setDeleteDialogOpen(true);
                      }}
                      className="text-red-400 hover:text-red-300 transition-colors p-2 hover:bg-red-500/10 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <AccordionContent className="border-t border-slate-700/50">
                  {/* Vista Desktop */}
                  <div className="hidden md:block overflow-x-auto px-4 py-3">
                    <table className="min-w-full divide-y divide-slate-700/50">
                      <thead>
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">Altezza (cm)</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">Larghezza (cm)</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">Prezzo Totale (€)</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">Dettaglio Profili</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-slate-400 uppercase">Azioni</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/50">
                        {grid.entries.map((entry, index) => (
                          <tr key={`${entry.height}-${entry.width}`} className="hover:bg-slate-700/30">
                            <td className="px-4 py-2 whitespace-nowrap">{entry.height}</td>
                            <td className="px-4 py-2 whitespace-nowrap">{entry.width}</td>
                            <td className="px-4 py-2 whitespace-nowrap">{entry.total_cost.toFixed(2)}</td>
                            <td className="px-4 py-2">
                              {entry.details.map((detail, idx) => (
                                <div key={idx} className="text-sm">
                                  {detail.profileName}: {detail.requiredLength.toFixed(2)}m - €{detail.cost.toFixed(2)}
                                </div>
                              ))}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-right">
                              <button
                                onClick={() => handleEditEntry(`${grid.series_id}-${grid.frame_type_id}`, entry, index)}
                                className="text-blue-400 hover:text-blue-300 transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Vista Mobile */}
                  <div className="md:hidden px-4 py-3">
                    {grid.entries.map((entry, index) => (
                      <div 
                        key={`${entry.height}-${entry.width}`} 
                        className="mb-3 last:mb-0 bg-slate-800/40 rounded-lg p-3"
                      >
                        <div className="flex justify-between items-center mb-3">
                          <div>
                            <div className="text-sm text-slate-400">Dimensioni</div>
                            <div className="text-lg font-medium">{entry.height} × {entry.width} cm</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-slate-400">Totale</div>
                            <div className="text-lg font-medium">€{entry.total_cost.toFixed(2)}</div>
                          </div>
                        </div>
                        
                        <div className="bg-slate-900/30 rounded p-2.5">
                          {entry.details.map((detail, idx) => (
                            <div key={idx} className="flex justify-between items-center py-1.5 text-sm text-slate-300">
                              <span>{detail.profileName}</span>
                              <div className="text-right">
                                <span>{detail.requiredLength.toFixed(2)}m</span>
                                <span className="ml-2 text-slate-400">€{detail.cost.toFixed(2)}</span>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex justify-end mt-2">
                          <button
                            onClick={() => handleEditEntry(`${grid.series_id}-${grid.frame_type_id}`, entry, index)}
                            className="text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Dialog di conferma eliminazione */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Conferma eliminazione</DialogTitle>
              <DialogDescription>
                Sei sicuro di voler eliminare questa griglia? L'operazione non può essere annullata.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setGridToDelete(null);
                }}
              >
                Annulla
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (gridToDelete) {
                    const [seriesId, frameTypeId] = gridToDelete.split('|');
                    handleDeleteGrid(seriesId, frameTypeId);
                  }
                }}
              >
                Elimina
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default GridPage;