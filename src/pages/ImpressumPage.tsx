import { Link } from "react-router-dom";
import SiteFooter from "../components/SiteFooter";

export default function ImpressumPage() {
  return (
    <div className="min-h-screen bg-white p-8 flex flex-col items-center">
      <article className="max-w-2xl w-full prose prose-gray">
        <p className="mb-4">
          <Link to="/" className="text-blue-600 hover:underline">
            &larr; Back
          </Link>
        </p>
        <h1 className="text-2xl font-bold mb-6">Impressum / Legal Notice</h1>

        <h2 className="text-lg font-semibold mt-6 mb-2">
          Information according to § 5 DDG and § 18 MStV:
        </h2>

        <p className="font-semibold mt-4">Responsible person:</p>
        <p>
          Sergey Vasilyev<br />
          c/o Impressumservice Dein-Impressum<br />
          Stettiner Straße 41<br />
          35410 Hungen
        </p>
        <p className="italic text-sm text-gray-500">
          <i>Please do not send any packages to this address.</i>
        </p>

        <p className="mt-4">
          E-mail:{" "}
          <a
            href="mailto:nolar@nolar.info"
            className="text-blue-600 hover:underline"
          >
            nolar@nolar.info
          </a>
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">
          Consumer dispute resolution / Universal arbitration body
        </h2>
        <p>
          We are neither willing nor obligated to participate in dispute
          resolution proceedings before a consumer arbitration board.
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">
          Liability for content
        </h2>
        <p>
          As a service provider, we are responsible for our own content on these
          pages in accordance with Section 7 Paragraph 1 of the German Data
          Protection Act (DDG). However, according to Sections 8 to 10 of the
          DDG, we are not obligated as a service provider to monitor transmitted
          or stored third-party information or to investigate circumstances that
          indicate illegal activity.
        </p>
        <p className="mt-2">
          Obligations to remove or block the use of information under general law
          remain unaffected. However, liability in this respect is only possible
          from the point at which we become aware of a specific legal
          infringement. Upon becoming aware of such legal infringements, we will
          remove this content immediately.
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">Copyright</h2>
        <p>
          The content and works created by the site operators on these pages are
          subject to German copyright law. Reproduction, processing,
          distribution, and any form of exploitation beyond the limits of
          copyright law require the written consent of the respective author or
          creator.
        </p>
        <p className="mt-2">
          Downloads and copies of this page are permitted only for private,
          non-commercial use. Insofar as the content on this page was not created
          by the operator, the copyrights of third parties are respected. In
          particular, third-party content is identified as such. Should you
          nevertheless become aware of a copyright infringement, please notify us
          accordingly. Upon notification of legal violations, we will remove such
          content immediately.
        </p>
      </article>
      <SiteFooter />
    </div>
  );
}
