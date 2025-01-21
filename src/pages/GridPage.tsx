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
import { Download, FileDown, ChevronLeft, Table as TableIcon } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();
  
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
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-slate-800/80 border-slate-700 text-slate-200 focus:ring-2 focus:ring-indigo-500">
                            <SelectValue placeholder="Seleziona una serie" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          {serieConfigurate.map((serie) => (
                            <SelectItem 
                              key={serie.id} 
                              value={serie.id}
                              className="text-slate-200 focus:bg-indigo-500/20 focus:text-white"
                            >
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
                      <FormLabel className="text-slate-200">Tipologia</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-slate-800/80 border-slate-700 text-slate-200 focus:ring-2 focus:ring-indigo-500">
                            <SelectValue placeholder="Seleziona una tipologia" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          {form.watch("serie") &&
                            serieConfigurate
                              .find((s) => s.id === form.watch("serie"))
                              ?.tipologie.map((tipologia) => (
                                <SelectItem 
                                  key={tipologia} 
                                  value={tipologia}
                                  className="text-slate-200 focus:bg-indigo-500/20 focus:text-white"
                                >
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

        {/* Tabella dei risultati */}
        {results.length > 0 && (
          <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl shadow-lg border border-slate-700/50 p-4 sm:p-6 transition-all duration-300 hover:shadow-xl hover:bg-slate-800/50">
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="min-w-full inline-block align-middle">
                <div className="overflow-hidden">
                  <table className="min-w-full divide-y divide-slate-700/50">
                    <thead>
                      <tr>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Altezza (cm)</th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Larghezza (cm)</th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Prezzo Totale (€)</th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Dettaglio Profili</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {results.map((result, index) => (
                        <tr key={index} className="hover:bg-slate-700/30 transition-colors duration-200">
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-slate-200">{result.altezza}</td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-slate-200">{result.larghezza}</td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-slate-200">
                            {result.prezzoTotale.toFixed(2)}
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-slate-200">
                            {result.dettaglioProfili?.map((profilo, idx) => (
                              <div key={idx} className="text-sm">
                                {profilo.nome}: {profilo.lunghezza}m - €{profilo.prezzo.toFixed(2)}
                              </div>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-4 mt-6">
              <button
                onClick={handleExportCSV}
                className="px-6 py-3 border-2 border-slate-600 rounded-xl text-white hover:bg-slate-700/50 transition-all duration-200 font-medium flex items-center gap-2"
              >
                <FileDown className="w-5 h-5" />
                Esporta CSV
              </button>
              <button
                onClick={handleExportPDF}
                className="px-6 py-3 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition-all duration-200 shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/30 font-medium flex items-center gap-2"
              >
                <Download className="w-5 h-5" />
                Scarica PDF
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GridPage;