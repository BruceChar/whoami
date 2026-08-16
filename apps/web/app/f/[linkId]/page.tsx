/** Public feedback form served at /f/[linkId] — standalone, no app chrome, no owner data. */
import Link from "next/link";
import { linkStatus } from "@delphi/core";
import FeedbackForm from "@/components/FeedbackForm";
import Logo from "@/components/Logo";
import { findProfileForShareLink } from "@/lib/links";

export const dynamic = "force-dynamic";

export default async function FeedbackPage({ params }: { params: { linkId: string } }) {
  const owner = findProfileForShareLink(params.linkId);
  const profile = owner?.store.get();
  const link = profile?.frameworkData.feedback.shareLinks.find((l) => l.id === params.linkId) || null;
  const status = link && profile ? linkStatus(profile, link) : null;

  const invalid = !link || status === "expired" || status === "closed";
  const displayName = owner?.user.nickname || owner?.user.username || "someone";
  const loginHref = `/login?invitedBy=${encodeURIComponent(owner?.user.username || "")}`;

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-xl flex-col justify-center px-6 py-10">
        {/* header: logo + app name + invitation */}
        <div className="mb-8 text-center">
          <div className="flex justify-center"><Logo size={52} /></div>
          <p className="mt-2 text-sm font-semibold tracking-wide text-ink-700">delphi</p>
          {!invalid && owner ? (
            <div className="mt-5 space-y-1.5">
              <h1 className="text-xl font-semibold text-ink-900">
                {displayName} invites you to write a piece of feedback about {owner.user.nickname ? "him" : "them"}.
              </h1>
              <p className="text-sm leading-relaxed text-ink-400">
                Your honest words matter — they are taken seriously, and they help {displayName} see himself more clearly.
              </p>
            </div>
          ) : (
            <h1 className="mt-5 text-xl font-semibold text-ink-900">This feedback link is no longer available</h1>
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
            <FeedbackForm linkId={params.linkId} ownerName={displayName} />
          </div>
        )}

        {/* prominent CTA to the main app */}
        <div className="mt-8 text-center">
          <Link
            href={loginHref}
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
