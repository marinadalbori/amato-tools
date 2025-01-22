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
          <div className="inline-block">
            <div className="relative">
              <div className="bg-slate-800/80 rounded-xl p-6 border border-slate-700/50 shadow-2xl relative">
                {/* Effetto glow */}
                <div className="absolute inset-0 rounded-xl bg-indigo-500/20 blur-xl"></div>
                
                {/* Logo contenuto */}
                <div className="relative flex items-baseline justify-center">
                  <span className="text-6xl sm:text-7xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-indigo-600">M</span>
                  <span className="text-6xl sm:text-7xl font-black text-white">P</span>
                  <span className="ml-2 text-3xl sm:text-4xl font-bold text-white">PRO</span>
                </div>
                
                {/* Linea decorativa sotto */}
                <div className="mt-2 flex justify-center gap-2">
                  <div className="h-1.5 w-12 bg-slate-400 rounded"></div>
                  <div className="h-1.5 w-12 bg-indigo-400 rounded"></div>
                  <div className="h-1.5 w-12 bg-purple-400 rounded"></div>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <span className="text-lg font-medium tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-slate-300 via-indigo-400 to-purple-400">
                mariopaoloPRO
              </span>
            </div>
          </div>
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="group relative bg-slate-800/40 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:bg-slate-800/60 text-left"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform duration-300">
                  <item.icon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-white group-hover:text-indigo-400 transition-colors truncate">
                    {item.title}
                  </h2>
                  <p className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors line-clamp-2">
                    {item.description}
                  </p>
                </div>
                <div className="self-center w-6 h-6 rounded-full bg-indigo-500/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-indigo-400"
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