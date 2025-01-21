import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/database.types";
import { ChevronLeftIcon, WrenchScrewdriverIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";

// Definizione delle tipologie disponibili
const tipologieDisponibili = [
  { id: "battente1", label: "Battente 1 Anta" },
  { id: "battente2", label: "Battente 2 Ante" },
  { id: "fisso", label: "Fisso" },
  { id: "scorrevoleLinea", label: "Scorrevole in linea" },
  { id: "scorrevoleAlzante", label: "Scorrevole alzante" },
  { id: "porta", label: "Porta" },
] as const;

// Definizione dei profili per tipologia
const profiliPerTipologia = {
  battente1: ["Telaio", "Anta", "Fermavetro"],
  battente2: ["Telaio", "Anta", "Fermavetro", "Montante"],
  fisso: ["Telaio", "Fermavetro"],
  scorrevoleLinea: ["Telaio", "Anta Scorrevole", "Fermavetro", "Binario"],
  scorrevoleAlzante: ["Telaio", "Anta Alzante", "Fermavetro", "Binario Alzante"],
  porta: ["Telaio Porta", "Anta Porta", "Fermavetro"],
} as const;

type Tables = Database['public']['Tables'];
type SeriesRow = Tables['series']['Row'];
type SeriesInsert = Tables['series']['Insert'];
type SeriesFrameTypesInsert = Tables['series_frame_types']['Insert'];
type SeriesProfilesInsert = Tables['series_profiles']['Insert'];

// Schema di validazione del form
const formSchema = z.object({
  nome: z.string().min(1, "Il nome è obbligatorio"),
  tipologie: z.array(z.string()).min(1, "Seleziona almeno una tipologia"),
  profili: z.record(z.object({
    prezzoMetro: z.number().min(0, "Il prezzo deve essere maggiore o uguale a 0"),
    lunghezzaBarra: z.number().min(0, "La lunghezza deve essere maggiore o uguale a 0"),
    percentualeSfrido: z.number().min(0, "La percentuale di sfrido deve essere maggiore o uguale a 0"),
    minimoRiutilizzabile: z.number().min(0, "Il minimo riutilizzabile deve essere maggiore o uguale a 0"),
  })),
});

type FormValues = z.infer<typeof formSchema>;

interface SerieConfigurataExtended {
  id: string;
  nome: string;
  tipologie: string[];
  profili: Record<string, {
    prezzoMetro: number;
    lunghezzaBarra: number;
    percentualeSfrido: number;
    minimoRiutilizzabile: number;
  }>;
}

const ConfigurePage = () => {
  const [serieToEdit, setSerieToEdit] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Query per caricare le serie
  const { data: serieConfigurate, isLoading } = useQuery({
    queryKey: ['serie'],
    queryFn: async () => {
      const { data: series, error } = await supabase
        .from('series')
        .select(`
          *,
          series_frame_types ( * ),
          series_profiles ( * )
        `);

      if (error) {
        console.error('Errore nel caricamento delle serie:', error);
        throw error;
      }

      if (!series) return [];

      return series.map(serie => ({
        id: serie.id,
        nome: serie.nome,
        tipologie: serie.series_frame_types?.map(t => t.tipologia) || [],
        profili: serie.series_profiles?.reduce((acc, profilo) => ({
          ...acc,
          [profilo.nome_profilo]: {
            prezzoMetro: profilo.prezzo_metro,
            lunghezzaBarra: profilo.lunghezza_barra,
            percentualeSfrido: profilo.percentuale_sfrido,
            minimoRiutilizzabile: profilo.minimo_riutilizzabile,
          }
        }), {}) || {}
      })) as SerieConfigurataExtended[];
    },
  });

  // Mutation per salvare una serie
  const saveSerieMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      if (serieToEdit) {
        // Aggiornamento serie esistente
        const { data: serie, error: serieError } = await supabase
          .from('series')
          .update({ nome: data.nome })
          .eq('id', serieToEdit)
          .select()
          .single();

        if (serieError) throw serieError;

        // Elimina tipologie esistenti
        const { error: deleteTypesError } = await supabase
          .from('series_frame_types')
          .delete()
          .eq('series_id', serieToEdit);

        if (deleteTypesError) throw deleteTypesError;

        // Inserisce nuove tipologie
        const { error: insertTypesError } = await supabase
          .from('series_frame_types')
          .insert(
            data.tipologie.map(tipologia => ({
              series_id: serieToEdit,
              tipologia,
            }))
          );

        if (insertTypesError) throw insertTypesError;

        // Elimina profili esistenti
        const { error: deleteProfilesError } = await supabase
          .from('series_profiles')
          .delete()
          .eq('series_id', serieToEdit);

        if (deleteProfilesError) throw deleteProfilesError;

        // Inserisce nuovi profili
        const profiliToInsert: SeriesProfilesInsert[] = Object.entries(data.profili).map(([nome_profilo, profilo]) => ({
          series_id: serieToEdit,
          nome_profilo,
          prezzo_metro: profilo.prezzoMetro,
          lunghezza_barra: profilo.lunghezzaBarra,
          percentuale_sfrido: profilo.percentualeSfrido,
          minimo_riutilizzabile: profilo.minimoRiutilizzabile,
        }));

        const { error: insertProfilesError } = await supabase
          .from('series_profiles')
          .insert(profiliToInsert);

        if (insertProfilesError) throw insertProfilesError;

        return serie;
      } else {
        // Inserimento nuova serie
        const { data: serie, error: serieError } = await supabase
          .from('series')
          .insert({ nome: data.nome })
          .select()
          .single();

        if (serieError) throw serieError;

        // Inserisce tipologie
        const { error: insertTypesError } = await supabase
          .from('series_frame_types')
          .insert(
            data.tipologie.map(tipologia => ({
              series_id: serie.id,
              tipologia,
            }))
          );

        if (insertTypesError) throw insertTypesError;

        // Inserisce profili
        const profiliToInsert: SeriesProfilesInsert[] = Object.entries(data.profili).map(([nome_profilo, profilo]) => ({
          series_id: serie.id,
          nome_profilo,
          prezzo_metro: profilo.prezzoMetro,
          lunghezza_barra: profilo.lunghezzaBarra,
          percentuale_sfrido: profilo.percentualeSfrido,
          minimo_riutilizzabile: profilo.minimoRiutilizzabile,
        }));

        const { error: insertProfilesError } = await supabase
          .from('series_profiles')
          .insert(profiliToInsert);

        if (insertProfilesError) throw insertProfilesError;

        return serie;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serie'] });
      toast.success(serieToEdit ? 'Serie aggiornata con successo' : 'Serie creata con successo');
      form.reset();
      setSerieToEdit(null);
    },
    onError: (error) => {
      console.error('Errore durante il salvataggio:', error);
      toast.error('Si è verificato un errore: ' + error.message);
    },
  });

  // Mutation per eliminare una serie
  const deleteSerieMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('series')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serie'] });
      toast.success('Serie eliminata con successo');
    },
    onError: (error) => {
      toast.error('Si è verificato un errore durante l\'eliminazione: ' + error.message);
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      tipologie: [],
      profili: Object.fromEntries(
        Object.values(profiliPerTipologia).flat().map(profilo => [
          profilo,
          {
            prezzoMetro: 0,
            lunghezzaBarra: 0,
            percentualeSfrido: 5,
            minimoRiutilizzabile: 0.5,
          }
        ])
      ),
    },
  });

  // Carica i dati della serie da modificare
  useEffect(() => {
    if (serieToEdit && serieConfigurate) {
      const serie = serieConfigurate.find(s => s.id === serieToEdit);
      if (serie) {
        const defaultProfili = Object.fromEntries(
          getProfiliUnici().map(profilo => [
            profilo,
            serie.profili[profilo] || {
              prezzoMetro: 0,
              lunghezzaBarra: 0,
              percentualeSfrido: 5,
              minimoRiutilizzabile: 0.5,
            }
          ])
        );

        form.reset({
          nome: serie.nome,
          tipologie: serie.tipologie,
          profili: defaultProfili,
        });
      }
    }
  }, [serieToEdit, serieConfigurate, form]);

  const onSubmit = (data: FormValues) => {
    saveSerieMutation.mutate(data);
  };

  const handleEdit = (id: string) => {
    setSerieToEdit(id);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Sei sicuro di voler eliminare questa serie?')) {
      deleteSerieMutation.mutate(id);
    }
  };

  const tipologieSelezionate = form.watch("tipologie");
  
  // Ottiene tutti i profili unici per le tipologie selezionate
  const getProfiliUnici = () => {
    const profili = new Set<string>();
    tipologieSelezionate.forEach(tipologia => {
      const profiliTipologia = profiliPerTipologia[tipologia as keyof typeof profiliPerTipologia] || [];
      profiliTipologia.forEach(profilo => profili.add(profilo));
    });
    return Array.from(profili);
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
            <ChevronLeftIcon className="w-5 h-5 transition-transform duration-300 group-hover:-translate-x-1" />
            <span className="font-medium">Home</span>
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
            <span className="p-2 bg-indigo-500/10 rounded-xl">
              <WrenchScrewdriverIcon className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-400" />
            </span>
            Configura Serie e Tipologie
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sezione sinistra: tabella serie configurate */}
          <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl shadow-lg border border-slate-700/50 p-4 sm:p-6 transition-all duration-300 hover:shadow-xl hover:bg-slate-800/50">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-6">
              Serie Configurate
              <span className="text-sm font-normal text-slate-400">({serieConfigurate?.length || 0})</span>
            </h2>
            
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="min-w-full inline-block align-middle">
                <div className="overflow-hidden">
                  <table className="min-w-full divide-y divide-slate-700/50">
                    <thead>
                      <tr>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Nome Serie</th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Tipologie</th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Azioni</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {isLoading ? (
                        <tr>
                          <td colSpan={3} className="px-4 sm:px-6 py-4 text-center text-slate-400">Caricamento...</td>
                        </tr>
                      ) : serieConfigurate?.map((serie) => (
                        <tr key={serie.id} className="hover:bg-slate-700/30 transition-colors duration-200">
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-slate-200">{serie.nome}</td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-slate-200">
                            {serie.tipologie.map(t => (
                              tipologieDisponibili.find(td => td.id === t)?.label || t
                            )).join(", ")}
                          </td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEdit(serie.id)}
                                className="text-indigo-400 hover:text-indigo-300 p-1.5 rounded-lg hover:bg-indigo-500/20 transition-all duration-200"
                              >
                                <PencilIcon className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => handleDelete(serie.id)}
                                className="text-rose-400 hover:text-rose-300 p-1.5 rounded-lg hover:bg-rose-500/20 transition-all duration-200"
                              >
                                <TrashIcon className="h-5 w-5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Sezione destra: form configurazione */}
          <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl shadow-lg border border-slate-700/50 p-4 sm:p-6 transition-all duration-300 hover:shadow-xl hover:bg-slate-800/50">
            <h2 className="text-xl font-semibold text-white mb-6">Configura Serie</h2>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-200">Nome Serie</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Inserisci il nome della serie" 
                          {...field}
                          className="bg-slate-800/80 border-slate-700 text-slate-200 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-indigo-500"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <FormLabel className="text-slate-200">Tipologie</FormLabel>
                  <div className="grid grid-cols-2 gap-4">
                    {tipologieDisponibili.map((tipologia) => (
                      <FormField
                        key={tipologia.id}
                        control={form.control}
                        name="tipologie"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(tipologia.id)}
                                onCheckedChange={(checked) => {
                                  const value = field.value || [];
                                  if (checked) {
                                    field.onChange([...value, tipologia.id]);
                                  } else {
                                    field.onChange(value.filter((v) => v !== tipologia.id));
                                  }
                                }}
                                className="border-slate-700 data-[state=checked]:bg-indigo-500 data-[state=checked]:border-indigo-500"
                              />
                            </FormControl>
                            <FormLabel className="font-normal text-slate-200">
                              {tipologia.label}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                </div>

                {tipologieSelezionate.length > 0 && (
                  <div className="space-y-4">
                    <FormLabel className="text-slate-200">Configurazione Profili</FormLabel>
                    <div className="grid gap-4">
                      {getProfiliUnici().map((profilo) => (
                        <div key={profilo} className="p-4 border border-slate-700/50 rounded-xl bg-slate-800/50">
                          <h4 className="font-medium text-slate-200 mb-3">{profilo}</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name={`profili.${profilo}.prezzoMetro`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-slate-300">Prezzo al Metro (€)</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      placeholder="0.00"
                                      {...field}
                                      value={field.value || 0}
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                      className="bg-slate-800/80 border-slate-700 text-slate-200 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-indigo-500"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`profili.${profilo}.lunghezzaBarra`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-slate-300">Lunghezza Barra (m)</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.1"
                                      min="0"
                                      placeholder="0.0"
                                      {...field}
                                      value={field.value || 0}
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                      className="bg-slate-800/80 border-slate-700 text-slate-200 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-indigo-500"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`profili.${profilo}.percentualeSfrido`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-slate-300">Percentuale Sfrido (%)</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.1"
                                      min="0"
                                      placeholder="5.0"
                                      {...field}
                                      value={field.value || 5}
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                      className="bg-slate-800/80 border-slate-700 text-slate-200 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-indigo-500"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`profili.${profilo}.minimoRiutilizzabile`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-slate-300">Minimo Riutilizzabile (m)</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.1"
                                      min="0"
                                      placeholder="0.5"
                                      {...field}
                                      value={field.value || 0.5}
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                      className="bg-slate-800/80 border-slate-700 text-slate-200 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-indigo-500"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-4 pt-6">
                  <button
                    type="button"
                    onClick={() => form.reset()}
                    className="px-6 py-3 border-2 border-slate-600 rounded-xl text-white hover:bg-slate-700/50 transition-all duration-200 font-medium"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition-all duration-200 shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/30 font-medium"
                  >
                    Salva Configurazione
                  </button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfigurePage;