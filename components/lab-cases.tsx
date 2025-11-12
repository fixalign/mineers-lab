"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useMockData } from "@/lib/config";
import { listAllPatients, listFiles } from "@/lib/mockStore";

type Patient = {
  id: string;
  name: string;
  service: string;
  shade: string;
  notes: string | null;
  created_at: string;
  status?: "draft" | "sent" | "done";
};

type LabFile = {
  id: string;
  file_url: string;
  file_name: string;
  uploaded_at: string;
  patient_id: string;
};

export default function LabCases() {
  const isMock = useMockData;
  const [patients, setPatients] = useState<Patient[]>([]);
  const [files, setFiles] = useState<LabFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      if (isMock) {
        setPatients(
          listAllPatients().filter(
            (p) => p.status === "sent" || p.status === "done"
          )
        );
        setFiles(listFiles());
        setLoading(false);
        return;
      }
      if (!supabase) {
        setPatients([]);
        setFiles([]);
        setLoading(false);
        return;
      }
      const [{ data: pats }, { data: fls }] = await Promise.all([
        supabase
          .from("lab_patients")
          .select("id,name,service,shade,notes,created_at,status")
          .order("created_at", { ascending: false }),
        supabase
          .from("lab_files")
          .select("id,file_url,file_name,uploaded_at,patient_id")
          .order("uploaded_at", { ascending: false }),
      ]);
      setPatients(
        (pats ?? []).filter(
          (p: any) => p.status === "sent" || p.status === "done"
        )
      );
      setFiles(fls ?? []);
      setLoading(false);
    };
    void load();
    if (typeof window !== "undefined") {
      const handler = () => {
        void load();
      };
      window.addEventListener("cases-updated", handler);
      return () => window.removeEventListener("cases-updated", handler);
    }
  }, [isMock]);

  const setDone = async (id: string) => {
    if (isMock) {
      const { updatePatient } = await import("@/lib/mockStore");
      updatePatient(id, { status: "done" } as any);
      if (typeof window !== "undefined")
        window.dispatchEvent(new CustomEvent("cases-updated"));
      return;
    }
    await supabase!
      .from("lab_patients")
      .update({ status: "done" })
      .eq("id", id);
    if (typeof window !== "undefined")
      window.dispatchEvent(new CustomEvent("cases-updated"));
  };

  if (loading) return <p className="text-sm">Loading…</p>;

  return (
    <div className="space-y-4">
      {patients.map((p) => {
        const pf = files.filter((f) => f.patient_id === p.id);
        const isDone = p.status === "done";
        return (
          <div
            key={p.id}
            className="rounded-lg border p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-lg">{p.name}</h3>
                  {isDone ? (
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                      Done
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                      In Progress
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground mb-2">
                  <span>
                    Service:{" "}
                    <span className="font-medium text-foreground">
                      {p.service}
                    </span>
                  </span>
                  <span>•</span>
                  <span>
                    Shade:{" "}
                    <span className="font-medium text-foreground">
                      {p.shade || "—"}
                    </span>
                  </span>
                  <span>•</span>
                  <span>
                    {pf.length} file{pf.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {p.notes ? (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                    {p.notes}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <a
                  className="rounded-md border border-primary bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 text-sm font-medium text-center transition-colors"
                  href={`/cases/${p.id}`}
                >
                  Open Case
                </a>
                {p.status === "sent" ? (
                  <button
                    className="rounded-md border border-green-600 bg-green-600 text-white hover:bg-green-700 px-4 py-2 text-sm font-medium transition-colors"
                    onClick={() => void setDone(p.id)}
                  >
                    Mark Done
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
