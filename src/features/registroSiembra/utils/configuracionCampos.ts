import {
  CampoFormularioConfig,
  ConfiguracionRubroSiembra,
  RubroSiembra,
  SeccionCamposConfig,
} from '../types';

const TIPOS_QUINUA = [
  'Quinua Real Blanca',
  'Quinua Roja Pasankalla',
  'Quinua Negra Collana ',
  'Quinua Toledo',
  'Quinua Jacha Grano',
  'Quinua Pandela',
  'Otros',
];

const TIPOS_HORTALIZA = [
   'Papa',
   'Cebolla', 
   'Zanahoria', 
   'Beterraga', 
   'Haba', 
   'Nabo', 
   'Otros'
];

const camposBase = {
  nombre: {
    key: 'nombre',
    tipo: 'text',
    label: 'Nombre/Codigo de la Parcela',
    hint: 'Identificador unico para tu lote',
  } satisfies CampoFormularioConfig,
  ubicacionQuinua: {
    key: 'ubicacion',
    tipo: 'gps',
    label: 'Ubicacion GPS',
    placeholder: 'Toca para capturar la ubicacion GPS de la parcela',
    hint: 'Se guarda localmente con coordenadas y se sincroniza automaticamente cuando hay internet.',
  } satisfies CampoFormularioConfig,
  ubicacionHortalizas: {
    key: 'ubicacion',
    tipo: 'gps',
    label: 'Ubicacion GPS',
    placeholder: 'Toca para capturar la ubicacion GPS de la parcela',
    hint: 'Se guarda localmente con coordenadas y se sincroniza automaticamente cuando hay internet.',
  } satisfies CampoFormularioConfig,
  fotoTerreno: {
    key: 'fotoTerreno',
    tipo: 'photo',
    label: 'Foto del Terreno / Inicio (Opcional)',
  } satisfies CampoFormularioConfig,
  superficie: {
    key: 'superficie',
    tipo: 'number',
    label: 'Superficie de la parcela',
    placeholder: '2.5',
    hint: 'Elige la unidad y escribe el valor del area dela parcela.',
  } satisfies CampoFormularioConfig,
  fechaSiembra: {
    key: 'fechaSiembra',
    tipo: 'date',
    label: 'Fecha de Siembra',
    placeholder: 'dd/mm/aaaa',
    tituloCalendario: 'Selecciona una fecha',
  } satisfies CampoFormularioConfig,
  fechaCosecha: {
    key: 'fechaCosecha',
    tipo: 'date',
    label: 'Fecha Estimada de Cosecha',
    placeholder: 'dd/mm/aaaa',
    tituloCalendario: 'Selecciona una fecha',
  } satisfies CampoFormularioConfig,
};

const construirSecciones = (campos: {
  tipoCultivo: CampoFormularioConfig;
  ubicacion: CampoFormularioConfig;
  nombrePlaceholder: string;
}): SeccionCamposConfig[] => [
  {
    id: 'nombre',
    columnas: [
      {
        ...camposBase.nombre,
        placeholder: campos.nombrePlaceholder,
      },
    ],
  },
  {
    id: 'tipo-cultivo',
    columnas: [campos.tipoCultivo],
  },
  {
    id: 'ubicacion',
    columnas: [campos.ubicacion],
  },
  {
    id: 'foto',
    columnas: [camposBase.fotoTerreno],
  },
  {
    id: 'superficie',
    columnas: [camposBase.superficie],
  },
  {
    id: 'fechas',
    columnas: [camposBase.fechaSiembra, camposBase.fechaCosecha],
  },
];

export const configuracionCamposPorRubro: Record<RubroSiembra, ConfiguracionRubroSiembra> = {
  quinua: {
    tituloTipoCultivo: 'Variedades de Quinua',
    mensajeBotonGuardar: 'Crear parcela y Comenzar',
    secciones: construirSecciones({
      nombrePlaceholder: 'Ej: Parcela 1 - Quinua Real',
      tipoCultivo: {
        key: 'tipoCultivo',
        tipo: 'select',
        label: 'Variedades de Quinua',
        placeholder: 'Seleccionar tipos de cultivo...',
        tituloSelector: 'Variedades de Quinua',
        opciones: TIPOS_QUINUA,
      },
      ubicacion: camposBase.ubicacionQuinua,
    }),
  },
  hortalizas: {
    tituloTipoCultivo: 'Tipo de Hortaliza',
    mensajeBotonGuardar: 'Crear parcela y Comenzar',
    secciones: construirSecciones({
      nombrePlaceholder: 'Parcela 1 - Zanahoria',
      tipoCultivo: {
        key: 'tipoCultivo',
        tipo: 'select',
        label: 'Variedades de Hortaliza',
        placeholder: 'Seleccionar tipos de cultivo...',
        tituloSelector: 'Variedades de Hortaliza',
        opciones: TIPOS_HORTALIZA,
      },
      ubicacion: camposBase.ubicacionHortalizas,
    }),
  },
};
