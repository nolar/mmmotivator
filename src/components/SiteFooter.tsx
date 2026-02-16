import { Link } from "react-router-dom";

export default function SiteFooter() {
  return (
    <footer className="py-4 text-center text-sm text-gray-500 print:hidden">
      <Link to="/impressum" className="hover:underline">
        Impressum
      </Link>
      <span className="mx-2">·</span>
      <Link to="/datenschutz" className="hover:underline">
        Datenschutz
      </Link>
    </footer>
  );
}
