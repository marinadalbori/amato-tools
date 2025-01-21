import { Link } from "react-router-dom";

interface NavigationButtonProps {
  to: string;
  children: React.ReactNode;
}

const NavigationButton = ({ to, children }: NavigationButtonProps) => {
  return (
    <Link
      to={to}
      className="w-full sm:w-96 p-6 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-gray-100 group"
    >
      <div className="text-xl font-semibold text-amato-primary group-hover:text-amato-secondary transition-colors">
        {children}
      </div>
    </Link>
  );
};

export default NavigationButton;