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
import { ChevronLeftIcon, WrenchScrewdriverIcon, PencilIcon, TrashIcon, PlusIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type Tables = Database['public']['Tables'];
type FrameType = Tables['frame_types']['Row'];
type Series = Tables['series']['Row'];
type SeriesFrameType = Tables['series_frame_types']['Row'];
type Profile = Tables['profiles']['Row'];

interface ProfileConfig {
  prezzoMetro: number;
  lunghezzaBarra: number;
  percentualeSfrido: number;
  minimoRiutilizzabile: number;
}

// Schema di validazione del form
const formSchema = z.object({
  name: z.string().min(1, "Il nome è obbligatorio"),
  frameTypeIds: z.array(z.string()).min(1, "Seleziona almeno una tipologia"),
  profiles: z.record(z.object({
    prezzoMetro: z.number().min(0, "Il prezzo deve essere maggiore o uguale a 0"),
    lunghezzaBarra: z.number().min(0, "La lunghezza deve essere maggiore o uguale a 0"),
    percentualeSfrido: z.number().min(0, "La percentuale di sfrido deve essere maggiore o uguale a 0"),
    minimoRiutilizzabile: z.number().min(0, "Il minimo riutilizzabile deve essere maggiore o uguale a 0"),
  })),
});

type FormValues = z.infer<typeof formSchema>;

interface SerieConfigurataExtended extends Series {
  frameTypes: FrameType[];
  profiles: Record<string, ProfileConfig>;
}

type ProfileRuleResponse = {
  profiles: Profile;
}

type FrameTypeJoin = {
  frame_types: {
    id: string;
    label: string;
    created_at: string;
    updated_at: string;
  };
};

type SeriesFrameTypeJoin = {
  frame_type_id: string;
  frame_types: {
    id: string;
    label: string;
    created_at: string;
    updated_at: string;
  };
};

const ConfigurePage = () => {
  const [serieToEdit, setSerieToEdit] = useState<string | null>(null);
  const [selectedProfiles, setSelectedProfiles] = useState<Profile[]>([]);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      frameTypeIds: [],
      profiles: {},
    },
  });

  // Query per caricare i profili necessari per le tipologie selezionate
  const { data: profilesForTypes, isLoading: isLoadingProfiles } = useQuery({
    queryKey: ['profiles', form?.watch('frameTypeIds')],
    queryFn: async () => {
      const selectedTypes = form?.watch('frameTypeIds') || [];
      if (selectedTypes.length === 0) return [];

      // Prima recuperiamo tutti i profile_id necessari
      const { data: rules, error: rulesError } = await supabase
        .from('frame_type_profile_rules')
        .select('profile_id')
        .in('frame_type_id', selectedTypes);

      if (rulesError) throw rulesError;

      // Poi recuperiamo i profili completi
      const profileIds = [...new Set(rules.map(r => r.profile_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', profileIds);

      if (profilesError) throw profilesError;

      // Prepopola i valori di default per ogni profilo
      const currentProfiles = form.getValues('profiles');
      profiles.forEach(profile => {
        if (!currentProfiles[profile.id]) {
          form.setValue(`profiles.${profile.id}`, {
            prezzoMetro: 0,
            lunghezzaBarra: 6,
            percentualeSfrido: 5,
            minimoRiutilizzabile: 0.5,
          });
        }
      });

      setSelectedProfiles(profiles);
      return profiles;
    },
    enabled: form?.watch('frameTypeIds')?.length > 0,
  });

  // Query per caricare le tipologie di telaio che hanno regole di profilo associate
  const { data: frameTypes, isLoading: isLoadingFrameTypes } = useQuery({
    queryKey: ['frameTypes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('frame_type_profile_rules')
        .select(`
          frame_types!inner (
            id,
            label,
            created_at,
            updated_at
          )
        `)
        .order('frame_type_id');

      if (error) throw error;

      const typedData = data as unknown as FrameTypeJoin[];
      
      // Rimuovo i duplicati
      return Array.from(
        new Map(
          typedData
            .map(item => item.frame_types)
            .filter(Boolean)
            .map(ft => [ft.id, ft])
        ).values()
      );
    },
  });

  // Query per caricare le serie
  const { data: serieConfigurate, isLoading: isLoadingSeries } = useQuery({
    queryKey: ['series'],
    queryFn: async () => {
      const { data: series, error: seriesError } = await supabase
        .from('series')
        .select('*')
        .order('name');

      if (seriesError) throw seriesError;
      if (!series) return [];

      const seriesWithTypesAndProfiles = await Promise.all(
        series.map(async (serie) => {
          // Recupera tipologie
          const { data: frameTypes, error: frameTypesError } = await supabase
            .from('series_frame_types')
            .select(`
              frame_type_id,
              frame_types!inner (
                id,
                label,
                created_at,
                updated_at
              )
            `)
            .eq('series_id', serie.id);

          if (frameTypesError) {
            console.error(`Errore nel recupero delle tipologie per serie ${serie.name}:`, frameTypesError);
            return {
              ...serie,
              frameTypes: [],
              profiles: {},
            };
          }

          const typedFrameTypes = frameTypes as unknown as SeriesFrameTypeJoin[] || [];

          // Recupera profili
          const { data: profiles, error: profilesError } = await supabase
            .from('series_profiles')
            .select('*')
            .eq('series_id', serie.id);

          if (profilesError) {
            console.error(`Errore nel recupero dei profili per serie ${serie.name}:`, profilesError);
            return {
              ...serie,
              frameTypes: typedFrameTypes.map(ft => ft.frame_types),
              profiles: {},
            };
          }

          const profileConfigs = (profiles || []).reduce<Record<string, ProfileConfig>>((acc, profile) => ({
            ...acc,
            [profile.profile_id]: {
              prezzoMetro: profile.cost_per_meter,
              lunghezzaBarra: profile.bar_length,
              percentualeSfrido: profile.scrap_percentage,
              minimoRiutilizzabile: profile.min_reusable_length,
            },
          }), {});

          return {
            ...serie,
            frameTypes: typedFrameTypes.map(ft => ft.frame_types),
            profiles: profileConfigs,
          };
        })
      );

      return seriesWithTypesAndProfiles;
    },
  });

  // Mutation per verificare se esiste già una serie con lo stesso nome
  const checkSeriesNameMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('series')
        .select('id')
        .eq('name', name)
        .maybeSingle();

      if (error) throw error;
      if (data && data.id !== serieToEdit) {
        throw new Error('Esiste già una serie con questo nome');
      }
    },
  });

  // Mutation per salvare una serie
  const saveSerieMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      // Prima verifica se il nome è già in uso
      await checkSeriesNameMutation.mutateAsync(data.name);

      if (serieToEdit) {
        // Aggiornamento serie esistente
        const { error: updateError } = await supabase
          .from('series')
          .update({ name: data.name })
          .eq('id', serieToEdit);

        if (updateError) throw updateError;

        // Elimina associazioni esistenti
        const { error: deleteTypesError } = await supabase
          .from('series_frame_types')
          .delete()
          .eq('series_id', serieToEdit);

        if (deleteTypesError) throw deleteTypesError;

        // Inserisce nuove associazioni
        const { error: insertTypesError } = await supabase
          .from('series_frame_types')
          .insert(
            data.frameTypeIds.map(frameTypeId => ({
              series_id: serieToEdit,
              frame_type_id: frameTypeId,
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
        const { error: insertProfilesError } = await supabase
          .from('series_profiles')
          .insert(
            Object.entries(data.profiles).map(([profileId, config]) => ({
              series_id: serieToEdit,
              profile_id: profileId,
              cost_per_meter: config.prezzoMetro,
              bar_length: config.lunghezzaBarra,
              scrap_percentage: config.percentualeSfrido,
              min_reusable_length: config.minimoRiutilizzabile,
            }))
          );

        if (insertProfilesError) throw insertProfilesError;
      } else {
        // Inserimento nuova serie
        const { data: newSeries, error: insertSeriesError } = await supabase
          .from('series')
          .insert({ name: data.name })
          .select()
          .single();

        if (insertSeriesError) throw insertSeriesError;

        // Inserisce associazioni tipologie
        const { error: insertTypesError } = await supabase
          .from('series_frame_types')
          .insert(
            data.frameTypeIds.map(frameTypeId => ({
              series_id: newSeries.id,
              frame_type_id: frameTypeId,
            }))
          );

        if (insertTypesError) throw insertTypesError;

        // Inserisce profili
        const { error: insertProfilesError } = await supabase
          .from('series_profiles')
          .insert(
            Object.entries(data.profiles).map(([profileId, config]) => ({
              series_id: newSeries.id,
              profile_id: profileId,
              cost_per_meter: config.prezzoMetro,
              bar_length: config.lunghezzaBarra,
              scrap_percentage: config.percentualeSfrido,
              min_reusable_length: config.minimoRiutilizzabile,
            }))
          );

        if (insertProfilesError) throw insertProfilesError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series'] });
      toast.success(serieToEdit ? 'Serie aggiornata con successo' : 'Serie creata con successo');
      form.reset();
      setSerieToEdit(null);
    },
    onError: (error: Error) => {
      toast.error('Si è verificato un errore: ' + error.message);
    },
  });

  // Mutation per eliminare una serie
  const deleteSerieMutation = useMutation({
    mutationFn: async (id: string) => {
      // Le associazioni verranno eliminate automaticamente grazie alla foreign key constraint
      const { error } = await supabase
        .from('series')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series'] });
      toast.success('Serie eliminata con successo');
    },
    onError: (error: Error) => {
      toast.error('Si è verificato un errore durante l\'eliminazione: ' + error.message);
    },
  });

  // Carica i dati della serie da modificare
  useEffect(() => {
    if (serieToEdit && serieConfigurate) {
      const serie = serieConfigurate.find(s => s.id === serieToEdit);
      if (serie) {
        form.reset({
          name: serie.name,
          frameTypeIds: serie.frameTypes.map(ft => ft.id),
          profiles: serie.profiles,
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

  const isLoading = isLoadingFrameTypes || isLoadingSeries;

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

        {/* Tabella serie configurate */}
        <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl shadow-lg border border-slate-700/50 p-4 sm:p-6 transition-all duration-300 hover:shadow-xl hover:bg-slate-800/50 mb-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              Serie Configurate
              <span className="text-sm font-normal text-slate-400">({serieConfigurate?.length || 0})</span>
            </h2>
          </div>
          
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="min-w-full inline-block align-middle">
              <div className="overflow-hidden">
                <table className="min-w-full divide-y divide-slate-700/50">
                  <thead>
                    <tr>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Nome Serie</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Tipologie Associate</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {isLoading ? (
                      <tr>
                        <td colSpan={3} className="px-4 sm:px-6 py-4 text-center text-slate-400">Caricamento...</td>
                      </tr>
                    ) : serieConfigurate?.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 sm:px-6 py-8 text-center text-slate-400">
                          <div className="flex flex-col items-center gap-2">
                            <InformationCircleIcon className="w-6 h-6" />
                            <p>Nessuna serie configurata</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      serieConfigurate?.map((serie) => (
                        <tr key={serie.id} className="hover:bg-slate-700/30 transition-colors duration-200">
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-slate-200">{serie.name}</td>
                          <td className="px-4 sm:px-6 py-4 text-slate-200">
                            {serie.frameTypes.map(ft => ft.label).join(", ")}
                            <span className="text-slate-400 text-sm ml-2">
                              ({serie.frameTypes.length})
                            </span>
                          </td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEdit(serie.id)}
                                className="text-indigo-400 hover:text-indigo-300 p-1.5 rounded-lg hover:bg-indigo-500/20 transition-all duration-200"
                                title="Modifica serie"
                              >
                                <PencilIcon className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => handleDelete(serie.id)}
                                className="text-rose-400 hover:text-rose-300 p-1.5 rounded-lg hover:bg-rose-500/20 transition-all duration-200"
                                title="Elimina serie"
                              >
                                <TrashIcon className="h-5 w-5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Form configurazione */}
        <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl shadow-lg border border-slate-700/50 p-4 sm:p-6 transition-all duration-300 hover:shadow-xl hover:bg-slate-800/50">
          <h2 className="text-xl font-semibold text-white mb-6">
            {serieToEdit ? 'Modifica Serie' : 'Nuova Serie'}
          </h2>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
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
                  {frameTypes?.map((frameType) => (
                    <FormField
                      key={frameType.id}
                      control={form.control}
                      name="frameTypeIds"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(frameType.id)}
                              onCheckedChange={(checked) => {
                                const value = field.value || [];
                                if (checked) {
                                  field.onChange([...value, frameType.id]);
                                } else {
                                  field.onChange(value.filter((v) => v !== frameType.id));
                                }
                              }}
                              className="border-slate-700 data-[state=checked]:bg-indigo-500 data-[state=checked]:border-indigo-500"
                            />
                          </FormControl>
                          <FormLabel className="font-normal text-slate-200">
                            {frameType.label}
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
              </div>

              {/* Configurazione Profili */}
              {selectedProfiles && selectedProfiles.length > 0 && form.watch('frameTypeIds').length > 0 && (
                <div className="space-y-6">
                  <FormLabel className="text-slate-200">Configurazione Profili</FormLabel>
                  <Accordion type="single" collapsible className="space-y-4">
                    {selectedProfiles.map((profile) => (
                      <AccordionItem 
                        key={profile.id} 
                        value={profile.id}
                        className="border border-slate-700/50 rounded-xl bg-slate-800/50 px-4"
                      >
                        <AccordionTrigger className="py-4 text-slate-200 hover:text-slate-100 hover:no-underline">
                          {profile.name}
                        </AccordionTrigger>
                        <AccordionContent className="pb-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name={`profiles.${profile.id}.prezzoMetro`}
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
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                      className="bg-slate-800/80 border-slate-700 text-slate-200 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-indigo-500"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`profiles.${profile.id}.lunghezzaBarra`}
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
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                      className="bg-slate-800/80 border-slate-700 text-slate-200 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-indigo-500"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`profiles.${profile.id}.percentualeSfrido`}
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
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                      className="bg-slate-800/80 border-slate-700 text-slate-200 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-indigo-500"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`profiles.${profile.id}.minimoRiutilizzabile`}
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
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                      className="bg-slate-800/80 border-slate-700 text-slate-200 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-indigo-500"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              )}

              <div className="flex justify-end gap-4 pt-6">
                <button
                  type="button"
                  onClick={() => {
                    form.reset();
                    setSerieToEdit(null);
                  }}
                  className="px-6 py-3 border-2 border-slate-600 rounded-xl text-white hover:bg-slate-700/50 transition-all duration-200 font-medium"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition-all duration-200 shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/30 font-medium"
                >
                  {serieToEdit ? 'Aggiorna Serie' : 'Crea Serie'}
                </button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
};

export default ConfigurePage;