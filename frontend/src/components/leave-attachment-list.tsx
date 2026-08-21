"use client";

import { useState } from "react";
import { FileText, Image as ImageIcon } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { openLeaveAttachment, type LeaveAttachment } from "@/lib/api-leave";

function formatFileSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Shared by the employee /leave page and admin /leave-requests page: a
// clickable list of a leave request's already-uploaded attachments that
// opens a preview (the actual image, or an embedded PDF) rather than just
// naming the file — the attachment endpoint is bearer-authenticated, so
// this fetches it into a blob/object URL first instead of pointing an
// <img>/<iframe> straight at the API path.
export function LeaveAttachmentList({
  leaveRequestId,
  attachments,
}: {
  leaveRequestId: string;
  attachments: LeaveAttachment[];
}) {
  const [previewAttachment, setPreviewAttachment] = useState<LeaveAttachment | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const openPreview = async (attachment: LeaveAttachment) => {
    setPreviewAttachment(attachment);
    setPreviewUrl(null);
    setPreviewError(null);
    try {
      const url = await openLeaveAttachment(leaveRequestId, attachment.id);
      setPreviewUrl(url);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "เปิดไฟล์ไม่สำเร็จ");
    }
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewAttachment(null);
    setPreviewUrl(null);
    setPreviewError(null);
  };

  if (attachments.length === 0) return null;

  return (
    <>
      <div className="flex flex-col gap-1.5">
        {attachments.map((attachment) => {
          const Icon = attachment.contentType.startsWith("image/") ? ImageIcon : FileText;
          return (
            <button
              key={attachment.id}
              type="button"
              onClick={() => void openPreview(attachment)}
              className="flex cursor-pointer items-center gap-2 rounded-xl bg-muted/40 px-3 py-2 text-left hover:bg-muted"
            >
              <Icon className="size-4 shrink-0 text-brand-600" />
              <p className="min-w-0 flex-1 truncate text-xs text-foreground">
                {attachment.filename}{" "}
                <span className="text-muted-foreground">({formatFileSize(attachment.sizeBytes)})</span>
              </p>
            </button>
          );
        })}
      </div>

      <Dialog
        open={previewAttachment !== null}
        onOpenChange={(open) => {
          if (!open) closePreview();
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="truncate">{previewAttachment?.filename}</DialogTitle>
          </DialogHeader>
          {previewError && (
            <p className="rounded-xl bg-danger px-3 py-2 text-sm text-danger-foreground">{previewError}</p>
          )}
          {!previewError && !previewUrl && (
            <p className="py-6 text-center text-sm text-muted-foreground">กำลังโหลด…</p>
          )}
          {!previewError && previewUrl && previewAttachment?.contentType.startsWith("image/") && (
            // eslint-disable-next-line @next/next/no-img-element -- object URL from a fetched blob, next/image can't optimize it
            <img
              src={previewUrl}
              alt={previewAttachment.filename}
              className="max-h-[70vh] w-full rounded-lg object-contain"
            />
          )}
          {!previewError && previewUrl && previewAttachment?.contentType === "application/pdf" && (
            <iframe
              src={previewUrl}
              title={previewAttachment.filename}
              className="h-[70vh] w-full rounded-lg border border-border"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
