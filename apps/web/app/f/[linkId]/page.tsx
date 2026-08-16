/** Public feedback form served at /f/[linkId] — standalone, no app chrome, no owner data. */
import Link from "next/link";
import { linkStatus } from "@delphi/core";
import FeedbackForm from "@/components/FeedbackForm";
import Logo from "@/components/Logo";
import { findProfileForShareLink } from "@/lib/links";

export const dynamic = "force-dynamic";

export default async function FeedbackPage({ params }: { params: { linkId: string } }) {
  const store = findProfileForShareLink(params.linkId);
  const profile = store?.get();
  const link = profile?.frameworkData.feedback.shareLinks.find((l) => l.id === params.linkId) || null;
  const status = link && profile ? linkStatus(profile, link) : null;

  const invalid = !link || status === "expired" || status === "closed";

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-xl flex-col justify-center px-6 py-10">
        <div className="mb-6 text-center">
          <div className="flex justify-center"><Logo size={44} /></div>
          <h1 className="mt-2 text-xl font-semibold text-ink-900">
            {invalid ? "This feedback link is no longer available" : "Write a piece of feedback"}
          </h1>
          {!invalid && (
            <p className="mt-1 text-sm text-ink-400">
              Someone you know invited you to help them see themselves more clearly. Your feedback is taken seriously.
            </p>
          )}
        </div>

        {invalid ? (
          <div className="mirror-card text-center text-sm text-ink-500">
            <p>
              {status === "expired"
                ? "The link has expired."
                : status === "closed"
                  ? "The link has been closed (it reached its response limit)."
                  : "The link does not exist."}
            </p>
          </div>
        ) : (
          <div className="mirror-card">
            <FeedbackForm linkId={params.linkId} />
          </div>
        )}

        {/* prominent CTA to the main app */}
        <div className="mt-8 text-center">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-2xl bg-mirror-500 px-6 py-3 text-sm font-medium text-white shadow-soft transition hover:bg-mirror-600"
          >
            Start your own discovery journey →
          </Link>
          <p className="mt-2 text-[11px] text-ink-300">delphi · Be water my friend.</p>
        </div>
      </div>
    </div>
  );
}
