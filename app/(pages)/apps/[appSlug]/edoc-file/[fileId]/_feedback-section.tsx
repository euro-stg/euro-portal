"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Plus, Download, Upload, FileQuestion, CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

type Question = { id: string; order: number; type: "ESSAY" | "MULTIPLE_CHOICE"; questionText: string; options: string[] };
type Feedback = { id: string; fileId: string; questions: Question[] };

const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-colors";

export function FeedbackSection({ fileId, uploaderId }: { fileId: string; uploaderId: string }) {
  const [me, setMe] = useState<{ userId: string; isSuperadmin: boolean } | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ variant: "success" | "error"; message: string } | null>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);
  const showToast = (variant: "success" | "error", message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ variant, message });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  const importRef = useRef<HTMLInputElement>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [newQType, setNewQType] = useState<"ESSAY" | "MULTIPLE_CHOICE">("ESSAY");
  const [newQText, setNewQText] = useState("");
  const [newQOptions, setNewQOptions] = useState("");
  const [addingQuestion, setAddingQuestion] = useState(false);

  const [answers, setAnswers] = useState<Record<string, { essayText?: string; selectedOptions?: string[] }>>({});
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, fbRes] = await Promise.all([
        fetch("/api/edoc/me").then((r) => r.json()),
        fetch(`/api/edoc/feedback?fileId=${fileId}`).then((r) => r.json()),
      ]);
      setMe(meRes);
      setFeedback(fbRes.data);
      setAlreadySubmitted(!!fbRes.alreadySubmitted);
    } finally { setLoading(false); }
  }, [fileId]);

  useEffect(() => { void load(); }, [load]);

  const canManage = !!me && (me.isSuperadmin || me.userId === uploaderId);

  const createFeedback = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/edoc/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileId }) });
      const json = await res.json();
      if (!res.ok) { showToast("error", json.message || "Gagal membuat Feedback"); return; }
      void load();
    } finally { setCreating(false); }
  };

  const addQuestion = async () => {
    if (!newQText.trim()) { showToast("error", "Pertanyaan wajib diisi"); return; }
    const options = newQType === "MULTIPLE_CHOICE" ? newQOptions.split("\n").map((o) => o.trim()).filter(Boolean) : [];
    if (newQType === "MULTIPLE_CHOICE" && options.length < 2) { showToast("error", "Minimal 2 opsi (satu opsi per baris)"); return; }
    setAddingQuestion(true);
    try {
      const res = await fetch(`/api/edoc/feedback/${feedback!.id}/questions`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: newQType, questionText: newQText.trim(), options }),
      });
      const json = await res.json();
      if (!res.ok) { showToast("error", json.message || "Gagal menambah soal"); return; }
      setNewQText(""); setNewQOptions("");
      void load();
    } finally { setAddingQuestion(false); }
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/edoc/feedback/${feedback!.id}/import`, { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { showToast("error", json.message || "Gagal import"); return; }
      showToast("success", `${json.imported} soal berhasil diimport`);
      void load();
    } finally { setImporting(false); }
  };

  const submitAnswers = async () => {
    setSubmitting(true);
    try {
      const payload = feedback!.questions.map((q) => ({ questionId: q.id, ...answers[q.id] }));
      const res = await fetch(`/api/edoc/feedback/${feedback!.id}/submit`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers: payload }),
      });
      const json = await res.json();
      if (!res.ok) { showToast("error", json.message || "Gagal submit"); return; }
      showToast("success", "Feedback berhasil disubmit");
      setAlreadySubmitted(true);
    } finally { setSubmitting(false); }
  };

  if (loading) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4">
      {toast && <div className="mb-3"><Alert variant={toast.variant} message={toast.message} /></div>}

      <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
        <FileQuestion className="w-4 h-4 text-amber-600" /> Feedback
      </p>

      {!feedback ? (
        canManage ? (
          <div>
            <p className="text-sm text-slate-400 mb-3">File ini belum punya Feedback.</p>
            <Button onClick={createFeedback} disabled={creating} variant="outline" className="flex items-center gap-2">
              {creating && <Loader2 className="w-4 h-4 animate-spin" />} Buat Feedback
            </Button>
          </div>
        ) : (
          <p className="text-sm text-slate-400">Tidak ada Feedback untuk file ini.</p>
        )
      ) : canManage ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <a href={`/api/edoc/feedback/${feedback.id}/template`}>
              <Button variant="outline" className="flex items-center gap-2"><Download className="w-4 h-4" /> Download Template</Button>
            </a>
            <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImport(f); }} />
            <Button variant="outline" disabled={importing} onClick={() => importRef.current?.click()} className="flex items-center gap-2">
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Import Excel
            </Button>
            <a href={`/api/edoc/feedback/${feedback.id}/export`}>
              <Button variant="outline" className="flex items-center gap-2"><Download className="w-4 h-4" /> Export Responses</Button>
            </a>
          </div>

          {feedback.questions.length > 0 && (
            <div className="space-y-2">
              {feedback.questions.map((q, i) => (
                <div key={q.id} className="px-3 py-2 bg-slate-50 rounded-lg text-sm">
                  <p className="font-medium text-slate-700">{i + 1}. {q.questionText} <span className="text-xs text-slate-400 font-normal">({q.type === "ESSAY" ? "Essay" : "Pilihan Ganda"})</span></p>
                  {q.options.length > 0 && <p className="text-xs text-slate-400 mt-0.5">{q.options.join(" · ")}</p>}
                </div>
              ))}
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 space-y-2">
            <p className="text-xs font-medium text-slate-500">Tambah Soal Manual</p>
            <div className="flex gap-2">
              {(["ESSAY", "MULTIPLE_CHOICE"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setNewQType(t)} className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${newQType === t ? "bg-amber-50 border-amber-300 text-amber-700" : "border-slate-200 text-slate-500"}`}>
                  {t === "ESSAY" ? "Essay" : "Pilihan Ganda"}
                </button>
              ))}
            </div>
            <input className={inputCls} placeholder="Teks pertanyaan" value={newQText} onChange={(e) => setNewQText(e.target.value)} />
            {newQType === "MULTIPLE_CHOICE" && (
              <textarea className={inputCls} rows={3} placeholder={"Satu opsi per baris"} value={newQOptions} onChange={(e) => setNewQOptions(e.target.value)} />
            )}
            <Button onClick={addQuestion} disabled={addingQuestion} variant="outline" size="sm" className="flex items-center gap-2">
              {addingQuestion ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Tambah Soal
            </Button>
          </div>
        </div>
      ) : alreadySubmitted ? (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-4 h-4" /> Anda sudah submit Feedback ini.
        </div>
      ) : feedback.questions.length === 0 ? (
        <p className="text-sm text-slate-400">Belum ada soal.</p>
      ) : (
        <div className="space-y-4">
          {feedback.questions.map((q, i) => (
            <div key={q.id}>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{i + 1}. {q.questionText}</label>
              {q.type === "ESSAY" ? (
                <textarea className={inputCls} rows={2} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: { essayText: e.target.value } }))} />
              ) : (
                <div className="space-y-1.5">
                  {q.options.map((opt) => {
                    const checked = answers[q.id]?.selectedOptions?.includes(opt) ?? false;
                    return (
                      <label key={opt} className="flex items-center gap-2 text-sm text-slate-600">
                        <input
                          type="checkbox" checked={checked} className="rounded border-slate-300"
                          onChange={(e) => setAnswers((a) => {
                            const current = a[q.id]?.selectedOptions ?? [];
                            const next = e.target.checked ? [...current, opt] : current.filter((o) => o !== opt);
                            return { ...a, [q.id]: { selectedOptions: next } };
                          })}
                        />
                        {opt}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
          <Button onClick={submitAnswers} disabled={submitting} className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-2">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {submitting ? "Mengirim..." : "Submit Feedback"}
          </Button>
        </div>
      )}
    </div>
  );
}
