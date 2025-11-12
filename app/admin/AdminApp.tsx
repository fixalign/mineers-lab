"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import PatientForm from "@/components/patient-form";
import PatientTable from "@/components/patient-table";
import { getSession, signOut } from "@/lib/authService";

export default function AdminApp() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const session = await getSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      setRole(session.user.role);
      if (session.user.role !== "mineers") {
        router.replace("/lab");
      }
    };
    void init();
  }, [router]);

  if (role !== "mineers") {
    return null;
  }

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
            {/* <h1 className="text-xl md:text-2xl font-bold">Mineers Dashboard</h1> */}
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
        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border p-4">
            <h2 className="font-medium mb-3">Add new patient/case</h2>
            <PatientForm />
          </div>
          <div className="rounded-lg border p-4">
            <h2 className="font-medium mb-3">Your cases</h2>
            <p className="text-sm text-muted-foreground mb-2">
              Only cases created by you are visible here (RLS).
            </p>
            <PatientTable />
          </div>
        </section>
      </div>
    </div>
  );
}
