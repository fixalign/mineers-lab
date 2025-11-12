import { initialMockFiles, initialMockPatients, type MockFile, type MockPatient } from './mockData'

let patients = [...initialMockPatients]
let files = [...initialMockFiles]

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

export const listPatientsForUser = (userId: string) => clone(patients.filter((p) => p.created_by === userId))

export const listAllPatients = () => clone(patients)

export const listFilesForPatient = (patientId: string) => clone(files.filter((f) => f.patient_id === patientId))

export const listFiles = () => clone(files)

export const addPatient = (patient: MockPatient) => {
	patients = [patient, ...patients]
	return clone(patient)
}

export const addFile = (file: MockFile) => {
	files = [file, ...files]
	return clone(file)
}

export const deleteFile = (id: string) => {
	files = files.filter((f) => f.id !== id)
}

export const resetMockStore = () => {
	patients = [...initialMockPatients]
	files = [...initialMockFiles]
}

export const updatePatient = (id: string, patch: Partial<MockPatient>) => {
	patients = patients.map((p) => (p.id === id ? { ...p, ...patch } : p))
	return clone(patients.find((p) => p.id === id)!)
}

export const deletePatient = (id: string) => {
	patients = patients.filter((p) => p.id !== id)
	files = files.filter((f) => f.patient_id !== id)
}

export const getPatientById = (id: string) => clone(patients.find((p) => p.id === id) || null)



