export type RubroSiembra = 'quinua' | 'hortalizas';

export type CampoFormularioKey =
	| 'nombre'
	| 'tipoCultivo'
	| 'ubicacion'
	| 'superficie'
	| 'fechaSiembra'
	| 'fechaCosecha'
	| 'fotoTerreno';

export type TipoCampoFormulario = 'text' | 'number' | 'select' | 'date' | 'photo' | 'gps';

export interface FormRegistroSiembra {
	nombre: string;
	tipoCultivo: string;
	ubicacion: string;
	superficie: string;
	fechaSiembra: string;
	fechaCosecha: string;
}

export interface CampoFormularioConfig {
	key: CampoFormularioKey;
	tipo: TipoCampoFormulario;
	label: string;
	placeholder?: string;
	hint?: string;
	sufijo?: string;
	opciones?: string[];
	tituloSelector?: string;
	tituloCalendario?: string;
}

export interface SeccionCamposConfig {
	id: string;
	columnas: CampoFormularioConfig[];
}

export interface ConfiguracionRubroSiembra {
	tituloTipoCultivo: string;
	mensajeBotonGuardar: string;
	secciones: SeccionCamposConfig[];
}

export interface ModalRegistroSiembraProps {
	visible: boolean;
	onClose: () => void;
	onGuardarExitoso?: () => void | Promise<void>;
	rubro: RubroSiembra;
}

export interface UseRegistroSiembraParams {
	visible: boolean;
	onClose: () => void;
	onGuardarExitoso?: () => void | Promise<void>;
	rubro: RubroSiembra;
}

export interface UseRegistroSiembraResult {
	form: FormRegistroSiembra;
	superficieUnidad: 'ha' | 'm2';
	fotoTerreno: string | null;
	fotoPendienteCamara: string | null;
	guardando: boolean;
	cargandoUbicacionGps: boolean;
	errorUbicacionGps: string | null;
	modalOpcionesOpen: boolean;
	modalCalendarioOpen: boolean;
	campoFechaActivo: 'fechaSiembra' | 'fechaCosecha' | null;
	campoOpcionesActivo: 'tipoCultivo' | 'ubicacion' | null;
	actualizarCampo: (campo: keyof FormRegistroSiembra, valor: string) => void;
	actualizarSuperficieUnidad: (unidad: 'ha' | 'm2') => void;
	capturarUbicacionGps: () => Promise<void>;
	abrirSelectorOpciones: (campo: 'tipoCultivo' | 'ubicacion') => void;
	cerrarSelectorOpciones: () => void;
	abrirSelectorFecha: (campo: 'fechaSiembra' | 'fechaCosecha') => void;
	cerrarSelectorFecha: () => void;
	seleccionarFecha: (dateString: string) => void;
	seleccionarImagen: (origen: 'camera' | 'gallery') => Promise<void>;
	guardarFotoPendiente: () => void;
	descartarFotoPendiente: () => void;
	fechaSeleccionadaISO: string;
	crearLote: () => Promise<void>;
}
