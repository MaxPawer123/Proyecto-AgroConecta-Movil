import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { iniciarSincronizacionAutomaticaSiembras } from '@/src/modules/siembra/siembra.sync';
import { saveDataLocally } from '@/src/services/syncService';
import { FormRegistroSiembra, UseRegistroSiembraParams, UseRegistroSiembraResult } from '../types';

const formInicial: FormRegistroSiembra = {
  nombre: '',
  tipoCultivo: '',
  ubicacion: '',
  superficie: '',
  fechaSiembra: '',
  fechaCosecha: '',
};

const superficieUnidadInicial: 'ha' | 'm2' = 'ha';
const METROS_CUADRADOS_POR_HECTAREA = 10000;
const OPCION_TIPO_CULTIVO_OTROS = 'Otros';

const formatearFecha = (fechaIso: string): string => {
  if (!fechaIso) return '';
  const [anio, mes, dia] = fechaIso.split('-');
  if (!anio || !mes || !dia) return '';
  return `${dia}/${mes}/${anio}`;
};

const parsearFecha = (valor: string): string => {
  if (!valor) return '';
  const partes = valor.split('/');
  if (partes.length !== 3) return '';

  const dia = Number(partes[0]);
  const mes = Number(partes[1]);
  const anio = Number(partes[2]);

  if (!dia || !mes || !anio) return '';
  return `${anio}-${`${mes}`.padStart(2, '0')}-${`${dia}`.padStart(2, '0')}`;
};

const formatearNumeroGps = (valor: number): string => valor.toFixed(6);

const obtenerEtiquetaOtrosPorRubro = (rubro: 'quinua' | 'hortalizas' | 'papa'): string => {
  if (rubro === 'quinua') return 'Quinua - Otros';
  if (rubro === 'papa') return 'Papa - Otros';
  return 'Hortaliza - Otros';
};

const normalizarSuperficie = (valor: string, unidad: 'ha' | 'm2'): number => {
  const texto = valor.trim().replace(',', '.');
  const superficieIngresada = Number(texto);

  if (!Number.isFinite(superficieIngresada)) {
    return Number.NaN;
  }

  return unidad === 'm2' ? superficieIngresada / METROS_CUADRADOS_POR_HECTAREA : superficieIngresada;
};

const subirFotoACloudinary = async (localUri: string): Promise<string | null> => {
  try {
    const cloudName = 'dgdn58hpw';
    const apiKey = '272864567725746';
    
    // REEMPLAZA ESTE PLACEHOLDER CON EL NOMBRE DE TU PRESET UNSIGNED CONFIGURADO EN CLOUDINARY
    const uploadPreset = 'yapuaroma'; // Cambia esto por tu preset rea

    const formData = new FormData();
    formData.append('file', {
      uri: localUri,
      type: 'image/jpeg',
      name: `siembra_${Date.now()}.jpg`,
    } as any);

    formData.append('upload_preset', uploadPreset);
    formData.append('api_key', apiKey);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Respuesta HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    if (data && data.secure_url) {
      console.log("🔗 URL generada exitosamente en Cloudinary:", data.secure_url);
      return data.secure_url;
    }

    throw new Error('La respuesta del servidor no incluyó el campo "secure_url".');
  } catch (error: any) {
    console.error("❌ Error al subir la foto a Cloudinary:", error?.message || error);
    return null;
  }
};

const construirTextoUbicacionGps = async (latitude: number, longitude: number): Promise<string> => {
  const base = `GPS: ${formatearNumeroGps(latitude)}, ${formatearNumeroGps(longitude)}`;

  try {
    const resultados = await Location.reverseGeocodeAsync({ latitude, longitude });
    const primerResultado = resultados[0];
    const partes = [primerResultado?.name, primerResultado?.city, primerResultado?.region].filter(Boolean);

    if (partes.length > 0) {
      return `${base} | ${partes.join(', ')}`;
    }
  } catch {
    // Si no hay geocodificacion inversa disponible, conservamos solo coordenadas.
  }

  return base;
};

export function useRegistroSiembra({
  visible,
  onClose,
  onGuardarExitoso,
  rubro,
}: UseRegistroSiembraParams): UseRegistroSiembraResult {
  const [form, setForm] = useState<FormRegistroSiembra>(formInicial);
  const [fotoTerreno, setFotoTerreno] = useState<string | null>(null);
  const [fotoPendienteCamara, setFotoPendienteCamara] = useState<string | null>(null);
  const [superficieUnidad, setSuperficieUnidad] = useState<'ha' | 'm2'>(superficieUnidadInicial);
  const [modalOpcionesOpen, setModalOpcionesOpen] = useState(false);
  const [modalCalendarioOpen, setModalCalendarioOpen] = useState(false);
  const [modalCultivosOpen, setModalCultivosOpen] = useState(false);
  const [cultivosSeleccionados, setCultivosSeleccionados] = useState<string[]>([]);
  const [variedadOtro, setVariedadOtro] = useState('');
  const [campoOpcionesActivo, setCampoOpcionesActivo] = useState<'tipoCultivo' | 'ubicacion' | null>(null);
  const [campoFechaActivo, setCampoFechaActivo] = useState<'fechaSiembra' | 'fechaCosecha' | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [cargandoUbicacionGps, setCargandoUbicacionGps] = useState(false);
  const [errorUbicacionGps, setErrorUbicacionGps] = useState<string | null>(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  useEffect(() => {
    iniciarSincronizacionAutomaticaSiembras();
  }, []);

  const actualizarCampo = useCallback((campo: keyof FormRegistroSiembra, valor: string) => {
    setForm((anterior) => ({ ...anterior, [campo]: valor }));
  }, []);

  const actualizarSuperficieUnidad = useCallback((unidad: 'ha' | 'm2') => {
    setSuperficieUnidad(unidad);
  }, []);

  const capturarUbicacionGps = useCallback(async () => {
    setCargandoUbicacionGps(true);
    setErrorUbicacionGps(null);

    try {
      const permiso = await Location.requestForegroundPermissionsAsync();
      if (permiso.status !== 'granted') {
        const mensaje = 'Debes permitir el acceso a la ubicacion para capturar el GPS del lote.';
        setErrorUbicacionGps(mensaje);
        Alert.alert('Permiso requerido', mensaje);
        return;
      }

      const serviciosActivos = await Location.hasServicesEnabledAsync();
      if (!serviciosActivos) {
        const mensaje = 'Activa el GPS del dispositivo para capturar la ubicacion del lote.';
        setErrorUbicacionGps(mensaje);
        Alert.alert('GPS desactivado', mensaje);
        return;
      }

      const posicion = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const textoUbicacion = await construirTextoUbicacionGps(
        posicion.coords.latitude,
        posicion.coords.longitude
      );

      actualizarCampo('ubicacion', textoUbicacion);
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'No se pudo capturar la ubicacion GPS.';
      setErrorUbicacionGps(mensaje);
      Alert.alert('Error de ubicacion', mensaje);
    } finally {
      setCargandoUbicacionGps(false);
    }
  }, [actualizarCampo]);

  useEffect(() => {
    if (!visible) return;
    void capturarUbicacionGps();
  }, [capturarUbicacionGps, visible]);

  useEffect(() => {
    if (!visible) {
      setFotoPendienteCamara(null);
    }
  }, [visible]);

  const seleccionarImagen = async (origen: 'camera' | 'gallery') => {
    const permiso =
      origen === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permiso.granted) {
      Alert.alert(
        'Permiso requerido',
        origen === 'camera'
          ? 'Necesitas permitir acceso a la camara para tomar una foto.'
          : 'Necesitas permitir acceso a la galeria para elegir una imagen.'
      );
      return;
    }

    const resultado =
      origen === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: false,
            aspect: [4, 3],
            quality: 0.7,
            base64: true, // ← Activa la codificación Base64 de la imagen
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.7,
            base64: true, // ← Activa la codificación Base64 de la imagen
          });

    if (!resultado.canceled && resultado.assets && resultado.assets.length > 0) {
      const imagenUri = resultado.assets[0].uri;

      if (origen === 'camera') {
        setFotoPendienteCamara(imagenUri);
        return;
      }

      // Subida directa desde Galería
      setSubiendoFoto(true);
      try {
        const secureUrl = await subirFotoACloudinary(imagenUri);
        if (secureUrl) {
          setFotoTerreno(secureUrl);
        } else {
          // Fallback a URI local en caso de error/offline
          setFotoTerreno(imagenUri);
        }
      } catch {
        setFotoTerreno(imagenUri);
      } finally {
        setSubiendoFoto(false);
      }
    }
  };

  const guardarFotoPendiente = async () => {
    if (!fotoPendienteCamara) return;
    
    // Subida directa desde Cámara al confirmar
    setSubiendoFoto(true);
    try {
      const secureUrl = await subirFotoACloudinary(fotoPendienteCamara);
      if (secureUrl) {
        setFotoTerreno(secureUrl);
      } else {
        // Fallback a URI local
        setFotoTerreno(fotoPendienteCamara);
      }
    } catch {
      setFotoTerreno(fotoPendienteCamara);
    } finally {
      setSubiendoFoto(false);
      setFotoPendienteCamara(null);
    }
  };

  const descartarFotoPendiente = () => {
    setFotoPendienteCamara(null);
  };

  const abrirSelectorOpciones = (campo: 'tipoCultivo' | 'ubicacion') => {
    setCampoOpcionesActivo(campo);
    setModalOpcionesOpen(true);
  };

  const abrirSelectorCultivos = useCallback(() => {
    setModalCultivosOpen(true);
  }, []);

  const cerrarSelectorCultivos = useCallback(() => {
    setModalCultivosOpen(false);
  }, []);

  const toggleCultivoSeleccionado = useCallback((cultivo: string) => {
    setCultivosSeleccionados((anterior) => {
      const existe = anterior.includes(cultivo);
      const siguiente = existe ? anterior.filter((item) => item !== cultivo) : [...anterior, cultivo];
      setForm((previo) => ({ ...previo, tipoCultivo: siguiente.join(', ') }));

      if (cultivo === OPCION_TIPO_CULTIVO_OTROS && existe) {
        setVariedadOtro('');
      }

      return siguiente;
    });
  }, []);

  const actualizarVariedadOtro = useCallback((valor: string) => {
    setVariedadOtro(valor);
  }, []);

  const confirmarSeleccionCultivos = useCallback((): boolean => {
    const tieneOtros = cultivosSeleccionados.includes(OPCION_TIPO_CULTIVO_OTROS);
    const variedadPersonalizada = variedadOtro.trim();

    if (tieneOtros && variedadPersonalizada) {
      const siguiente = cultivosSeleccionados
        .filter((item) => item !== OPCION_TIPO_CULTIVO_OTROS)
        .concat(variedadPersonalizada);

      setCultivosSeleccionados(siguiente);
      setForm((previo) => ({ ...previo, tipoCultivo: siguiente.join(', ') }));
    }

    setModalCultivosOpen(false);
    return true;
  }, [cultivosSeleccionados, rubro, variedadOtro]);

  const removerCultivoSeleccionado = useCallback((cultivo: string) => {
    setCultivosSeleccionados((anterior) => {
      const siguiente = anterior.filter((item) => item !== cultivo);
      setForm((previo) => ({ ...previo, tipoCultivo: siguiente.join(', ') }));
      return siguiente;
    });
  }, []);

  const cerrarSelectorOpciones = () => {
    setModalOpcionesOpen(false);
    setCampoOpcionesActivo(null);
  };

  const abrirSelectorFecha = (campo: 'fechaSiembra' | 'fechaCosecha') => {
    setCampoFechaActivo(campo);
    setModalCalendarioOpen(true);
  };

  const cerrarSelectorFecha = () => {
    setModalCalendarioOpen(false);
  };

  const seleccionarFecha = (dateString: string) => {
    if (!campoFechaActivo) return;
    actualizarCampo(campoFechaActivo, formatearFecha(dateString));
    setModalCalendarioOpen(false);
  };

  const limpiarFormulario = () => {
    setForm(formInicial);
    setFotoTerreno(null);
    setFotoPendienteCamara(null);
    setSuperficieUnidad(superficieUnidadInicial);
    setCultivosSeleccionados([]);
    setVariedadOtro('');
    setModalCultivosOpen(false);
    setCampoFechaActivo(null);
    setCampoOpcionesActivo(null);
    setErrorUbicacionGps(null);
  };

  const crearLote = async () => {
    if (guardando) return;
    const nombre = form.nombre.trim();
    const superficie = normalizarSuperficie(form.superficie, superficieUnidad);
    const fechaSiembraIso = parsearFecha(form.fechaSiembra);
    const fechaCosechaIso = parsearFecha(form.fechaCosecha);
    const cultivosArrayBase = cultivosSeleccionados.length > 0
      ? cultivosSeleccionados
      : form.tipoCultivo.trim()
        ? [form.tipoCultivo.trim()]
        : [];
    const cultivosArray = cultivosArrayBase.map((cultivo) => {
      if (cultivo === OPCION_TIPO_CULTIVO_OTROS) {
        const variedadPersonalizada = variedadOtro.trim();
        return variedadPersonalizada || obtenerEtiquetaOtrosPorRubro(rubro);
      }

      return cultivo;
    });
    const cultivosString = cultivosArray.join(', ');

    if (!nombre || !cultivosString || !form.ubicacion || !form.superficie.trim() || !fechaSiembraIso || !fechaCosechaIso) {
      Alert.alert('Datos incompletos', 'Completa nombre, cultivo(s), ubicacion GPS, superficie y fechas.');
      return;
    }

    if (!Number.isFinite(superficie) || superficie <= 0) {
      Alert.alert('Superficie invalida', 'La superficie debe ser un numero mayor a 0.');
      return;
    }

    setGuardando(true);

    try {
      await saveDataLocally({
        rubro: rubro === 'quinua' ? 'QUINUA' : rubro === 'papa' ? 'PAPA' : 'HORTALIZA',
        nombreLote: nombre,
        tipoCultivo: cultivosString,
        cultivos: cultivosArray,
        ubicacion: form.ubicacion,
        superficie,
        fechaSiembraIso,
        fechaCosechaIso,
        fotoTerrenoUri: fotoTerreno,
      });

      Alert.alert('Éxito', 'Guardado localmente');

      limpiarFormulario();
      setGuardando(false);
      onClose();

      if (onGuardarExitoso) {
        void onGuardarExitoso();
      }

    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'No se pudo guardar la siembra';
      Alert.alert('Error', mensaje);
    } finally {
      setGuardando(false);
    }
  };

  const fechaSeleccionadaISO = useMemo(() => {
    if (!campoFechaActivo) return '';
    return parsearFecha(form[campoFechaActivo]);
  }, [campoFechaActivo, form]);

  return {
    form,
    superficieUnidad,
    fotoTerreno,
    fotoPendienteCamara,
    guardando,
    cargandoUbicacionGps,
    errorUbicacionGps,
    subiendoFoto,
    modalOpcionesOpen,
    modalCalendarioOpen,
    modalCultivosOpen,
    cultivosSeleccionados,
    variedadOtro,
    campoFechaActivo,
    campoOpcionesActivo,
    actualizarCampo,
    actualizarSuperficieUnidad,
    capturarUbicacionGps,
    abrirSelectorOpciones,
    cerrarSelectorOpciones,
    abrirSelectorCultivos,
    cerrarSelectorCultivos,
    toggleCultivoSeleccionado,
    actualizarVariedadOtro,
    confirmarSeleccionCultivos,
    removerCultivoSeleccionado,
    abrirSelectorFecha,
    cerrarSelectorFecha,
    seleccionarFecha,
    seleccionarImagen,
    guardarFotoPendiente,
    descartarFotoPendiente,
    fechaSeleccionadaISO,
    crearLote,
  };
}
