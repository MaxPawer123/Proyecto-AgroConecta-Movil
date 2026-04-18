export type RubroType = 'quinua' | 'hortalizas';

export type LoteEstadoSync = 'SINCRONIZADO' | 'PENDIENTE' | string;

export interface LoteViewModel {
	key: string;
	id: number;
	idLocal: number | null;
	idServidor: number | null;
	codigo: string;
	nombre: string;
	tipoProducto: string;
	imagen: string;
	imagenRemota: string | null;
	area: number;
	comunidad: string;
	fechaSiembra: string;
	cosechaEstimada: string;
	fechaSiembraIso: string;
	fechaCosechaIso: string;
	rendimientoEstimado: number;
	precioVentaEst: number;
	progreso: number;
	estado: string;
	estadoColor: string;
	faseActual: string;
	estadoRaw: string;
	inversion: number;
	ingresoEstimado: number;
	proyeccion: number;
	mostrarCosecha: boolean;
}

export interface FormEdicionLote {
	nombre: string;
	tipoCultivo: string;
	ubicacion: string;
	superficie: string;
	fechaSiembraIso: string;
	fechaCosechaIso: string;
	fotoSiembra: string;
}

export interface LotesStats {
	lotesActivos: number;
	areaTotal: number;
	inversionTotal: number;
}

export interface RubroConfig {
	rubro: RubroType;
	routeParam: RubroType;
	codePrefix: 'Q' | 'H';
	title: string;
	subtitle: string;
	productLabel: string;
	defaultProductName: string;
	defaultVariedad: string;
	defaultImage: string;
	fallbackProductoId: number;
	quickSyncedLabel: string;
	quickPendingLabel: string;
	localSyncedLabel: string;
	localPendingLabel: string;
	usesProductCatalogSync: boolean;
	stopAutoSyncOnUnmount: boolean;
}

export interface UseLotesResult {
	lotes: LoteViewModel[];
	stats: LotesStats;
	rubroConfig: RubroConfig;
	modalOpen: boolean;
	setModalOpen: (value: boolean) => void;
	mostrarCalculadora: boolean;
	setMostrarCalculadora: (value: boolean) => void;
	loteSeleccionadoIdServidor: number | null;
	loteSeleccionadoIdLocal: number | null;
	setLoteSeleccionadoIdServidor: (value: number | null) => void;
	setLoteSeleccionadoIdLocal: (value: number | null) => void;
	modalEditarOpen: boolean;
	setModalEditarOpen: (value: boolean) => void;
	guardandoEdicion: boolean;
	formEdicion: FormEdicionLote;
	setFormEdicion: (value: FormEdicionLote) => void;
	abrirModalEdicion: (lote: LoteViewModel) => void;
	guardarEdicionLote: () => Promise<void>;
	eliminarLote: (lote: LoteViewModel) => void;
	cargarLotesLocalesInmediato: () => Promise<void>;
	cargarLotesLocales: () => Promise<void>;
	manejarCreacionLote: () => Promise<void>;
	diagnosticoCarga: string;
	mensajeSync: string;
	modalFotoVisible: boolean;
	fotoSeleccionada: string;
	abrirVistaFoto: (uri: string) => void;
	cerrarVistaFoto: () => void;
}

