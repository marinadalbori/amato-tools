import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
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
import { Download, FileDown } from "lucide-react";
import { toast } from "sonner";

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

// Tipo per i risultati della griglia
type GridResult = {
  altezza: number;
  larghezza: number;
  prezzoTotale: number;
  dettaglioProfili?: {
    nome: string;
    lunghezza: number;
    prezzo: number;
  }[];
};

const GridPage = () => {
  const [results, setResults] = useState<GridResult[]>([]);
  
  // Mock data per le serie configurate - da sostituire con dati reali
  const serieConfigurate = [
    { id: "1", nome: "Serie S100", tipologie: ["battente1", "battente2"] },
    { id: "2", nome: "Serie S200", tipologie: ["scorrevoleLinea", "fisso"] },
  ];

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

  const onSubmit = (data: FormValues) => {
    console.log("Form submitted:", data);
    // Mock della generazione risultati - da implementare la logica reale
    const mockResults: GridResult[] = [
      {
        altezza: 100,
        larghezza: 100,
        prezzoTotale: 150.50,
        dettaglioProfili: [
          { nome: "Telaio", lunghezza: 4, prezzo: 50.20 },
          { nome: "Anta", lunghezza: 3.8, prezzo: 100.30 },
        ],
      },
      // Altri risultati...
    ];
    setResults(mockResults);
    toast.success("Griglia generata con successo!");
  };

  const handleExportCSV = () => {
    console.log("Esportazione CSV...");
    toast.success("File CSV esportato con successo!");
  };

  const handleExportPDF = () => {
    console.log("Esportazione PDF...");
    toast.success("File PDF esportato con successo!");
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="text-3xl font-bold text-primary mb-8">
        Genera Griglia Prezzi
      </h1>

      {/* Form di input */}
      <div className="bg-card rounded-lg shadow p-6 mb-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="serie"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Serie</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona una serie" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {serieConfigurate.map((serie) => (
                          <SelectItem key={serie.id} value={serie.id}>
                            {serie.nome}
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
                    <FormLabel>Tipologia</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona una tipologia" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {form.watch("serie") &&
                          serieConfigurate
                            .find((s) => s.id === form.watch("serie"))
                            ?.tipologie.map((tipologia) => (
                              <SelectItem key={tipologia} value={tipologia}>
                                {tipologia}
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
                    <FormLabel>Altezza Minima (cm)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) =>
                          field.onChange(Number(e.target.value))
                        }
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
                    <FormLabel>Altezza Massima (cm)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) =>
                          field.onChange(Number(e.target.value))
                        }
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
                    <FormLabel>Larghezza Minima (cm)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) =>
                          field.onChange(Number(e.target.value))
                        }
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
                    <FormLabel>Larghezza Massima (cm)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) =>
                          field.onChange(Number(e.target.value))
                        }
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
                    <FormLabel>Incremento (cm)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) =>
                          field.onChange(Number(e.target.value))
                        }
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit">Genera Griglia</Button>
            </div>
          </form>
        </Form>
      </div>

      {/* Tabella dei risultati */}
      {results.length > 0 && (
        <div className="bg-card rounded-lg shadow p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Altezza (cm)</TableHead>
                  <TableHead>Larghezza (cm)</TableHead>
                  <TableHead>Prezzo Totale (€)</TableHead>
                  <TableHead>Dettaglio Profili</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result, index) => (
                  <TableRow key={index}>
                    <TableCell>{result.altezza}</TableCell>
                    <TableCell>{result.larghezza}</TableCell>
                    <TableCell>
                      {result.prezzoTotale.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {result.dettaglioProfili?.map((profilo, idx) => (
                        <div key={idx} className="text-sm">
                          {profilo.nome}: {profilo.lunghezza}m - €{profilo.prezzo.toFixed(2)}
                        </div>
                      ))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end gap-4 mt-6">
            <Button
              variant="outline"
              onClick={handleExportCSV}
            >
              <FileDown className="mr-2" />
              Esporta CSV
            </Button>
            <Button
              variant="outline"
              onClick={handleExportPDF}
            >
              <Download className="mr-2" />
              Scarica PDF
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GridPage;