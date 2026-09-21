"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, FileText, ChevronRight, ListChecks } from "lucide-react";

type PendingFile = {
  id: string; title: string; description: string | null; createdAt: string;
  category: { code: string; name: string } | null;
  categoryType: { code: string; name: string } | null;
  folder: { id: string; name: string };
  uploader: { id: string; name: string | null; employeeId: string };
};

// "Approval Document" menu — daftar semua file DRAFT lintas folder yang menunggu
// Document Approver. Digate role Document Approver (bukan folder ACL) di API-nya.
export default function EDocApprovalPage() {
  const { appSlug } = useParams<{ appSlug: string }>();
  const router = useRouter();
  const [data, setData] = useState<PendingFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/edoc/file/pending-approval");
      const json = await res.json();
      if (res.status === 403) { setForbidden(true); return; }
      setData(json.data ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Memuat...</div>;
  }

  if (forbidden) {
    return (
      <div className="bg-white rounded-xl border border-dashed border-slate-200 p-16 text-center">
        <ListChecks className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="font-semibold text-slate-500">Anda bukan Document Approver</p>
        <p className="text-slate-400 text-sm mt-1">Hubungi superadmin untuk mendapatkan role ini.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">Approval Document</h1>
        <p className="text-sm text-slate-400 mt-0.5">{data.length} dokumen menunggu approval</p>
      </div>

      {data.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 p-16 text-center">
          <ListChecks className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-500">Tidak ada dokumen yang menunggu approval</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((f) => (
            <button
              key={f.id}
              onClick={() => router.push(`/apps/${appSlug}/edoc-file/${f.id}`)}
              className="w-full bg-white rounded-xl border border-slate-200 hover:border-amber-300 hover:shadow-sm transition-all p-4 text-left group"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center shrink-0 group-hover:bg-amber-100 transition-colors">
                  <FileText className="w-5 h-5 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {f.category && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">{f.category.code}</span>}
                    {f.categoryType && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">{f.categoryType.name}</span>}
                    <span className="text-xs text-slate-400">di folder &ldquo;{f.folder.name}&rdquo;</span>
                  </div>
                  <p className="font-semibold text-slate-800 truncate">{f.title}</p>
                  <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
                    <span>Oleh: {f.uploader.name ?? f.uploader.employeeId}</span>
                    <span>{new Date(f.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-amber-400 shrink-0 mt-1 transition-colors" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
