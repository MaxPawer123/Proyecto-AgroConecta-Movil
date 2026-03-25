import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getDb } from '../src/services/sqlite';

type TableDebug = {
  name: string;
  total: number;
  sample: Record<string, unknown>[];
  error: string | null;
};

const TABLES = [
  'usuario',
  'productor',
  'producto',
  'lote',
  'gasto_lote',
  'produccion_lote',
] as const;

export default function DebugSqliteScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tables, setTables] = useState<TableDebug[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  const cargarDatos = useCallback(async () => {
    const db = await getDb();
    const resultados: TableDebug[] = [];

    for (const table of TABLES) {
      try {
        const countRow = await db.getFirstAsync<{ total: number }>(`SELECT COUNT(*) AS total FROM ${table}`);
        const sampleRows = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${table} ORDER BY ROWID DESC LIMIT 10`);

        resultados.push({
          name: table,
          total: Number(countRow?.total ?? 0),
          sample: sampleRows,
          error: null,
        });
      } catch (error) {
        resultados.push({
          name: table,
          total: 0,
          sample: [],
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    setTables(resultados);
    setLastUpdate(new Date().toLocaleString());
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        await cargarDatos();
      } finally {
        setLoading(false);
      }
    })();
  }, [cargarDatos]);

  const recargar = async () => {
    setRefreshing(true);
    try {
      await cargarDatos();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Debug SQLite</Text>
        <TouchableOpacity style={styles.button} onPress={recargar} disabled={refreshing || loading}>
          {refreshing || loading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Ionicons name="refresh" size={16} color="#ffffff" />
              <Text style={styles.buttonText}>Recargar</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.subtitle}>Ultima lectura: {lastUpdate || '---'}</Text>

      <ScrollView contentContainerStyle={styles.content}>
        {tables.map((table) => (
          <View key={table.name} style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.tableName}>{table.name}</Text>
              <Text style={styles.count}>{table.total} registros</Text>
            </View>

            {table.error ? (
              <Text style={styles.error}>Error: {table.error}</Text>
            ) : table.sample.length === 0 ? (
              <Text style={styles.empty}>Sin registros</Text>
            ) : (
              <Text style={styles.sample}>{JSON.stringify(table.sample, null, 2)}</Text>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f7fb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 12,
    color: '#475569',
    paddingHorizontal: 16,
    marginTop: 6,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 98,
    justifyContent: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tableName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  count: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
  },
  sample: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#0f172a',
  },
  empty: {
    fontSize: 12,
    color: '#64748b',
  },
  error: {
    fontSize: 12,
    color: '#b91c1c',
    fontWeight: '600',
  },
});
