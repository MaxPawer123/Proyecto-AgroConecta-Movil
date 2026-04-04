import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type TecladoPinProps = {
  valor: string;
  longitud?: number;
  titulo?: string;
  subtitulo?: string;
  mostrarBorrar?: boolean;
  autoCompletar?: boolean;
  onCambiar: (nuevoValor: string) => void;
  onCompletar?: (pin: string) => void;
};

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function TecladoPin({
  valor,
  longitud = 4,
  titulo,
  subtitulo,
  mostrarBorrar = true,
  autoCompletar = true,
  onCambiar,
  onCompletar,
}: TecladoPinProps) {
  const manejarNumero = (numero: string) => {
    if (valor.length >= longitud) return;
    const siguiente = `${valor}${numero}`;
    onCambiar(siguiente);

    if (autoCompletar && siguiente.length === longitud && onCompletar) {
      onCompletar(siguiente);
    }
  };

  const manejarBorrar = () => {
    if (!valor.length) return;
    onCambiar(valor.slice(0, -1));
  };

  return (
    <View style={styles.wrapper}>
      {titulo ? <Text style={styles.titulo}>{titulo}</Text> : null}
      {subtitulo ? <Text style={styles.subtitulo}>{subtitulo}</Text> : null}

      <View style={styles.indicadoresContainer}>
        {Array.from({ length: longitud }).map((_, indice) => (
          <View
            key={`pin-indicador-${indice}`}
            style={[styles.indicador, indice < valor.length ? styles.indicadorActivo : null]}
          />
        ))}
      </View>

      <View style={styles.teclado}>
        {TECLAS.map((tecla) => (
          <TouchableOpacity key={tecla} style={styles.tecla} activeOpacity={0.7} onPress={() => manejarNumero(tecla)}>
            <Text style={styles.textoTecla}>{tecla}</Text>
          </TouchableOpacity>
        ))}

        <View style={styles.teclaVacia} />

        <TouchableOpacity style={styles.tecla} activeOpacity={0.7} onPress={() => manejarNumero('0')}>
          <Text style={styles.textoTecla}>0</Text>
        </TouchableOpacity>

        {mostrarBorrar ? (
          <TouchableOpacity style={styles.teclaBorrar} activeOpacity={0.7} onPress={manejarBorrar}>
            <Ionicons name="backspace-outline" size={28} color="#475569" />
          </TouchableOpacity>
        ) : (
          <View style={styles.teclaVacia} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    alignItems: 'center',
    maxWidth: 320, // Evita que se estire demasiado en pantallas grandes
  },
  titulo: {
    fontSize: 16,
    fontWeight: '400',
    color: '#475569',
    marginBottom: 24,
    textAlign: 'center',
  },
  subtitulo: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 18,
    textAlign: 'center',
  },
  indicadoresContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  indicador: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#E2E8F0', // Borde gris muy claro como en el diseño
    backgroundColor: 'transparent',
    marginHorizontal: 10,
  },
  indicadorActivo: {
    backgroundColor: '#2BA14A', // Se llena de verde al teclear
    borderColor: '#2BA14A',
  },
  teclado: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 16, // Espacio vertical entre los botones
  },
  tecla: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 100, // Círculo perfecto
    borderWidth: 1,
    borderColor: '#E2E8F0', // Borde súper fino y sutil
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  teclaBorrar: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  teclaVacia: {
    width: '30%',
    aspectRatio: 1,
  },
  textoTecla: {
    fontSize: 28,
    color: '#1e293b', // Gris/Azul oscuro elegante
    fontWeight: '300', // Fuente más delgada para un look moderno
  },
});