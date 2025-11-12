"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useMockData } from "@/lib/config";
import { getSession, signOut } from "@/lib/authService";
import { supabase } from "@/lib/supabaseClient";
import JSZip from "jszip";

type Patient = {
  id: string;
  name: string;
  service: string;
  shade: string;
  notes: string | null;
  delivery_date?: string | null;
  lab_id?: string | null;
  status?: "draft" | "sent" | "done" | "finished";
  created_by: string;
  created_at: string;
};

type LabFile = {
  id: string;
  patient_id: string;
  file_url: string;
  file_name: string;
  uploaded_at: string;
};

export default function CaseDetail({ id }: { id: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const isMock = useMockData;
  const [role, setRole] = useState<string | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [files, setFiles] = useState<LabFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState<Partial<Patient>>({});
  const [labs, setLabs] = useState<Array<{ id: string; name: string }>>([]);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const acceptTypes =
    ".jpg,.jpeg,.png,.gif,.webp,.pdf,.dcm,.stl,.ply,.obj,.3mf,.zip";
  const [updatingDone, setUpdatingDone] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const init = async () => {
      const session = await getSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      setRole(session.user.role);
    };
    void init();
  }, [router]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      // Load labs for dropdown
      if (!isMock && supabase) {
        const { data } = await supabase
          .from("lab_labs")
          .select("id, name")
          .order("name");
        setLabs(data ?? []);
      } else if (isMock) {
        setLabs([
          { id: "lab-1", name: "Lab A" },
          { id: "lab-2", name: "Lab B" },
          { id: "lab-3", name: "Lab C" },
          { id: "lab-4", name: "Lab D" },
        ]);
      }

      if (isMock) {
        const store = await import("@/lib/mockStore");
        const p = store.getPatientById(id);
        const fls = store.listFilesForPatient(id);
        setPatient(p);
        setFiles(fls);
        if (p && search?.get("edit") === "1") {
          setEditing(true);
          setEditValues({
            name: p.name,
            service: p.service,
            shade: p.shade,
            notes: p.notes ?? "",
            delivery_date: p.delivery_date ?? "",
            lab_id: p.lab_id ?? "",
          });
        }
        setLoading(false);
        return;
      }
      if (!supabase) {
        setPatient(null);
        setFiles([]);
        setLoading(false);
        return;
      }
      const { data: p } = await supabase
        .from("lab_patients")
        .select("*")
        .eq("id", id)
        .single();
      const { data: fls } = await supabase
        .from("lab_files")
        .select("id,patient_id,file_url,file_name,uploaded_at")
        .eq("patient_id", id)
        .order("uploaded_at", { ascending: false });

      const patientData = p as Patient | null;
      setPatient(patientData);
      setFiles((fls as LabFile[]) ?? []);

      if (patientData && search?.get("edit") === "1") {
        setEditing(true);
        setEditValues({
          name: patientData.name,
          service: patientData.service,
          shade: patientData.shade,
          notes: patientData.notes ?? "",
          delivery_date: patientData.delivery_date ?? "",
          lab_id: patientData.lab_id ?? "",
        });
      }
      setLoading(false);
    };
    void load();
  }, [id, isMock, search]);

  const isAdmin = role === "mineers";
  const isLab = role === "lab";

  const statusBadge = (s?: string) =>
    `inline-flex items-center rounded px-2 py-0.5 text-xs ${
      s === "finished"
        ? "border border-purple-600 text-purple-700"
        : s === "done"
        ? "border border-green-600 text-green-700"
        : s === "sent"
        ? "border border-amber-600 text-amber-700"
        : "border border-muted-foreground/40 text-muted-foreground"
    }`;

  const refresh = () => {
    if (typeof window !== "undefined")
      window.dispatchEvent(new CustomEvent("cases-updated"));
  };

  const saveEdits = async () => {
    if (!patient) return;
    if (isMock) {
      const { updatePatient, getPatientById } = await import("@/lib/mockStore");
      updatePatient(patient.id, editValues);
      const updatedPatient = getPatientById(patient.id);
      if (updatedPatient) {
        setPatient(updatedPatient);
      }
      setEditing(false);
      refresh();
      return;
    }

    // If status is being changed to "finished", delete all files first
    if (
      editValues.status === "finished" &&
      patient.status !== "finished" &&
      !isMock &&
      files.length > 0
    ) {
      if (
        !confirm("Mark as finished? All files will be permanently deleted.")
      ) {
        return;
      }

      // Delete all files from storage
      for (const file of files) {
        try {
          const marker = "/storage/v1/object/public/lab_files/";
          const idx = file.file_url.indexOf(marker);
          if (idx !== -1) {
            const key = file.file_url.substring(idx + marker.length);
            await supabase!.storage.from("lab_files").remove([key]);
          }
        } catch (error) {
          console.error(`Failed to delete ${file.file_name}:`, error);
        }
      }

      // Delete file records from database
      await supabase!.from("lab_files").delete().eq("patient_id", patient.id);
      setFiles([]);
    }

    await supabase!
      .from("lab_patients")
      .update(editValues)
      .eq("id", patient.id);

    // Reload patient data
    const { data: updatedPatient } = await supabase!
      .from("lab_patients")
      .select("*")
      .eq("id", patient.id)
      .single();

    if (updatedPatient) {
      setPatient(updatedPatient as Patient);
    }

    setEditing(false);
    refresh();
  };

  const addFiles = async () => {
    if (!patient || !selectedFiles || selectedFiles.length === 0) return;
    setUploading(true);
    if (isMock) {
      const { addFile } = await import("@/lib/mockStore");
      for (const file of Array.from(selectedFiles)) {
        const fileId =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `file-${Date.now()}`;
        const url =
          typeof window !== "undefined"
            ? URL.createObjectURL(file)
            : `https://placehold.co/400x300?text=${encodeURIComponent(
                file.name
              )}`;
        addFile({
          id: fileId,
          patient_id: patient.id,
          file_url: url,
          file_name: file.name,
          uploaded_at: new Date().toISOString(),
        });
      }
      // Reload files from mock store
      const { listFilesForPatient } = await import("@/lib/mockStore");
      setFiles(listFilesForPatient(patient.id));
      setSelectedFiles(null);
      setUploading(false);
      refresh();
      return;
    }
    for (const f of Array.from(selectedFiles)) {
      const path = `${patient.id}/${Date.now()}-${f.name}`;
      const { error: upErr } = await supabase!.storage
        .from("lab_files")
        .upload(path, f, { upsert: false });
      if (upErr) continue;
      const { data: pub } = supabase!.storage
        .from("lab_files")
        .getPublicUrl(path);
      await supabase!.from("lab_files").insert([
        {
          patient_id: patient.id,
          file_url: pub.publicUrl,
          file_name: f.name,
        },
      ]);
    }

    // Reload files from database
    const { data: fls } = await supabase!
      .from("lab_files")
      .select("id,patient_id,file_url,file_name,uploaded_at")
      .eq("patient_id", patient.id)
      .order("uploaded_at", { ascending: false });

    setFiles((fls as LabFile[]) ?? []);
    setSelectedFiles(null);
    setUploading(false);
    refresh();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (!e.dataTransfer?.files?.length) return;
    setSelectedFiles(e.dataTransfer.files);
  };
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const deleteFileEntry = async (file: LabFile) => {
    if (isMock) {
      const { deleteFile } = await import("@/lib/mockStore");
      deleteFile(file.id);
      if (typeof window !== "undefined")
        window.dispatchEvent(new CustomEvent("cases-updated"));
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      return;
    }
    // Best-effort: try to delete from storage by deriving the key from the public URL
    try {
      const marker = "/storage/v1/object/public/lab_files/";
      const idx = file.file_url.indexOf(marker);
      if (idx !== -1) {
        const key = file.file_url.substring(idx + marker.length);
        await supabase!.storage.from("lab_files").remove([key]);
      }
    } catch {
      // ignore storage delete errors
    }
    await supabase!.from("lab_files").delete().eq("id", file.id);
    setFiles((prev) => prev.filter((f) => f.id !== file.id));
    if (typeof window !== "undefined")
      window.dispatchEvent(new CustomEvent("cases-updated"));
  };

  const markDone = async () => {
    if (!patient || updatingDone) return;
    setUpdatingDone(true);
    if (isMock) {
      const { updatePatient } = await import("@/lib/mockStore");
      updatePatient(patient.id, { status: "done" });
      setPatient((prev) => (prev ? { ...prev, status: "done" } : prev));
      setUpdatingDone(false);
      refresh();
      return;
    }
    await supabase!
      .from("lab_patients")
      .update({ status: "done" })
      .eq("id", patient.id);
    setPatient((prev) => (prev ? { ...prev, status: "done" } : prev));
    setUpdatingDone(false);
    refresh();
  };

  const sendCase = async () => {
    if (!patient) return;
    if (isMock) {
      const { updatePatient } = await import("@/lib/mockStore");
      updatePatient(patient.id, { status: "sent" });
      refresh();
      return;
    }
    await supabase!
      .from("lab_patients")
      .update({ status: "sent" })
      .eq("id", patient.id);
    refresh();
  };

  const downloadAllFiles = async () => {
    if (!patient || files.length === 0) return;

    const zip = new JSZip();
    const folderName = `${patient.name.replace(/[^a-z0-9]/gi, "_")}_files`;

    for (const file of files) {
      try {
        const response = await fetch(file.file_url);
        const blob = await response.blob();
        zip.file(file.file_name, blob);
      } catch (error) {
        console.error(`Failed to download ${file.file_name}:`, error);
      }
    }

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${folderName}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deleteCase = async () => {
    if (!patient) return;
    if (
      !confirm(
        "Delete this case? Files will also be removed (in mock mode files are just detached)."
      )
    )
      return;
    if (isMock) {
      const { deletePatient } = await import("@/lib/mockStore");
      deletePatient(patient.id);
      router.replace("/admin");
      refresh();
      return;
    }
    await supabase!.from("lab_files").delete().eq("patient_id", patient.id);
    await supabase!.from("lab_patients").delete().eq("id", patient.id);
    router.replace("/admin");
    refresh();
  };

  if (loading) return <p className="text-sm p-4">Loading…</p>;
  if (!patient) return <p className="text-sm p-4">Case not found.</p>;

  return (
    <div className="min-h-screen">
      <header className="border-b bg-background">
        <div className="flex items-center justify-between px-4 md:px-6 py-2">
          <div className="flex items-center gap-3">
            <div className="h-12 flex items-center">
              <Image
                src="/logo.png"
                alt="Mineers Logo"
                width={150}
                height={48}
                className="h-12 w-auto object-contain"
                priority
              />
            </div>
            {/* <h1 className="text-xl md:text-2xl font-bold">
              Mineers {isLab ? "Lab" : ""}
            </h1> */}
          </div>
          <button
            onClick={async () => {
              await signOut();
              location.href = "/login";
            }}
            className="rounded-md border px-3 py-2 hover:bg-accent"
          >
            Sign out
          </button>
        </div>
      </header>
      <div className="p-4 md:p-6 space-y-6">
        <div>
          <button
            className="inline-flex items-center gap-2 text-base font-medium text-foreground hover:text-primary border rounded-md px-4 py-2 hover:bg-accent mb-4 transition-colors"
            onClick={() => router.back()}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back
          </button>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold mb-2">{patient.name}</h1>
              {isAdmin ? (
                <p className="text-sm text-muted-foreground">
                  {new Date(patient.created_at).toLocaleString()} •{" "}
                  <span className={statusBadge(patient.status)}>
                    {patient.status ?? "draft"}
                  </span>
                </p>
              ) : null}
              {isLab ? (
                <p className="text-sm text-muted-foreground">
                  {patient.service} • Shade: {patient.shade || "—"}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {isAdmin &&
              patient.status !== "sent" &&
              patient.status !== "done" ? (
                <button
                  className="rounded-md border px-3 py-2 hover:bg-accent"
                  onClick={() => void sendCase()}
                >
                  Send
                </button>
              ) : null}
              {isAdmin ? (
                <button
                  className="rounded-md border px-3 py-2 hover:bg-accent"
                  onClick={() => {
                    setEditing((e) => !e);
                    setEditValues({
                      name: patient.name,
                      service: patient.service,
                      shade: patient.shade,
                      notes: patient.notes ?? "",
                      delivery_date: patient.delivery_date ?? "",
                      lab_id: patient.lab_id ?? "",
                    });
                  }}
                >
                  {editing ? "Cancel edit" : "Edit"}
                </button>
              ) : null}
              {isAdmin ? (
                <button
                  className="rounded-md border border-red-600 text-red-600 px-3 py-2 hover:bg-red-50"
                  onClick={() => void deleteCase()}
                >
                  Delete
                </button>
              ) : null}
              {isLab && patient.status === "sent" ? (
                <button
                  disabled={updatingDone}
                  className="rounded-md border-2 border-green-600 bg-green-600 text-white hover:bg-green-700 px-4 py-2 disabled:opacity-50 font-medium"
                  onClick={() => void markDone()}
                >
                  {updatingDone ? "Marking…" : "Mark as Done"}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <div className="rounded-lg border p-4">
              <h2 className="font-medium mb-3">Case details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">
                    Patient name
                  </label>
                  {editing ? (
                    <input
                      className="w-full rounded-md border px-2 py-1 bg-background"
                      value={editValues.name ?? ""}
                      onChange={(e) =>
                        setEditValues((s) => ({ ...s, name: e.target.value }))
                      }
                    />
                  ) : (
                    <p className="mt-1">{patient.name}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">
                    Service
                  </label>
                  {editing ? (
                    <input
                      className="w-full rounded-md border px-2 py-1 bg-background"
                      value={editValues.service ?? ""}
                      onChange={(e) =>
                        setEditValues((s) => ({
                          ...s,
                          service: e.target.value,
                        }))
                      }
                    />
                  ) : (
                    <p className="mt-1">{patient.service}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Shade</label>
                  {editing ? (
                    <input
                      className="w-full rounded-md border px-2 py-1 bg-background"
                      value={editValues.shade ?? ""}
                      onChange={(e) =>
                        setEditValues((s) => ({ ...s, shade: e.target.value }))
                      }
                    />
                  ) : (
                    <p className="mt-1">{patient.shade || "—"}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Lab</label>
                  {editing ? (
                    <select
                      className="w-full rounded-md border px-2 py-1 bg-background"
                      value={editValues.lab_id ?? ""}
                      onChange={(e) =>
                        setEditValues((s) => ({ ...s, lab_id: e.target.value }))
                      }
                    >
                      <option value="">Select lab...</option>
                      {labs.map((lab) => (
                        <option key={lab.id} value={lab.id}>
                          {lab.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="mt-1">
                      {labs.find((l) => l.id === patient.lab_id)?.name || "—"}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">
                    Delivery Date
                  </label>
                  {editing ? (
                    <input
                      type="date"
                      className="w-full rounded-md border px-2 py-1 bg-background"
                      value={editValues.delivery_date ?? ""}
                      onChange={(e) =>
                        setEditValues((s) => ({
                          ...s,
                          delivery_date: e.target.value,
                        }))
                      }
                    />
                  ) : (
                    <p className="mt-1">
                      {patient.delivery_date
                        ? new Date(patient.delivery_date).toLocaleDateString()
                        : "—"}
                    </p>
                  )}
                </div>
                {isAdmin ? (
                  <div>
                    <label className="text-xs text-muted-foreground">
                      Status
                    </label>
                    {editing ? (
                      <select
                        className="w-full rounded-md border px-2 py-1 bg-background"
                        value={editValues.status ?? patient.status ?? "draft"}
                        onChange={(e) =>
                          setEditValues((s) => ({
                            ...s,
                            status: e.target.value as Patient["status"],
                          }))
                        }
                      >
                        <option value="draft">Draft</option>
                        <option value="sent">Sent</option>
                        <option value="done">Done</option>
                        <option value="finished">
                          Finished (Deletes Files)
                        </option>
                      </select>
                    ) : (
                      <p className="mt-1">
                        <span className={statusBadge(patient.status)}>
                          {patient.status ?? "draft"}
                        </span>
                      </p>
                    )}
                  </div>
                ) : null}
                <div className="md:col-span-2">
                  <label className="text-xs text-muted-foreground">Notes</label>
                  {editing ? (
                    <textarea
                      className="w-full min-h-24 rounded-md border px-2 py-1 bg-background"
                      value={(editValues.notes as string) ?? ""}
                      onChange={(e) =>
                        setEditValues((s) => ({ ...s, notes: e.target.value }))
                      }
                    />
                  ) : (
                    <p className="mt-1 whitespace-pre-wrap">
                      {patient.notes || "—"}
                    </p>
                  )}
                </div>
              </div>
              {editing ? (
                <div className="mt-3">
                  <button
                    className="rounded-md bg-primary text-primary-foreground px-3 py-2"
                    onClick={() => void saveEdits()}
                  >
                    Save changes
                  </button>
                </div>
              ) : null}
            </div>

            <div className="rounded-lg border p-4">
              <h2 className="font-medium mb-3">Files</h2>
              {files.length === 0 ? (
                <p className="text-sm text-muted-foreground">No files</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {files.map((f) => {
                    const lower = f.file_name.toLowerCase();
                    const isImg = [
                      ".jpg",
                      ".jpeg",
                      ".png",
                      ".gif",
                      ".webp",
                    ].some((ext) => lower.endsWith(ext));
                    return (
                      <div key={f.id} className="rounded border p-2">
                        {isImg ? (
                          <a href={f.file_url} target="_blank" rel="noreferrer">
                            <Image
                              src={f.file_url}
                              alt={f.file_name}
                              width={200}
                              height={112}
                              className="h-28 w-full object-cover rounded border"
                              unoptimized
                            />
                          </a>
                        ) : (
                          <div className="h-28 w-full rounded border flex items-center justify-center text-xs text-muted-foreground">
                            FILE
                          </div>
                        )}
                        <div className="mt-2 truncate text-xs">
                          {f.file_name}
                        </div>
                        <div className="flex gap-3 text-xs">
                          <a
                            href={f.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline"
                          >
                            View
                          </a>
                          <a
                            href={f.file_url}
                            download={f.file_name}
                            className="text-primary hover:underline"
                          >
                            Download
                          </a>
                          {isAdmin ? (
                            <button
                              onClick={() => void deleteFileEntry(f)}
                              className="text-red-600 hover:underline"
                            >
                              Delete
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="space-y-4">
            {isAdmin ? (
              <div className="rounded-lg border p-4">
                <h3 className="font-medium mb-2">Add more files</h3>
                <div
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  onClick={() => uploadRef.current?.click()}
                  className={`mb-2 flex flex-col items-center justify-center gap-2 rounded-md border px-3 py-6 text-center cursor-pointer ${
                    dragActive ? "border-primary bg-primary/5" : "bg-background"
                  }`}
                >
                  <p className="text-xs">
                    Drag & drop files here, or{" "}
                    <span className="text-primary underline">browse</span>
                  </p>
                  {selectedFiles && selectedFiles.length ? (
                    <p className="text-xs">
                      {selectedFiles.length} file(s) selected
                    </p>
                  ) : null}
                  <input
                    ref={uploadRef}
                    type="file"
                    multiple
                    onChange={(e) => setSelectedFiles(e.target.files)}
                    className="hidden"
                    accept={acceptTypes}
                  />
                </div>
                <button
                  className="rounded-md border px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  onClick={() => void addFiles()}
                  disabled={
                    uploading || !selectedFiles || selectedFiles.length === 0
                  }
                >
                  {uploading && (
                    <svg
                      className="animate-spin h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  )}
                  {uploading ? "Uploading..." : "Upload"}
                </button>
              </div>
            ) : null}
            {files.length > 0 ? (
              <div className="rounded-lg border p-4">
                <h3 className="font-medium mb-2">Download all files</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Download all {files.length} file
                  {files.length !== 1 ? "s" : ""} as a ZIP archive
                </p>
                <button
                  className="w-full rounded-md bg-primary text-primary-foreground px-3 py-2"
                  onClick={() => void downloadAllFiles()}
                >
                  Download Case
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
