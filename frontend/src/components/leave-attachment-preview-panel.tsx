"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Image as ImageIcon } from "lucide-react";

import { openLeaveAttachment, type LeaveAttachment } from "@/lib/api-leave";
import { cn } from "@/lib/utils";

function formatFileSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Left-column layout for the wider admin/leave-requests detail modal: a
// filename list (only rendered when there's more than one attachment) with
// the selected one's actual preview shown inline underneath it, instead of
// LeaveAttachmentList's popup-on-click pattern (which suits that narrower
// employee-facing modal better). Callers should mount this with
// `key={leaveRequestId}` so switching between leave requests remounts it
// fresh rather than needing an effect to reset selection state.
export function LeaveAttachmentPreviewPanel({
  leaveRequestId,
  attachments,
}: {
  leaveRequestId: string;
  attachments: LeaveAttachment[];
}) {
  const [selected, setSelected] = useState<LeaveAttachment | null>(attachments[0] ?? null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // Starts true when there's a first attachment to auto-load below, so the
  // "กำลังโหลด…" state is correct from the very first render without the
  // mount effect needing to set it itself.
  const [previewLoading, setPreviewLoading] = useState(attachments.length > 0);
  const [previewError, setPreviewError] = useState<string | null>(null);
  // Tracks the most recently requested object URL so a stale response
  // (e.g. clicking a second file before the first's fetch resolves) can't
  // overwrite the newer selection's preview, and so it can be revoked.
  const currentUrlRef = useRef<string | null>(null);

  // Only touches state inside the promise callbacks -- safe to call from
  // the mount effect below, unlike loadPreview (which also synchronously
  // resets selected/previewUrl/previewError/previewLoading, fine from a
  // click handler but not from an effect body).
  const fetchPreview = (attachment: LeaveAttachment) => {
    const requestedId = attachment.id;
    openLeaveAttachment(leaveRequestId, attachment.id)
      .then((url) => {
        if (requestedId !== attachment.id) return;
        if (currentUrlRef.current) URL.revokeObjectURL(currentUrlRef.current);
        currentUrlRef.current = url;
        setPreviewUrl(url);
      })
      .catch((err: Error) => setPreviewError(err.message))
      .finally(() => setPreviewLoading(false));
  };

  // Fired by clicking a different filename in the list below -- event-
  // driven, so synchronous setState here is fine (only the mount effect
  // needs the setState-free fetchPreview above).
  const loadPreview = (attachment: LeaveAttachment) => {
    setSelected(attachment);
    setPreviewUrl(null);
    setPreviewError(null);
    setPreviewLoading(true);
    fetchPreview(attachment);
  };

  // Mount-only: auto-loads the first attachment's preview so the common
  // case (a single supporting document) never needs an extra click.
  useEffect(() => {
    if (attachments[0]) fetchPreview(attachments[0]);
    return () => {
      if (currentUrlRef.current) URL.revokeObjectURL(currentUrlRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (attachments.length === 0) {
    return (
      <div className="flex min-h-64 flex-1 items-center justify-center rounded-xl bg-muted/40">
        <p className="text-sm text-muted-foreground">ไม่มีไฟล์แนบ</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {attachments.length > 1 && (
        <div className="flex flex-col gap-1.5">
          {attachments.map((attachment) => {
            const Icon = attachment.contentType.startsWith("image/") ? ImageIcon : FileText;
            const isSelected = attachment.id === selected?.id;
            return (
              <button
                key={attachment.id}
                type="button"
                onClick={() => loadPreview(attachment)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left",
                  isSelected ? "bg-brand-100" : "bg-muted/40 hover:bg-muted"
                )}
              >
                <Icon className={cn("size-4 shrink-0", isSelected ? "text-brand-600" : "text-muted-foreground")} />
                <p className="min-w-0 flex-1 truncate text-xs text-foreground">
                  {attachment.filename}{" "}
                  <span className="text-muted-foreground">({formatFileSize(attachment.sizeBytes)})</span>
                </p>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="flex min-h-0 flex-1 flex-col gap-1.5">
          {attachments.length === 1 && (
            <p className="truncate text-xs font-medium text-foreground">
              {selected.filename}{" "}
              <span className="text-muted-foreground">({formatFileSize(selected.sizeBytes)})</span>
            </p>
          )}
          <div className="flex min-h-64 flex-1 items-center justify-center overflow-hidden rounded-xl bg-muted/40 p-4">
            {previewLoading && <p className="text-sm text-muted-foreground">กำลังโหลด…</p>}
            {previewError && (
              <p className="px-3 text-center text-sm text-danger-foreground">{previewError}</p>
            )}
            {!previewLoading && !previewError && previewUrl && selected.contentType.startsWith("image/") && (
              // eslint-disable-next-line @next/next/no-img-element -- object URL from a fetched blob, next/image can't optimize it
              <img
                src={previewUrl}
                alt={selected.filename}
                className="max-h-full max-w-full rounded-lg object-contain"
              />
            )}
            {!previewLoading && !previewError && previewUrl && selected.contentType === "application/pdf" && (
              <iframe
                src={previewUrl}
                title={selected.filename}
                className="h-full min-h-64 w-full rounded-lg border border-border"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
