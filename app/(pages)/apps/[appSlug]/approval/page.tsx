"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Loader2, Workflow, Clock, ChevronRight, User, Building2, AlertCircle } from "lucide-react";

type Submitter = {
  id: string;
  name: string | null;
  jobPositionName: string | null;
  organizationName: string | null;
};

type PendingItem = {
  approvalId: string;
  sdRequestId?: string;
  letterId?: string;
  requestNo?: string;
  title: string;
  submittedBy: Submitter;
  currentStep: number;
  totalSteps: number;
  stepLabel: string;
  stepJobPositionName: string | null;
  stepOrganizationName: string | null;
  stepBranchName: string | null;
  category?: { code: string; name: string };
  company?: { code: string; name: string };
  createdAt: string;
};

export default function ApprovalInboxPage() {
  const { appSlug } = useParams<{ appSlug: string }>();
  const router = useRouter();

  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isSsd = appSlug === "ssd";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const api = isSsd ? "/api/ssd/approval/pending?detail=true" : "/api/sd/approval/pending";
      const res = await fetch(api);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Gagal memuat");
      setItems(json.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal memuat");
    } finally {
      setLoading(false);
    }
  }, [isSsd]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-slate-400">
      <Loader2 className="w-6 h-6 animate-spin mr-2" /> Memuat...
    </div>
  );

  if (error) return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
      {error}
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
            <Workflow className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Approval Masuk</h1>
            <p className="text-xs text-slate-400">Pengajuan yang menunggu tindakan Anda</p>
          </div>
        </div>
        {items.length > 0 && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-semibold">
            {items.length} menunggu
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
            <Workflow className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-500">Tidak ada approval yang menunggu</p>
          <p className="text-xs text-slate-400 mt-1">Semua pengajuan sudah ditindaklanjuti</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <button
              key={item.approvalId}
              onClick={() => router.push(isSsd ? `/apps/${appSlug}/letter/${item.letterId}` : `/apps/${appSlug}/requests/${item.sdRequestId}`)}
              className="w-full bg-white rounded-xl border border-amber-100 p-4 hover:border-amber-300 hover:shadow-sm transition-all text-left group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0 mt-0.5">
                    <Clock className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {item.requestNo && <span className="text-xs font-mono text-slate-400">{item.requestNo}</span>}
                      {item.category && <span className="text-xs bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded font-mono">{item.category.code}</span>}
                      {item.company && <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{item.company.code}</span>}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
                        Step {item.currentStep} / {item.totalSteps}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800 truncate">{item.title}</p>

                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />
                      <span className="text-xs text-amber-700 font-medium">{item.stepLabel}</span>
                      {item.stepJobPositionName && (
                        <span className="text-xs text-slate-500">· {item.stepJobPositionName}</span>
                      )}
                      {item.stepOrganizationName && (
                        <span className="text-xs text-slate-500">· {item.stepOrganizationName}</span>
                      )}
                      {item.stepBranchName && (
                        <span className="text-xs text-slate-500">– {item.stepBranchName}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3 h-3 text-slate-400" />
                        <span className="text-xs text-slate-500">{item.submittedBy.name}</span>
                      </div>
                      {item.submittedBy.organizationName && (
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          <span className="text-xs text-slate-500">{item.submittedBy.organizationName}</span>
                        </div>
                      )}
                      <span className="text-xs text-slate-400">
                        {new Date(item.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 shrink-0 mt-2 transition-colors" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
