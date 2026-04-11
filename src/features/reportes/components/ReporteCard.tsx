import React, { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { ReporteLote, ReporteGasto } from '../hooks/useReportes';

type ReporteCardProps = {
  lote: ReporteLote;
};

function formatearMoneda(valor: number) {
  return `Bs. ${Number(valor || 0).toLocaleString('es-BO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatearFecha(valor: string) {
  if (!valor) return 'N/D';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return valor;
  return fecha.toLocaleString('es-BO');
}

function escaparHtml(valor: string) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function construirHtmlPdf(lote: ReporteLote) {
  const filas = lote.gastos.length > 0
    ? lote.gastos.map((gasto: ReporteGasto) => `
        <tr>
          <td>${escaparHtml(gasto.nombre)}</td>
          <td>${escaparHtml(gasto.descripcion || '-')}</td>
          <td>${escaparHtml(gasto.fase)}</td>
          <td>${escaparHtml(gasto.unidad)}</td>
          <td class="num">${Number(gasto.cantidad || 0).toLocaleString('es-BO')}</td>
          <td class="num">${formatearMoneda(gasto.precioUnitario)}</td>
          <td class="num strong">${formatearMoneda(gasto.total)}</td>
        </tr>
      `).join('')
    : `
        <tr>
          <td colspan="5" class="empty">No hay gastos registrados para este lote.</td>
        </tr>
      `;

  return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #1f2937; }
          h1 { color: #2BA14A; margin: 0 0 8px; }
          .meta { color: #64748b; margin-bottom: 18px; }
          .summary { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 14px 16px; border-radius: 12px; margin-bottom: 18px; }
          .summary strong { color: #15803d; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 8px; text-align: left; font-size: 12px; }
          th { background: #f8fafc; color: #334155; }
          .num { text-align: right; }
          .strong { font-weight: bold; }
          .empty { text-align: center; color: #64748b; padding: 18px 8px; }
          .footer { margin-top: 18px; font-size: 12px; color: #64748b; }
        </style>
      </head>
      <body>
        <h1>Reporte de Lote</h1>
        <div class="meta">${escaparHtml(lote.nombre)} | ${escaparHtml(lote.variedad)} | ${escaparHtml(formatearFecha(lote.createdAtIso))}</div>
        <div class="summary">
          <div><strong>Total invertido:</strong> ${escaparHtml(formatearMoneda(lote.totalInvertido))}</div>
          <div><strong>Gastos registrados:</strong> ${lote.gastos.length}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Categoria</th>
              <th>Descripcion</th>
              <th>Fase</th>
              <th>Unidad</th>
              <th class="num">Cantidad</th>
              <th class="num">Precio unitario</th>
              <th class="num">Total</th>
            </tr>
          </thead>
          <tbody>
            ${filas}
          </tbody>
        </table>
        <div class="footer">Generado desde Yapu Aroma.</div>
      </body>
    </html>
  `;
}

async function exportarPdf(lote: ReporteLote) {
  try {
    const { uri } = await Print.printToFileAsync({ html: construirHtmlPdf(lote) });
    const disponible = await Sharing.isAvailableAsync();
    if (disponible) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Reporte ${lote.nombre}` });
    } else {
      Alert.alert('PDF generado', `El archivo se generó en: ${uri}`);
    }
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'No se pudo generar el PDF.';
    Alert.alert('Error', mensaje);
  }
}

export function ReporteCard({ lote }: ReporteCardProps) {
  const [desplegado, setDesplegado] = useState(false);
  const totalGastos = useMemo(() => lote.gastos.reduce((acc, gasto) => acc + Number(gasto.total || 0), 0), [lote.gastos]);

  return (
    <View style={styles.card}>
      <View>
        <Text style={styles.nombreLote}>{lote.nombre}</Text>
        <Text style={styles.variedad}>{lote.variedad}</Text>
      </View>

      <View style={styles.bloqueMonto}>
        <Text style={styles.etiquetaMonto}>Total Invertido</Text>
        <Text style={styles.monto}>{formatearMoneda(lote.totalInvertido)}</Text>
      </View>

      <View style={styles.divisor} />

      <View style={styles.footer}>
        <TouchableOpacity activeOpacity={0.8} onPress={() => setDesplegado((valor) => !valor)}>
          <Text style={styles.desglose}>{desplegado ? 'Ocultar desglose <' : 'Ver desglose >'}</Text>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.85} style={styles.pdfButton} onPress={() => void exportarPdf(lote)}>
          <Ionicons name="document-text-outline" size={18} color="#2BA14A" />
          <Text style={styles.pdfButtonText}>PDF</Text>
        </TouchableOpacity>
      </View>

      {desplegado ? (
        <View style={styles.desgloseContainer}>
          <View style={styles.resumenDesglose}>
            <Text style={styles.resumenDesgloseLabel}>Detalle de gastos</Text>
            <Text style={styles.resumenDesgloseTotal}>{formatearMoneda(totalGastos)}</Text>
          </View>

          {lote.gastos.map((gasto) => (
            <View key={gasto.id} style={styles.gastoRow}>
              <View style={styles.gastoTopRow}>
                <Text style={styles.gastoNombre}>{gasto.nombre}</Text>
                <Text style={styles.gastoTotal}>{formatearMoneda(gasto.total)}</Text>
              </View>
              <Text style={styles.gastoMeta}>Descripcion: {gasto.descripcion || 'Sin descripcion'}</Text>
              <Text style={styles.gastoMeta}>Fase: {gasto.fase}</Text>
              <Text style={styles.gastoMeta}>
                Unidad: {gasto.unidad} | Cantidad: {Number(gasto.cantidad || 0).toLocaleString('es-BO')} | Precio: {formatearMoneda(gasto.precioUnitario)}
              </Text>
              <Text style={styles.gastoMeta}>Fecha: {formatearFecha(gasto.fechaGasto)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  nombreLote: {
    color: '#1E293B',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  variedad: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '400',
  },
  bloqueMonto: {
    marginTop: 18,
  },
  etiquetaMonto: {
    color: '#334155',
    fontSize: 13,
    marginBottom: 6,
  },
  monto: {
    color: '#2BA14A',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  divisor: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginTop: 18,
    marginBottom: 16,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  desglose: {
    color: '#2BA14A',
    fontSize: 14,
    fontWeight: '600',
  },
  pdfButton: {
    minWidth: 86,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2BA14A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pdfButtonText: {
    color: '#2BA14A',
    fontSize: 14,
    fontWeight: '700',
  },
  desgloseContainer: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  resumenDesglose: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resumenDesgloseLabel: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  resumenDesgloseTotal: {
    color: '#2BA14A',
    fontSize: 14,
    fontWeight: '800',
  },
  gastoRow: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  gastoTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  gastoNombre: {
    flex: 1,
    color: '#1E293B',
    fontSize: 13,
    fontWeight: '700',
  },
  gastoTotal: {
    color: '#15803d',
    fontSize: 13,
    fontWeight: '800',
  },
  gastoMeta: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },
});