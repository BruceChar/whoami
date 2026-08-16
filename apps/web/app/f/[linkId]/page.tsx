/** Public feedback form served at /f/[linkId]. */
import { getStore } from "@/lib/server";
import { linkStatus } from "@delphi/core";
import FeedbackForm from "@/components/FeedbackForm";

export const dynamic = "force-dynamic";

export default async function FeedbackPage({ params }: { params: { linkId: string } }) {
  const profile = getStore().get();
  const link = profile.frameworkData.feedback.shareLinks.find((l) => l.id === params.linkId);
  const status = link ? linkStatus(profile, link) : null;

  if (!link || status === "expired" || status === "closed") {
    return (
      <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="text-3xl">🪞</p>
        <h1 className="mt-3 text-xl font-semibold text-ink-900">这个反馈链接已失效</h1>
        <p className="mt-2 text-sm text-ink-400">
          {status === "expired" ? "链接已过期。" : status === "closed" ? "链接已关闭（填写人数已达上限）。" : "链接不存在。"}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <div className="mb-6 text-center">
        <p className="text-3xl">🪞</p>
        <h1 className="mt-2 text-xl font-semibold text-ink-900">给 ta 写一段反馈</h1>
        <p className="mt-1 text-sm text-ink-400">
          ta 邀请你帮忙更真实地认识自己。你的反馈会被认真对待。
        </p>
      </div>
      <div className="mirror-card">
        <FeedbackForm linkId={params.linkId} />
      </div>
    </div>
  );
}
