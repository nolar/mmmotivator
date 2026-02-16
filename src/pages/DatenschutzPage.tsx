import { Link } from "react-router-dom";
import SiteFooter from "../components/SiteFooter";

export default function DatenschutzPage() {
  return (
    <div className="min-h-screen bg-white p-8 flex flex-col items-center">
      <article className="max-w-2xl w-full">
        <p className="mb-4">
          <Link to="/" className="text-blue-600 hover:underline">
            &larr; Back
          </Link>
        </p>
        <h1 className="text-2xl font-bold mb-6">Datenschutz</h1>
        <p className="text-gray-500">Datenschutz content coming soon.</p>
      </article>
      <SiteFooter />
    </div>
  );
}
