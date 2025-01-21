import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

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

// Schema di validazione del form
const formSchema = z.object({
  nome: z.string().min(1, "Il nome è obbligatorio"),
  tipologie: z.array(z.string()).min(1, "Seleziona almeno una tipologia"),
  profili: z.record(z.object({
    prezzoMetro: z.number().min(0, "Il prezzo deve essere maggiore o uguale a 0"),
    lunghezzaBarra: z.number().min(0, "La lunghezza deve essere maggiore o uguale a 0"),
  })),
});

type FormValues = z.infer<typeof formSchema>;

const ConfigurePage = () => {
  const [serieConfigurate, setSerieConfigurate] = useState<Array<{
    id: string;
    nome: string;
    tipologie: string[];
  }>>([
    { id: "1", nome: "Serie S100", tipologie: ["battente1", "battente2"] },
    { id: "2", nome: "Serie S200", tipologie: ["scorrevoleLinea", "fisso"] },
  ]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      tipologie: [],
      profili: {},
    },
  });

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

  const onSubmit = (data: FormValues) => {
    console.log("Form submitted:", data);
    // Qui implementeremo il salvataggio dei dati
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] p-8">
      <h1 className="text-3xl font-bold text-[hsl(var(--foreground))] mb-8">
        Configura Serie e Tipologie
      </h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sezione sinistra: tabella serie configurate */}
        <div className="bg-card rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Serie Configurate</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome Serie</TableHead>
                <TableHead>Tipologie</TableHead>
                <TableHead className="w-24">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {serieConfigurate.map((serie) => (
                <TableRow key={serie.id}>
                  <TableCell>{serie.nome}</TableCell>
                  <TableCell>{serie.tipologie.length}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => console.log("Modifica serie:", serie.id)}
                    >
                      Modifica
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Sezione destra: form configurazione */}
        <div className="bg-card rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Configura Serie</h2>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Serie</FormLabel>
                    <FormControl>
                      <Input placeholder="Inserisci il nome della serie" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <FormLabel>Tipologie</FormLabel>
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
                            />
                          </FormControl>
                          <FormLabel className="font-normal">
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
                  <FormLabel>Configurazione Profili</FormLabel>
                  <div className="grid gap-4">
                    {getProfiliUnici().map((profilo) => (
                      <div key={profilo} className="p-4 border rounded-lg">
                        <h4 className="font-medium mb-3">{profilo}</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name={`profili.${profilo}.prezzoMetro`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Prezzo al Metro (€)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    {...field}
                                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
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
                                <FormLabel>Lunghezza Barra (m)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    placeholder="0.0"
                                    {...field}
                                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
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

              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => form.reset()}
                >
                  Annulla
                </Button>
                <Button type="submit">
                  Salva Configurazione
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
};

export default ConfigurePage;