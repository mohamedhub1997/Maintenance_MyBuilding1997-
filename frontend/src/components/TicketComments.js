import React, { useState } from "react";
import api, { formatApiError } from "../lib/api";
import { useT } from "../i18n";
import ImageGallery from "./ImageGallery";
import ImageUploader from "./ImageUploader";
import { Send } from "lucide-react";

const roleStyles = {
  admin: "bg-purple-500/15 text-purple-300",
  tenant: "bg-blue-500/15 text-blue-300",
  maintenance: "bg-accent/15 text-accent",
};

function CommentItem({ c, currentUserId }) {
  const t = useT();
  const isMe = c.author_id === currentUserId;
  return (
    <div className="border-l-2 border-slate-800 pl-4" data-testid={`comment-${c.id}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="font-semibold text-sm">{c.author_name}</span>
        <span className={`badge ${roleStyles[c.author_role] || ""}`}>{t(`common.${c.author_role}`)}</span>
        {isMe && <span className="text-xs text-slate-500">· {t("common.you")}</span>}
        <span className="text-xs text-slate-500 ml-auto">{new Date(c.created_at).toLocaleString()}</span>
      </div>
      {c.text && <p className="text-slate-200 text-sm whitespace-pre-wrap">{c.text}</p>}
      {c.images?.length > 0 && (
        <div className="mt-2">
          <ImageGallery images={c.images} />
        </div>
      )}
    </div>
  );
}

function CommentForm({ ticketId, onPosted, role }) {
  const t = useT();
  const [text, setText] = useState("");
  const [images, setImages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const empty = !text.trim() && images.length === 0;

  const submit = async (e) => {
    e.preventDefault();
    if (empty) return;
    setError("");
    setBusy(true);
    try {
      await api.post(`/tickets/${ticketId}/comments`, { text: text.trim(), images });
      setText("");
      setImages([]);
      await onPosted();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const placeholder = role === "maintenance"
    ? t("ticketDetail.commentPhMaint")
    : t("ticketDetail.commentPhTenant");

  return (
    <form onSubmit={submit} className="mt-6 space-y-3 border-t border-slate-800 pt-5">
      <textarea className="input" rows={3}
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        data-testid="comment-text-input" />
      <ImageUploader images={images} onChange={setImages} max={6} />
      {error && <div className="text-red-400 text-sm">{error}</div>}
      <button type="submit" className="btn btn-primary" disabled={busy || empty}
        data-testid="post-comment-button">
        <Send className="w-4 h-4" /> {busy ? t("ticketDetail.posting") : t("ticketDetail.post")}
      </button>
    </form>
  );
}

export default function TicketComments({ ticket, currentUserId, userRole, canComment, onChanged }) {
  const t = useT();
  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold mb-4">{t("ticketDetail.activity")}</h2>
      <div className="space-y-4">
        {ticket.comments?.length === 0 && (
          <div className="text-slate-400 text-sm">{t("ticketDetail.noComments")}</div>
        )}
        {ticket.comments?.map((c) => (
          <CommentItem key={c.id} c={c} currentUserId={currentUserId} />
        ))}
      </div>
      {canComment ? (
        <CommentForm ticketId={ticket.id} onPosted={onChanged} role={userRole} />
      ) : (
        <div className="text-slate-500 text-sm mt-4">{t("ticketDetail.viewOnly")}</div>
      )}
    </div>
  );
}
