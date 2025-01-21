import NavigationButton from "../components/NavigationButton";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-amato-background">
      <div className="container mx-auto px-4 py-16">
        <header className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-amato-primary mb-4">
            Amato Tools
          </h1>
          <p className="text-gray-600">
            Seleziona una funzionalità per iniziare
          </p>
        </header>

        <div className="flex flex-col items-center gap-8">
          <NavigationButton to="/configure">
            Configura Serie e Tipologie
          </NavigationButton>
          <NavigationButton to="/grid">
            Genera Griglia Prezzi
          </NavigationButton>
        </div>
      </div>
    </div>
  );
};

export default Index;