import { requestJson, type ApiResponse } from '../http';

export type AuthRegisterPayload = {
  nombre: string;
  apellido: string;
  telefono: string;
  departamento: string;
  municipio: string;
  comunidad: string;
  pin?: string;
};

export type AuthUserApi = {
  id_usuario: number;
  id_productor: number;
  nombre: string;
  apellido: string;
  telefono: string;
  rol: string;
  estado: string;
  departamento: string;
  municipio: string;
  comunidad: string;
  fecha_registro: string;
};

export type AuthLoginPayload = {
  telefono: string;
  pin: string;
};

export async function registrarProductorApi(payload: AuthRegisterPayload): Promise<{ token?: string; data: AuthUserApi }> {
  const response = await requestJson<ApiResponse<AuthUserApi> & { token?: string }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!response?.success || !response.data) {
    throw new Error(response?.message || 'No se pudo registrar el productor en el servidor');
  }

  return {
    token: response.token,
    data: response.data,
  };
}

export async function iniciarSesionApi(payload: AuthLoginPayload): Promise<{ token: string; data: AuthUserApi }> {
  const response = await requestJson<ApiResponse<AuthUserApi> & { token: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!response?.success || !response.token || !response.data) {
    throw new Error(response?.message || 'Credenciales inválidas');
  }

  return {
    token: response.token,
    data: response.data,
  };
}

export type AuthPerfilUpdatePayload = {
  nombre: string;
  apellido: string;
  telefono: string;
  departamento: string;
  municipio: string;
  comunidad: string;
};

export async function actualizarPerfilApi(payload: AuthPerfilUpdatePayload): Promise<AuthUserApi> {
  const response = await requestJson<ApiResponse<AuthUserApi>>('/api/usuario/perfil', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

  if (!response?.success || !response.data) {
    throw new Error(response?.message || 'No se pudo actualizar el perfil en el servidor');
  }

  return response.data;
}

