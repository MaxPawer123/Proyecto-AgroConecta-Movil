import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import {
  iniciarSincronizacionAutomaticaSiembras,
  registrarSiembraOfflineFirst,
} from '@/src/services/siembraStorageSync';
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

const normalizarSuperficie = (valor: string, unidad: 'ha' | 'm2'): number => {
  const texto = valor.trim().replace(',', '.');
  const superficieIngresada = Number(texto);

  if (!Number.isFinite(superficieIngresada)) {
    return Number.NaN;
  }

  return unidad === 'm2' ? superficieIngresada / METROS_CUADRADOS_POR_HECTAREA : superficieIngresada;
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
  const [campoOpcionesActivo, setCampoOpcionesActivo] = useState<'tipoCultivo' | 'ubicacion' | null>(null);
  const [campoFechaActivo, setCampoFechaActivo] = useState<'fechaSiembra' | 'fechaCosecha' | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [cargandoUbicacionGps, setCargandoUbicacionGps] = useState(false);
  const [errorUbicacionGps, setErrorUbicacionGps] = useState<string | null>(null);

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
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.7,
          });

    if (!resultado.canceled && resultado.assets && resultado.assets.length > 0) {
      if (origen === 'camera') {
        setFotoPendienteCamara(resultado.assets[0].uri);
        return;
      }

      setFotoTerreno(resultado.assets[0].uri);
    }
  };

  const guardarFotoPendiente = () => {
    if (!fotoPendienteCamara) return;
    setFotoTerreno(fotoPendienteCamara);
    setFotoPendienteCamara(null);
  };

  const descartarFotoPendiente = () => {
    setFotoPendienteCamara(null);
  };

  const abrirSelectorOpciones = (campo: 'tipoCultivo' | 'ubicacion') => {
    setCampoOpcionesActivo(campo);
    setModalOpcionesOpen(true);
  };

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
    setCampoFechaActivo(null);
    setCampoOpcionesActivo(null);
    setErrorUbicacionGps(null);
  };

  const crearLote = async () => {
    const nombre = form.nombre.trim();
    const superficie = normalizarSuperficie(form.superficie, superficieUnidad);
    const fechaSiembraIso = parsearFecha(form.fechaSiembra);
    const fechaCosechaIso = parsearFecha(form.fechaCosecha);

    if (!nombre || !form.tipoCultivo || !form.ubicacion || !form.superficie.trim() || !fechaSiembraIso || !fechaCosechaIso) {
      Alert.alert('Datos incompletos', 'Completa nombre, tipo, ubicacion GPS, superficie y fechas.');
      return;
    }

    if (!Number.isFinite(superficie) || superficie <= 0) {
      Alert.alert('Superficie invalida', 'La superficie debe ser un numero mayor a 0.');
      return;
    }

    setGuardando(true);

    try {
      if (rubro === 'quinua') {
        await registrarSiembraOfflineFirst({
          rubro: 'QUINUA',
          nombreLote: nombre,
          tipoCultivo: form.tipoCultivo,
          ubicacion: form.ubicacion,
          superficie,
          fechaSiembraIso,
          fechaCosechaIso,
          rendimientoEstimado: Math.max(1, superficie * 300),
          precioVentaEstimado: 12,
          fotoTerrenoUri: fotoTerreno,
        });
      } else {
        await registrarSiembraOfflineFirst({
          rubro: 'HORTALIZA',
          nombreLote: nombre,
          tipoCultivo: form.tipoCultivo,
          ubicacion: form.ubicacion,
          superficie,
          fechaSiembraIso,
          fechaCosechaIso,
          rendimientoEstimado: Math.max(1, superficie * 500),
          precioVentaEstimado: 8,
          fotoTerrenoUri: fotoTerreno,
        });
      }

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
    modalOpcionesOpen,
    modalCalendarioOpen,
    campoFechaActivo,
    campoOpcionesActivo,
    actualizarCampo,
    actualizarSuperficieUnidad,
    capturarUbicacionGps,
    abrirSelectorOpciones,
    cerrarSelectorOpciones,
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
