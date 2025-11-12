export type MockUser = {
  id: string;
  email: string;
  password: string;
  role: "mineers" | "lab";
};

export type MockPatient = {
  id: string;
  name: string;
  service: string;
  shade: string;
  notes: string | null;
  status: "draft" | "sent" | "done" | "finished";
  created_by: string;
  created_at: string;
};

export type MockFile = {
  id: string;
  patient_id: string;
  file_url: string;
  file_name: string;
  uploaded_at: string;
};

export const mockUsers: MockUser[] = [
  {
    id: "user-mineers",
    email: "mineers@example.com",
    password: "password",
    role: "mineers",
  },
  {
    id: "user-lab",
    email: "lab@example.com",
    password: "password",
    role: "lab",
  },
];

export const initialMockPatients: MockPatient[] = [
  {
    id: "pat-001",
    name: "Jane Smith",
    service: "Zirconia Crown",
    shade: "A2",
    notes: "Deliver before 15th. Requires high translucency.",
    status: "sent",
    created_by: "user-mineers",
    created_at: new Date("2024-09-28T10:00:00Z").toISOString(),
  },
  {
    id: "pat-002",
    name: "Miguel Alvarez",
    service: "E-max Veneers",
    shade: "BL3",
    notes: "8 veneers. Provide mock-up photos.",
    status: "draft",
    created_by: "user-mineers",
    created_at: new Date("2024-10-02T14:30:00Z").toISOString(),
  },
  {
    id: "pat-003",
    name: "Sara Lee",
    service: "Implant Crown",
    shade: "A1",
    notes: "Check occlusion on delivery.",
    status: "done",
    created_by: "user-mineers",
    created_at: new Date("2024-10-05T09:15:00Z").toISOString(),
  },
];

export const initialMockFiles: MockFile[] = [
  {
    id: "file-001",
    patient_id: "pat-001",
    file_url: "https://placehold.co/600x400?text=XRAY+A",
    file_name: "jane-smith-xray.png",
    uploaded_at: new Date("2024-09-28T11:00:00Z").toISOString(),
  },
  {
    id: "file-002",
    patient_id: "pat-002",
    file_url: "https://placehold.co/600x400?text=SMILE+SCAN",
    file_name: "miguel-scan.stl",
    uploaded_at: new Date("2024-10-02T15:00:00Z").toISOString(),
  },
  {
    id: "file-003",
    patient_id: "pat-003",
    file_url: "https://placehold.co/600x400?text=PHOTO",
    file_name: "sara-portrait.jpg",
    uploaded_at: new Date("2024-10-05T09:30:00Z").toISOString(),
  },
];
