"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getUser } from "@/lib/authService";
import { useMockData } from "@/lib/config";
import { addFile, addPatient } from "@/lib/mockStore";

type NewPatientFormState = {
  name: string;
  service: string;
  shade: string;
  notes: string;
  files: FileList | null;
};

export default function PatientForm() {
  const isMock = useMockData;
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [submitMode, setSubmitMode] = useState<"draft" | "sent">("draft");
  const [form, setForm] = useState<NewPatientFormState>({
    name: "",
    service: "",
    shade: "",
    notes: "",
    files: null,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const notifyCasesUpdated = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("cases-updated"));
  };

  useEffect(() => {
    const load = async () => {
      const user = await getUser();
      setUserId(user?.id ?? null);
    };
    void load();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!userId) {
      setMessage("Not authenticated.");
      return;
    }
    setSubmitting(true);
    if (isMock) {
      const patientId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `pat-${Date.now()}`;
      addPatient({
        id: patientId,
        name: form.name,
        service: form.service,
        shade: form.shade,
        notes: form.notes,
        status: submitMode,
        created_by: userId,
        created_at: new Date().toISOString(),
      });
      if (form.files && form.files.length > 0) {
        for (const file of Array.from(form.files)) {
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
            patient_id: patientId,
            file_url: url,
            file_name: file.name,
            uploaded_at: new Date().toISOString(),
          });
        }
      }
      setSubmitting(false);
      setMessage("Case created successfully (mock data).");
      setForm({ name: "", service: "", shade: "", notes: "", files: null });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      notifyCasesUpdated();
      return;
    }

    if (!supabase) {
      setSubmitting(false);
      setMessage("Supabase is not configured.");
      return;
    }

    // 1) insert patient
    const { data: pat, error: patErr } = await supabase
      .from("lab_patients")
      .insert([
        {
          name: form.name,
          service: form.service,
          shade: form.shade,
          notes: form.notes,
          status: submitMode,
          created_by: userId,
        },
      ])
      .select("id")
      .single();
    if (patErr || !pat) {
      setSubmitting(false);
      setMessage(patErr?.message ?? "Failed to create patient");
      return;
    }

    // 2) upload files to bucket and create lab_files rows
    if (form.files && form.files.length > 0) {
      const fileArray = Array.from(form.files);
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        setMessage(`Uploading file ${i + 1} of ${fileArray.length}...`);

        const path = `${pat.id}/${Date.now()}-${file.name}`;
        const { data: uploadData, error: upErr } = await supabase.storage
          .from("lab_files")
          .upload(path, file, {
            upsert: false,
            cacheControl: "3600",
          });

        if (upErr) {
          setSubmitting(false);
          setMessage(
            `Upload failed: ${upErr.message}. Make sure the 'lab_files' storage bucket exists and is public.`
          );
          console.error("Upload error:", upErr);
          return;
        }

        const { data: pub } = supabase.storage
          .from("lab_files")
          .getPublicUrl(path);
        const { error: insertErr } = await supabase.from("lab_files").insert([
          {
            patient_id: pat.id,
            file_url: pub.publicUrl,
            file_name: file.name,
          },
        ]);
        if (insertErr) {
          setSubmitting(false);
          setMessage(`Failed to save file info: ${insertErr.message}`);
          console.error("Insert error:", insertErr);
          return;
        }
      }
    }

    setSubmitting(false);
    setMessage("Case created successfully.");
    setForm({ name: "", service: "", shade: "", notes: "", files: null });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    notifyCasesUpdated();
  };

  const acceptTypes =
    ".jpg,.jpeg,.png,.gif,.webp,.pdf,.dcm,.stl,.ply,.obj,.3mf,.zip";

  const buildFileList = (files: File[]): FileList | null => {
    try {
      const dt = new DataTransfer();
      files.forEach((f) => dt.items.add(f));
      return dt.files;
    } catch {
      // Fallback when DataTransfer constructor is not available
      return files.length ? (files as unknown as FileList) : null;
    }
  };

  const onDropFiles = (dropped: FileList) => {
    const existing = form.files ? Array.from(form.files) : [];
    const incoming = Array.from(dropped);
    const merged = [...existing, ...incoming];
    setForm((s) => ({ ...s, files: buildFileList(merged) }));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer?.files?.length) {
      onDropFiles(e.dataTransfer.files);
    }
  };

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      {message ? <p className="text-sm">{message}</p> : null}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm">Patient name</label>
          <input
            value={form.name}
            onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
            required
            className="w-full rounded-md border px-3 py-2 bg-background"
            placeholder="John Doe"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm">Service</label>
          <input
            value={form.service}
            onChange={(e) =>
              setForm((s) => ({ ...s, service: e.target.value }))
            }
            required
            className="w-full rounded-md border px-3 py-2 bg-background"
            placeholder="Crown, Veneer, ..."
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm">Shade</label>
          <input
            value={form.shade}
            onChange={(e) => setForm((s) => ({ ...s, shade: e.target.value }))}
            className="w-full rounded-md border px-3 py-2 bg-background"
            placeholder="A2, BL3, ..."
          />
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className="text-sm">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
            className="w-full min-h-24 rounded-md border px-3 py-2 bg-background"
            placeholder="Add lab instructions, special notes..."
          />
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className="text-sm">
            Attach files (multiple, drag & drop)
          </label>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`mt-1 flex flex-col items-center justify-center gap-2 rounded-md border px-3 py-6 text-center cursor-pointer ${
              dragActive ? "border-primary bg-primary/5" : "bg-background"
            }`}
          >
            <p className="text-xs">
              Drag & drop files here, or{" "}
              <span className="text-primary underline">browse</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Accepted: images, PDF, DICOM, STL/PLY/OBJ/3MF, ZIP
            </p>
            {form.files && form.files.length ? (
              <p className="text-xs">{form.files.length} file(s) selected</p>
            ) : null}
            <input
              type="file"
              ref={fileInputRef}
              multiple
              onChange={(e) =>
                setForm((s) => ({ ...s, files: e.target.files }))
              }
              className="hidden"
              accept={acceptTypes}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Hold Ctrl/Cmd to select multiple.
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          onClick={() => setSubmitMode("draft")}
          disabled={submitting}
          className="rounded-md border px-4 py-2 disabled:opacity-50 flex items-center gap-2"
        >
          {submitting && submitMode === "draft" ? (
            <>
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
              Saving…
            </>
          ) : (
            "Save as draft"
          )}
        </button>
        <button
          type="submit"
          onClick={() => setSubmitMode("sent")}
          disabled={submitting}
          className="rounded-md bg-primary text-primary-foreground px-4 py-2 disabled:opacity-50 flex items-center gap-2"
        >
          {submitting && submitMode === "sent" ? (
            <>
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
              Sending…
            </>
          ) : (
            "Send to lab"
          )}
        </button>
      </div>
    </form>
  );
}
