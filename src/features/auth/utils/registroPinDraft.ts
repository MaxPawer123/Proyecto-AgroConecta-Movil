export type RegistroPinDraft = {
  nombre: string;
  apellido: string;
  telefono: string;
  departamento: string;
  municipio: string;
  comunidad: string;
};

let registroPinDraft: RegistroPinDraft | null = null;

export function guardarRegistroPinDraft(draft: RegistroPinDraft) {
  registroPinDraft = draft;
}

export function obtenerRegistroPinDraft() {
  return registroPinDraft;
}

export function limpiarRegistroPinDraft() {
  registroPinDraft = null;
}