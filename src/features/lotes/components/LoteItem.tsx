import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LoteViewModel } from '../types';

type LoteItemProps = {
  lote: LoteViewModel;
  productLabel: string;
  onOpenPhoto: (uri: string) => void;
  onCalcular: (lote: LoteViewModel) => void;
  onEditar: (lote: LoteViewModel) => void;
  onEliminar: (lote: LoteViewModel) => void;
};

export function LoteItem({ lote, productLabel, onOpenPhoto, onCalcular, onEditar, onEliminar }: LoteItemProps) {
  return (
    <View style={styles.loteCard}>
      <TouchableOpacity style={styles.loteImageContainer} activeOpacity={0.9} onPress={() => onOpenPhoto(lote.imagen)}>
        <Image source={{ uri: lote.imagen }} style={styles.loteImage} />
        <View style={styles.loteImageOverlay} />
        <View style={styles.zoomHintContainer}>
          <Ionicons name="expand-outline" size={12} color="#fff" />
          <Text style={styles.zoomHintText}>Tocar para ampliar</Text>
        </View>

        <View style={[styles.badge, { backgroundColor: lote.estadoColor }]}> 
          <Text style={styles.badgeText}>{lote.estado}</Text>
        </View>

        <View style={styles.codigoContainer}>
          <Text style={styles.codigoText}>{lote.codigo}</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.loteContent}>
        <Text style={styles.loteNombre}>{lote.nombre}</Text>
        <Text style={styles.loteCultivo}>{productLabel}: {lote.tipoProducto}</Text>

        <View style={styles.detallesGrid}>
          <View style={styles.detalleRow}>
            <Ionicons name="share-social-outline" size={14} color="#3b82f6" />
            <Text style={styles.detalleText}>Area: {lote.area} Ha</Text>
          </View>
          <View style={styles.detalleRow}>
            <Ionicons name="location-outline" size={14} color="#2eaa51" />
            <Text style={styles.detalleText}>{lote.comunidad}</Text>
          </View>
          <View style={styles.detalleRow}>
            <Ionicons name="calendar-outline" size={14} color="#9ca3af" />
            <Text style={styles.detalleText}>Siembra: {lote.fechaSiembra}</Text>
          </View>
          <View style={styles.detalleRow}>
            <Ionicons name="calendar-outline" size={14} color="#9ca3af" />
            <Text style={styles.detalleText}>Cosecha est: {lote.cosechaEstimada}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.finanzasRow}>
          <View>
            <Text style={styles.finanzasLabel}>Inversion</Text>
            <Text style={styles.finanzasInversion}>Bs {lote.inversion.toLocaleString('es-BO')}</Text>
          </View>
          <View style={styles.finanzasRight}>
            <Text style={styles.finanzasLabel}>Proyeccion</Text>
            <Text style={styles.finanzasProyeccion}>Bs {lote.proyeccion.toLocaleString('es-BO')}</Text>
          </View>
        </View>

        <View style={styles.accionesContainer}>
          <TouchableOpacity style={styles.btnGestionar} onPress={() => onCalcular(lote)}>
            <Ionicons name="share-social-outline" size={16} color="#fff" />
            <Text style={styles.btnGestionarText}>Calcular</Text>
          </TouchableOpacity>

          <View style={styles.accionesSecundariasRow}>
            <TouchableOpacity style={styles.btnEditar} onPress={() => onEditar(lote)}>
              <Ionicons name="create-outline" size={16} color="#2563eb" />
              <Text style={styles.btnEditarText}>Editar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnEliminar} onPress={() => onEliminar(lote)}>
              <Ionicons name="trash-outline" size={16} color="#dc2626" />
              <Text style={styles.btnEliminarText}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loteCard: { backgroundColor: '#fff', borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#f3f4f6', overflow: 'hidden', elevation: 2 },
  loteImageContainer: { height: 150, width: '100%', position: 'relative' },
  loteImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  loteImageOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  zoomHintContainer: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  zoomHintText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  badge: { position: 'absolute', top: 12, right: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  codigoContainer: { position: 'absolute', bottom: 12, left: 12 },
  codigoText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  loteContent: { padding: 16 },
  loteNombre: { fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginBottom: 2 },
  loteCultivo: { fontSize: 13, color: '#6b7280', marginBottom: 16 },
  detallesGrid: { marginBottom: 16 },
  detalleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  detalleText: { fontSize: 12, color: '#4b5563', marginLeft: 8 },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginBottom: 16 },
  finanzasRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  finanzasRight: { alignItems: 'flex-end' },
  finanzasLabel: { fontSize: 11, color: '#9ca3af', marginBottom: 2 },
  finanzasInversion: { fontSize: 15, fontWeight: 'bold', color: '#ef4444' },
  finanzasProyeccion: { fontSize: 15, fontWeight: 'bold', color: '#2eaa51' },
  accionesContainer: { gap: 8 },
  accionesSecundariasRow: { flexDirection: 'row', gap: 8 },
  btnGestionar: { backgroundColor: '#2eaa51', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 8 },
  btnGestionarText: { color: '#fff', fontWeight: '600', fontSize: 14, marginLeft: 6 },
  btnEditar: {
    flex: 1,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnEditarText: { color: '#2563eb', fontWeight: '600', fontSize: 13, marginLeft: 6 },
  btnEliminar: {
    flex: 1,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnEliminarText: { color: '#dc2626', fontWeight: '600', fontSize: 13, marginLeft: 6 },
});
