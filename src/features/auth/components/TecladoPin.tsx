import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type TecladoPinProps = {
  valor: string;
  longitud?: number;
  titulo?: string;
  subtitulo?: string;
  mostrarBorrar?: boolean;
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
  onCambiar,
  onCompletar,
}: TecladoPinProps) {
  const manejarNumero = (numero: string) => {
    if (valor.length >= longitud) return;
    const siguiente = `${valor}${numero}`;
    onCambiar(siguiente);

    if (siguiente.length === longitud && onCompletar) {
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
          <TouchableOpacity key={tecla} style={styles.tecla} activeOpacity={0.85} onPress={() => manejarNumero(tecla)}>
            <Text style={styles.textoTecla}>{tecla}</Text>
          </TouchableOpacity>
        ))}

        <View style={styles.teclaVacia} />

        <TouchableOpacity style={styles.tecla} activeOpacity={0.85} onPress={() => manejarNumero('0')}>
          <Text style={styles.textoTecla}>0</Text>
        </TouchableOpacity>

        {mostrarBorrar ? (
          <TouchableOpacity style={styles.tecla} activeOpacity={0.85} onPress={manejarBorrar}>
            <Text style={styles.textoTecla}>←</Text>
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
  },
  titulo: {
    fontSize: 34,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitulo: {
    fontSize: 16,
    color: '#4b5563',
    marginBottom: 18,
    textAlign: 'center',
  },
  indicadoresContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  indicador: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#c9d1dc',
    backgroundColor: '#f5f7fa',
    marginHorizontal: 8,
  },
  indicadorActivo: {
    backgroundColor: '#39a935',
    borderColor: '#39a935',
  },
  teclado: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
  },
  tecla: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d8dde6',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  teclaVacia: {
    width: '30%',
    aspectRatio: 1,
  },
  textoTecla: {
    fontSize: 32,
    color: '#0f1f3a',
    fontWeight: '500',
  },
});
