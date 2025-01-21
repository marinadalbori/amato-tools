import { useNavigate } from "react-router-dom";
import {
  WindowIcon,
  WrenchScrewdriverIcon,
  TableCellsIcon,
} from "@heroicons/react/24/outline";

const Index = () => {
  const navigate = useNavigate();

  const menuItems = [
    {
      title: "Tipologie di Serramento",
      description: "Gestisci le tipologie di serramento e i profili associati",
      icon: WindowIcon,
      path: "/frametypes",
      color: "indigo"
    },
    {
      title: "Configura Serie e Tipologie",
      description: "Configura e personalizza le serie e le tipologie disponibili",
      icon: WrenchScrewdriverIcon,
      path: "/configure",
      color: "indigo"
    },
    {
      title: "Genera Griglia Prezzi",
      description: "Genera e gestisci le griglie dei prezzi per i serramenti",
      icon: TableCellsIcon,
      path: "/grid",
      color: "indigo"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-4 sm:py-8 text-slate-200">
      <div className="container mx-auto px-3 sm:px-4 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl sm:text-6xl font-black text-white mb-4 tracking-tight">
            <span className="text-indigo-400">M</span>P PRO
          </h1>
          <p className="text-xl text-slate-400 font-medium tracking-wide">
            <span className="text-indigo-400">M</span>ARIO<span className="text-indigo-400">P</span>AOLO PRO
          </p>
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="group relative bg-slate-800/40 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:bg-slate-800/60 text-left h-full"
            >
              <div className="flex flex-col items-start gap-4">
                <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform duration-300">
                  <item.icon className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white mb-2 group-hover:text-indigo-400 transition-colors">
                    {item.title}
                  </h2>
                  <p className="text-slate-400 group-hover:text-slate-300 transition-colors">
                    {item.description}
                  </p>
                </div>
                <div className="absolute bottom-6 right-6 w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transform translate-x-4 group-hover:translate-x-0 transition-all duration-300">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-indigo-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-slate-400 text-sm">
            © {new Date().getFullYear()} MP PRO. Tutti i diritti riservati.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;