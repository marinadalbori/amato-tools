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
  // Converti le dimensioni da centimetri a metri
  const heightInMeters = height / 100;
  const widthInMeters = width / 100;

  const requiredLength = (heightInMeters * multiplierHeight) + (widthInMeters * multiplierWidth);
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

const calculateGrid = async (formData: FormValues): Promise<GridResult[]> => {
  try {
    console.log('Inizio calcolo griglia con dati:', formData);

    // Recupera profili e regole dal database
    const { data: profiles, error: profilesError } = await supabase
      .from('series_profiles')
      .select(`
        *,
        profile:profiles!inner (
          name
        )
      `)
      .eq('series_id', formData.serie);

    if (profilesError) throw new Error(`Errore nel recupero dei profili: ${profilesError.message}`);
    
    console.log('Profili trovati:', profiles?.length || 0, profiles);

    const { data: rules, error: rulesError } = await supabase
      .from('frame_type_profile_rules')
      .select('*')
      .eq('frame_type_id', formData.tipologia);

    if (rulesError) throw new Error(`Errore nel recupero delle regole: ${rulesError.message}`);
    
    console.log('Regole trovate:', rules?.length || 0, rules);

    if (!profiles || profiles.length === 0) {
      throw new Error(`Nessun profilo trovato per la serie ${formData.serie}`);
    }

    if (!rules || rules.length === 0) {
      throw new Error(`Nessuna regola trovata per la tipologia ${formData.tipologia}`);
    }

    // Filtra i profili che hanno regole associate
    const profilesWithRules = profiles.filter(profile => {
      const hasRule = rules.some(rule => rule.profile_id === profile.profile_id);
      if (!hasRule) {
        console.log(`Il profilo ${profile.profile_id} non ha regole associate`);
      }
      return hasRule;
    });

    console.log('Profili con regole:', profilesWithRules.length, profilesWithRules);

    if (profilesWithRules.length === 0) {
      throw new Error(`Nessun profilo della serie ${formData.serie} ha regole associate alla tipologia ${formData.tipologia}. 
        Verifica di aver configurato correttamente le regole per questa combinazione serie/tipologia.`);
    }

    // Genera dimensioni
    const dimensions = generateDimensions(
      formData.altezzaMin,
      formData.altezzaMax,
      formData.larghezzaMin,
      formData.larghezzaMax,
      formData.incremento
    );

    console.log('Dimensioni generate:', dimensions.length);

    // Calcola la griglia
    return dimensions.map(({ height, width }) => {
      const materials = profilesWithRules.map(profile => {
        const rule = rules.find(r => r.profile_id === profile.profile_id);
        if (!rule) {
          console.warn(`Regola non trovata per il profilo ${profile.profile_id} nonostante il filtro`);
          return null;
        }

        return calculateProfileMaterial({
          height,
          width,
          multiplierHeight: rule.height_multiplier,
          multiplierWidth: rule.width_multiplier,
          scrapPercentage: profile.scrap_percentage,
          barLength: profile.bar_length,
          costPerMeter: profile.cost_per_meter,
          minReusableLength: profile.min_reusable_length,
          profileName: profile.profile.name
        });
      }).filter((material): material is MaterialCalculation => material !== null);

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
      const rowsToSave = gridResults.map(row => ({
        series_id: data.serie,
        frame_type_id: data.tipologia,
        height: row.height,
        width: row.width,
        total_cost: row.totalCost,
        details: row.materials
      }));

      // Salva i risultati nel database
      const { error } = await supabase
        .from('price_grids')
        .insert(rowsToSave);

      if (error) throw error;
      
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
      toast.error("Errore nella generazione della griglia");
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

                <FormField
                  control={form.control}
                  name="altezzaMin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-200">Altezza Minima (cm)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                          className="bg-slate-800/80 border-slate-700 text-slate-200 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-indigo-500"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="altezzaMax"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-200">Altezza Massima (cm)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                          className="bg-slate-800/80 border-slate-700 text-slate-200 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-indigo-500"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="larghezzaMin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-200">Larghezza Minima (cm)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                          className="bg-slate-800/80 border-slate-700 text-slate-200 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-indigo-500"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="larghezzaMax"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-200">Larghezza Massima (cm)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                          className="bg-slate-800/80 border-slate-700 text-slate-200 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-indigo-500"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="incremento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-200">Incremento (cm)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                          className="bg-slate-800/80 border-slate-700 text-slate-200 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-indigo-500"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
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
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('Richiesta eliminazione per:', grid.series_id, grid.frame_type_id);
                      setGridToDelete(`${grid.series_id}|${grid.frame_type_id}`);
                      setDeleteDialogOpen(true);
                    }}
                    className="text-red-400 hover:text-red-300 transition-colors ml-4"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <AccordionContent className="border-t border-slate-700/50">
                  <div className="overflow-x-auto px-4 py-3">
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