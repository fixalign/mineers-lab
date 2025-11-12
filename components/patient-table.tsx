"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useMockData } from "@/lib/config";
import { getUser } from "@/lib/authService";
import { listFilesForPatient, listPatientsForUser } from "@/lib/mockStore";
import { useRef } from "react";

type Patient = {
  id: string;
  name: string;
  service: string;
  shade: string;
  notes: string | null;
  created_at: string;
  status?: "draft" | "sent" | "done" | "finished";
};

type LabFile = {
  id: string;
  file_url: string;
  file_name: string;
  uploaded_at: string;
};

export default function PatientTable() {
  const isMock = useMockData;
  const [patients, setPatients] = useState<Patient[]>([]);
  const [fileCountByPatient, setFileCountByPatient] = useState<
    Record<string, number>
  >({});
  const [loading, setLoading] = useState(true);
  // inline file upload removed per request
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "draft" | "sent" | "done"
  >("all");
  const [sortDesc, setSortDesc] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      if (isMock) {
        const user = await getUser();
        if (!user) {
          setPatients([]);
          setFileCountByPatient({});
          setLoading(false);
          return;
        }
        const data = listPatientsForUser(user.id);
        setPatients(data);
        const counts: Record<string, number> = {};
        data.forEach((p) => {
          counts[p.id] = listFilesForPatient(p.id).length;
        });
        setFileCountByPatient(counts);
        setLoading(false);
        return;
      }
      if (!supabase) {
        setPatients([]);
        setFileCountByPatient({});
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("lab_patients")
        .select("id,name,service,shade,notes,created_at,status")
        .order("created_at", { ascending: false });
      if (error) {
        setLoading(false);
        return;
      }
      setPatients(data ?? []);
      const counts: Record<string, number> = {};
      for (const p of data ?? []) {
        const { count } = await supabase
          .from("lab_files")
          .select("id", { count: "exact", head: true })
          .eq("patient_id", p.id);
        counts[p.id] = count ?? 0;
      }
      setFileCountByPatient(counts);
      setLoading(false);
    };
    void load();
    if (typeof window !== "undefined") {
      const handler = () => {
        void load();
      };
      window.addEventListener("cases-updated", handler);
      return () => {
        window.removeEventListener("cases-updated", handler);
      };
    }
  }, [isMock]);

  const refresh = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cases-updated"));
    }
  };

  const actionSend = async (id: string) => {
    if (isMock) {
      const { updatePatient } = await import("@/lib/mockStore");
      updatePatient(id, { status: "sent" } as any);
      refresh();
      return;
    }

    // Get patient details before updating
    const { data: patient } = await supabase!
      .from("lab_patients")
      .select("*, lab_labs(name, email, phone)")
      .eq("id", id)
      .single();

    // Update status to sent
    await supabase!
      .from("lab_patients")
      .update({ status: "sent" })
      .eq("id", id);

    // Call webhook if patient has lab_id
    if (patient?.lab_id) {
      try {
        const patientWithLab = patient as typeof patient & {
          lab_labs?: { name: string; email: string; phone: string };
        };
        const labName = patientWithLab.lab_labs?.name || "Unknown Lab";
        const labEmail = patientWithLab.lab_labs?.email || "";
        const labPhone = patientWithLab.lab_labs?.phone || "";
        await fetch("https://n8n.fixaligner.com/webhook-test/noti-labs", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            patient_id: patient.id,
            patient_name: patient.name,
            service: patient.service,
            shade: patient.shade,
            notes: patient.notes,
            delivery_date: patient.delivery_date,
            lab_id: patient.lab_id,
            lab_name: labName,
            lab_email: labEmail,
            lab_phone: labPhone,
            created_at: patient.created_at,
          }),
        });
      } catch (error) {
        console.error("Failed to send webhook notification:", error);
      }
    }

    refresh();
  };

  const actionDelete = async (id: string) => {
    if (isMock) {
      const { deletePatient } = await import("@/lib/mockStore");
      deletePatient(id);
      refresh();
      return;
    }
    // best effort: delete files rows then patient
    await supabase!.from("lab_files").delete().eq("patient_id", id);
    await supabase!.from("lab_patients").delete().eq("id", id);
    refresh();
  };

  // inline file upload removed per request

  if (loading) {
    return <p className="text-sm">Loading…</p>;
  }

  const filtered = patients
    .filter((p) => {
      if (statusFilter !== "all" && (p.status ?? "draft") !== statusFilter)
        return false;
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.service.toLowerCase().includes(q) ||
        (p.shade ?? "").toLowerCase().includes(q) ||
        (p.notes ?? "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return sortDesc ? db - da : da - db;
    });

  const statusClass = (s?: string) =>
    `inline-flex items-center rounded px-2 py-0.5 text-xs ${
      s === "done"
        ? "border border-green-600 text-green-700"
        : s === "sent"
        ? "border border-amber-600 text-amber-700"
        : "border border-muted-foreground/40 text-muted-foreground"
    }`;

  return (
    <div className="overflow-x-auto">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, service, shade, notes..."
          className="w-full md:w-64 rounded-md border px-3 py-2 bg-background"
        />
        <div className="flex items-center gap-1">
          <button
            onClick={() => setStatusFilter("all")}
            className={`rounded-md border px-2 py-1 text-xs ${
              statusFilter === "all" ? "bg-muted" : ""
            }`}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter("draft")}
            className={`rounded-md border px-2 py-1 text-xs ${
              statusFilter === "draft" ? "bg-muted" : ""
            }`}
          >
            Draft
          </button>
          <button
            onClick={() => setStatusFilter("sent")}
            className={`rounded-md border px-2 py-1 text-xs ${
              statusFilter === "sent" ? "bg-muted" : ""
            }`}
          >
            Sent
          </button>
          <button
            onClick={() => setStatusFilter("done")}
            className={`rounded-md border px-2 py-1 text-xs ${
              statusFilter === "done" ? "bg-muted" : ""
            }`}
          >
            Done
          </button>
        </div>
        <button
          onClick={() => setSortDesc((v) => !v)}
          className="rounded-md border px-2 py-1 text-xs"
          title="Toggle sort by date"
        >
          Sort: {sortDesc ? "Newest" : "Oldest"}
        </button>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left">
          <tr className="border-b">
            <th className="py-2 pr-3">Patient</th>
            <th className="py-2 pr-3">Service</th>
            <th className="py-2 pr-3">Shade</th>
            <th className="py-2 pr-3">Notes</th>
            <th className="py-2 pr-3">Status</th>
            <th className="py-2 pr-3">Files</th>
            <th className="py-2 pr-3">Created</th>
            <th className="py-2 pr-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((p) => (
            <tr
              key={p.id}
              className={`border-b align-top ${
                p.status === "draft" ? "bg-muted/20" : ""
              }`}
            >
              <td className="py-2 pr-3 font-medium">
                <a
                  className="text-primary hover:underline"
                  href={`/cases/${p.id}`}
                >
                  {p.name}
                </a>
              </td>
              <td className="py-2 pr-3">{p.service}</td>
              <td className="py-2 pr-3">{p.shade}</td>
              <td className="py-2 pr-3 max-w-[24rem]">{p.notes}</td>
              <td className="py-2 pr-3">
                <span className={statusClass(p.status)}>
                  {p.status ?? "draft"}
                </span>
              </td>
              <td className="py-2 pr-3">
                <span className="text-xs text-muted-foreground">
                  {fileCountByPatient[p.id] ?? 0}
                </span>
                {/* inline add files removed per request */}
              </td>
              <td className="py-2 pr-3">
                {new Date(p.created_at).toLocaleString()}
              </td>
              <td className="py-2 pr-3">
                <div className="flex flex-wrap items-center gap-2">
                  {p.status !== "sent" && p.status !== "done" ? (
                    <button
                      className="rounded-md border px-2 py-1"
                      onClick={() => void actionSend(p.id)}
                    >
                      Send
                    </button>
                  ) : null}
                  <a
                    className="rounded-md border px-2 py-1"
                    href={`/cases/${p.id}?edit=1`}
                  >
                    Edit
                  </a>
                  <button
                    className="rounded-md border px-2 py-1 text-red-600"
                    onClick={() => void actionDelete(p.id)}
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
