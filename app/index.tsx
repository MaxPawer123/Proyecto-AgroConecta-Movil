import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function Inicio() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        
        {/* HEADER / BIENVENIDA */}
        <View style={styles.header}>
          <View style={styles.userInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>JM</Text>
            </View>
            <View>
              <Text style={styles.role}>BienProductor</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.bellIcon}>
            <Ionicons name="notifications-outline" size={24} color="#4b5563" />
            <View style={styles.notificationDot} />
          </TouchableOpacity>
        </View>

        {/* HERO CARD (Acción Principal) */}
        <TouchableOpacity 
          style={styles.heroCard}
          onPress={() => router.push('/seleccionar-rubro')} 
        >
          <View style={styles.heroContent}>
            <View>
              <Text style={styles.heroTitle}>Gestionar Mis Cultivos</Text>
              <Text style={styles.heroSubtitle}>Administra tus lotes, siembras y finanzas.</Text>
            </View>
            <View style={styles.heroArrow}>
              <Ionicons name="arrow-forward" size={20} color="#2eaa51" />
            </View>
          </View>
        </TouchableOpacity>

        {/* MÓDULOS DEL SISTEMA */}
        <Text style={styles.sectionTitle}>Módulos del Sistema</Text>
        <View style={styles.grid}>
          
          <TouchableOpacity style={styles.gridItem} onPress={() => router.push('/seleccionar-rubro')}>
            <View style={[styles.iconBg, { backgroundColor: '#eefcf2' }]}>
              <MaterialCommunityIcons name="sprout" size={28} color="#2eaa51" />
            </View>
            <Text style={styles.gridItemTitle}>Mis Lotes</Text>
            <Text style={styles.gridItemSub}>Control de campo</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridItem}>
            <View style={[styles.iconBg, { backgroundColor: '#f5f3ff' }]}>
              <Ionicons name="cube-outline" size={28} color="#8b5cf6" />
            </View>
            <Text style={styles.gridItemTitle}>Productos</Text>
            <Text style={styles.gridItemSub}>Inventario</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridItem}>
            <View style={[styles.iconBg, { backgroundColor: '#fff7ed' }]}>
              <Ionicons name="cart-outline" size={28} color="#f97316" />
            </View>
            <Text style={styles.gridItemTitle}>Pedidos</Text>
            <Text style={styles.gridItemSub}>Ventas y envíos</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridItem}>
            <View style={[styles.iconBg, { backgroundColor: '#eef4ff' }]}>
              <Ionicons name="people-outline" size={28} color="#3b82f6" />
            </View>
            <Text style={styles.gridItemTitle}>Comunidad</Text>
            <Text style={styles.gridItemSub}>Foro agrícola</Text>
          </TouchableOpacity>

        </View>

        {/* CONSEJO DEL DÍA (Estilo Figma) */}
        <View style={styles.tipCard}>
          <View style={styles.tipIcon}>
            <Text style={{ fontSize: 20 }}>💡</Text>
          </View>
          <View style={styles.tipContent}>
            <Text style={styles.tipTitle}>Consejo del día</Text>
            <Text style={styles.tipText}>
              Revisa las alertas climáticas regularmente para proteger tus cultivos de heladas y sequías.
            </Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fafafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 10 },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, backgroundColor: '#2eaa51', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  greeting: { fontSize: 18, fontWeight: 'bold', color: '#1f2937' },
  role: { fontSize: 13, color: '#2eaa51', fontWeight: '600' },
  bellIcon: { padding: 8, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#f3f4f6' },
  notificationDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, backgroundColor: '#ef4444', borderRadius: 4, borderWidth: 1, borderColor: '#fff' },
  
  heroCard: { marginHorizontal: 20, backgroundColor: '#2eaa51', borderRadius: 20, padding: 20, marginBottom: 24, elevation: 4, boxShadow: '0px 4px 8px rgba(46, 170, 81, 0.3)' },
  heroContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  heroSubtitle: { fontSize: 13, color: '#ecfdf5', maxWidth: '80%' },
  heroArrow: { width: 40, height: 40, backgroundColor: '#fff', borderRadius: 20, justifyContent: 'center', alignItems: 'center' },

  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginLeft: 20, marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, justifyContent: 'space-between' },
  gridItem: { width: '47%', backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#f3f4f6', alignItems: 'center' },
  iconBg: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  gridItemTitle: { fontSize: 15, fontWeight: 'bold', color: '#1f2937', marginBottom: 2 },
  gridItemSub: { fontSize: 11, color: '#6b7280' },

  tipCard: { marginHorizontal: 20, marginTop: 10, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'flex-start' },
  tipIcon: { backgroundColor: '#dcfce7', padding: 8, borderRadius: 10, marginRight: 12 },
  tipContent: { flex: 1 },
  tipTitle: { fontSize: 14, fontWeight: 'bold', color: '#166534', marginBottom: 4 },
  tipText: { fontSize: 12, color: '#15803d', lineHeight: 18 }
});