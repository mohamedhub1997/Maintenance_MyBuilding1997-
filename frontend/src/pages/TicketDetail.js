import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api, { formatApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useT } from "../i18n";
import { StatusBadge, PriorityDot } from "../components/UI";
import ImageGallery from "../components/ImageGallery";
import TicketComments from "../components/TicketComments";
import TicketSidebar from "../components/TicketSidebar";
import { ArrowLeft, Trash2 } from "lucide-react";

function useTicket(id) {
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await api.get(`/tickets/${id}`);
      setTicket(r.data);
    } catch (e) {
      setError(formatApiError(e));
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  return { ticket, error, load };
}

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const t = useT();
  const { ticket, error, load } = useTicket(id);
  const [maintenance, setMaintenance] = useState([]);

  useEffect(() => {
    if (user?.role === "admin") {
      api.get("/users", { params: { role: "maintenance" } })
        .then((r) => setMaintenance(r.data))
        .catch(() => setMaintenance([]));
    }
  }, [user]);

  const back = useCallback(() => {
    if (user.role === "admin") navigate("/admin/tickets");
    else if (user.role === "tenant") navigate("/tenant");
    else navigate("/maintenance");
  }, [user, navigate]);

  if (error) return <div className="text-red-400">{error}</div>;
  if (!ticket) return <div className="text-slate-400">{t("common.loading")}</div>;

  const canComment =
    user.role === "admin" ||
    (user.role === "tenant" && ticket.tenant_id === user.id) ||
    (user.role === "maintenance" && ticket.maintenance_id === user.id);

  const remove = async () => {
    if (!window.confirm(t("ticketDetail.deleteConfirm"))) return;
    try { await api.delete(`/tickets/${id}`); back(); } catch { /* ignore */ }
  };

  return (
    <div className="fade-in" data-testid="ticket-detail-page">
      <button onClick={back}
        className="text-slate-400 text-sm flex items-center gap-1 mb-4 hover:text-white"
        data-testid="back-button">
        <ArrowLeft className="w-4 h-4" /> {t("common.back")}
      </button>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <TicketHeader ticket={ticket} userRole={user.role} onDelete={remove} />
          <TicketComments
            ticket={ticket}
            currentUserId={user.id}
            userRole={user.role}
            canComment={canComment}
            onChanged={load}
          />
        </div>
        <TicketSidebar
          ticket={ticket}
          user={user}
          maintenance={maintenance}
          onChanged={load}
        />
      </div>
    </div>
  );
}

function TicketHeader({ ticket, userRole, onDelete }) {
  const t = useT();
  return (
    <div className="card p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <StatusBadge status={ticket.status} />
            <PriorityDot priority={ticket.priority} />
            <span className="text-xs text-slate-500">
              {new Date(ticket.created_at).toLocaleString()}
            </span>
          </div>
          <h1 className="text-2xl font-bold">{ticket.title}</h1>
          <p className="text-slate-300 mt-3 whitespace-pre-wrap">{ticket.description}</p>
        </div>
        {userRole === "admin" && (
          <button className="btn btn-danger !text-xs !py-1.5 !px-3" onClick={onDelete}
            data-testid="delete-ticket-button">
            <Trash2 className="w-3 h-3" /> {t("common.delete")}
          </button>
        )}
      </div>
      {ticket.images?.length > 0 && (
        <div className="mt-5">
          <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">
            {t("ticketDetail.photoLabel")}
          </div>
          <ImageGallery images={ticket.images} />
        </div>
      )}
    </div>
  );
}
