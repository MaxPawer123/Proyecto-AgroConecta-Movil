import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import {
  iniciarSincronizacionAutomaticaSiembras,
  registrarSiembraOfflineFirst,
} from '@/src/services/siembraStorageSync';
import { obtenerProductosPorCategoriaApi } from '@/src/services/api';
import { listarProductosLocales, sincronizarProductosPendientes } from '@/src/services/offlineProductsSync';
import { FormRegistroSiembra, UseRegistroSiembraParams, UseRegistroSiembraResult } from '../types';

const CATEGORIA_QUINUA = 'Quinua';
const CATEGORIA_HORTALIZAS = 'Hortalizas';

const formInicial: FormRegistroSiembra = {
  nombre: '',
  tipoCultivo: '',
  ubicacion: '',
  superficie: '',
  fechaSiembra: '',
  fechaCosecha: '',
};

const obtenerProductoHortaliza = (tipoCultivo: string): number => {
  if (tipoCultivo === 'Haba') return 3;
  return 2;
};

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
  const [modalOpcionesOpen, setModalOpcionesOpen] = useState(false);
  const [modalCalendarioOpen, setModalCalendarioOpen] = useState(false);
  const [campoOpcionesActivo, setCampoOpcionesActivo] = useState<'tipoCultivo' | 'ubicacion' | null>(null);
  const [campoFechaActivo, setCampoFechaActivo] = useState<'fechaSiembra' | 'fechaCosecha' | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [cargandoUbicacionGps, setCargandoUbicacionGps] = useState(false);
  const [errorUbicacionGps, setErrorUbicacionGps] = useState<string | null>(null);
  const [idProductoQuinua, setIdProductoQuinua] = useState(1);

  useEffect(() => {
    iniciarSincronizacionAutomaticaSiembras();
  }, []);

  useEffect(() => {
    if (!visible || rubro !== 'quinua') return;

    const resolverProductoQuinua = async () => {
      await sincronizarProductosPendientes().catch(() => {
        // Si no hay internet, usamos catalogo local.
      });

      const [locales, apiQuinua, apiGrano] = await Promise.all([
        listarProductosLocales(),
        obtenerProductosPorCategoriaApi('Quinua').catch(() => []),
        obtenerProductosPorCategoriaApi('Grano').catch(() => []),
      ]);

      const catalogo = [
        ...(Array.isArray(locales) ? locales : []),
        ...(Array.isArray(apiQuinua) ? apiQuinua : []),
        ...(Array.isArray(apiGrano) ? apiGrano : []),
      ];

      const encontradoPorNombre = catalogo.find((producto) =>
        String(producto.nombre ?? '').toLowerCase().includes('quinua')
      );

      const encontradoPorCategoria = catalogo.find((producto) => {
        const categoria = String(producto.categoria ?? '').toLowerCase();
        return categoria === 'quinua' || categoria === 'grano';
      });

      const candidato = encontradoPorNombre || encontradoPorCategoria;
      const id = Number((candidato as any)?.id_producto ?? (candidato as any)?.idLocal ?? 1);
      setIdProductoQuinua(id > 0 ? id : 1);
    };

    void resolverProductoQuinua();
  }, [visible, rubro]);

  const actualizarCampo = useCallback((campo: keyof FormRegistroSiembra, valor: string) => {
    setForm((anterior) => ({ ...anterior, [campo]: valor }));
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
            allowsEditing: true,
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
      setFotoTerreno(resultado.assets[0].uri);
    }
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
    setCampoFechaActivo(null);
    setCampoOpcionesActivo(null);
    setErrorUbicacionGps(null);
  };

  const crearLote = async () => {
    const nombre = form.nombre.trim();
    const superficie = Number(form.superficie);
    const fechaSiembraIso = parsearFecha(form.fechaSiembra);
    const fechaCosechaIso = parsearFecha(form.fechaCosecha);

    if (!nombre || !form.tipoCultivo || !form.ubicacion || !superficie || !fechaSiembraIso || !fechaCosechaIso) {
      Alert.alert('Datos incompletos', 'Completa nombre, tipo, ubicacion GPS, superficie y fechas.');
      return;
    }

    setGuardando(true);

    try {
      if (rubro === 'quinua') {
        const resultado = await registrarSiembraOfflineFirst({
          rubro: 'QUINUA',
          categoriaProducto: CATEGORIA_QUINUA,
          productoDefaultId: idProductoQuinua,
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

        const mensaje =
          resultado.estado === 'COMPLETADO'
            ? `Lote #${resultado.idLocal} guardado y sincronizado con backend.`
            : `Lote #${resultado.idLocal} guardado en estado PENDIENTE. Se subira automaticamente cuando haya conexion con backend.`;

        Alert.alert('Listo', mensaje);
      } else {
        const idProducto = obtenerProductoHortaliza(form.tipoCultivo);

        const resultado = await registrarSiembraOfflineFirst({
          rubro: 'HORTALIZA',
          categoriaProducto: CATEGORIA_HORTALIZAS,
          productoDefaultId: idProducto,
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

        const mensaje =
          resultado.estado === 'COMPLETADO'
            ? 'Lote guardado y sincronizado.'
            : 'Lote guardado en estado local. Se sincronizará automáticamente cuando haya conexión.';

        Alert.alert('Listo', mensaje);
      }

      limpiarFormulario();
      if (onGuardarExitoso) {
        await onGuardarExitoso();
      }
      onClose();
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
    fotoTerreno,
    guardando,
    cargandoUbicacionGps,
    errorUbicacionGps,
    modalOpcionesOpen,
    modalCalendarioOpen,
    campoFechaActivo,
    campoOpcionesActivo,
    actualizarCampo,
    capturarUbicacionGps,
    abrirSelectorOpciones,
    cerrarSelectorOpciones,
    abrirSelectorFecha,
    cerrarSelectorFecha,
    seleccionarFecha,
    seleccionarImagen,
    fechaSeleccionadaISO,
    crearLote,
  };
}
