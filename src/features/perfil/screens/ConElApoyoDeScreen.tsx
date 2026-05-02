import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';

export function ConElApoyoDeScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.headerArea}>
            <Text style={styles.title}>Con el apoyo de</Text>
            <Text style={styles.subtitle}>Instituciones y aliados que impulsan Yapu Aroma</Text>
          </View>

          <View style={styles.card}>
            {/* Fila 1 */}
            <View style={styles.row}>
              <View style={styles.logoCell}>
                <Image source={require('../../../../assets/images/umsamejor.png')} style={styles.logoUmSa} />
                <Text style={styles.logoLabel}>UMSA</Text>
                <Text style={styles.idhSub}>Universidad Mayor de San Andres</Text>

              </View>
              <View style={styles.logoCell}>
                <Image source={require('../../../../assets/images/logoquinueros.png')} style={styles.logoQuinueros} />
                <Text style={styles.logoLabel}>APROQUIMSS</Text>
                             <Text style={styles.idhSub}>Asociación de Productores de Quinua del Municipio de Sica Sica</Text>

              </View>
            </View>

            {/* Fila 2 */}
            <View style={styles.row}>
              <View style={styles.logoCell}>
                <Image source={require('../../../../assets/images/dipgis.png')} style={styles.logoDipgis} />
                <Text style={styles.logoLabel}>DIPGIS</Text>
             <Text style={styles.idhSub}>Departamento de Investigación, Postgrado e Interacción Social</Text>

              </View>
              <View style={styles.logoCell}>
                <Image source={require('../../../../assets/images/idh.png')} style={styles.logoIdh} />
                <View>
                  <Text style={styles.logoLabel}>IDH</Text>
                  <Text style={styles.idhSub}>Proyectos Impuesto Directo a los Hidrocarburos</Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1A401A',
  },
  scrollContent: {
    backgroundColor: '#F5F7F5',
    paddingBottom: 28,
  },
  headerArea: {
    backgroundColor: '#1A401A',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    fontWeight: '500',
    marginTop: 8,
    lineHeight: 22,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    paddingHorizontal: 16,
    paddingVertical: 20,
    marginHorizontal: 16,
    marginTop: -16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 14,
  },
  logoCell: {
    flex: 1,
    minHeight: 136,
    borderRadius: 18,
    backgroundColor: '#F8FBF8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E0EADF',
  },
  logoUmSa: {
    width: 102,
    height: 78,
    resizeMode: 'contain',
  },
  logoQuinueros: {
    width: 112,
    height: 74,
    resizeMode: 'contain',
  },
  logoDipgis: {
    width: 74,
    height: 74,
    resizeMode: 'contain',
  },
  logoIdh: {
    width: 120,
    height: 58,
    resizeMode: 'contain',
    marginBottom: 4,
  },
  logoLabel: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: '#1A401A',
    textAlign: 'center',
  },
  idhSub: {
    fontSize: 9,
    fontWeight: '400',
    color: '#4A6741',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 8,
  },
});