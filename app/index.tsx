import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ImageBackground, 
  StatusBar 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';

export default function Inicio() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
      
      {/* 1. Imagen de fondo (sustituye la URL por tu imagen local si prefieres) */}
      <ImageBackground 
        source={{ uri: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=1000&auto=format&fit=crop' }} 
        style={styles.backgroundImage}
      >
        {/* 2. Overlay Verde (Capa de color) */}
        <View style={styles.overlay}>
          
          {/* Logo e Icono */}
          <View style={styles.headerContainer}>
             <Ionicons name="leaf" size={50} color="#FFD700" />
             <Text style={styles.title}>Yapu Aroma</Text>
          </View>

          {/* Lista de beneficios (Checkmarks) */}
          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <View style={styles.checkCircle}>
                <Ionicons name="checkmark" size={18} color="white" />
              </View>
              <Text style={styles.featureText}>Registra tus lotes fácilmente</Text>
            </View>

            <View style={styles.featureItem}>
              <View style={styles.checkCircle}>
                <Ionicons name="checkmark" size={18} color="white" />
              </View>
              <Text style={styles.featureText}>Calcular costos y beneficios</Text>
            </View>
          </View>

          {/* BOTÓN DE INICIO */}
          <TouchableOpacity 
            style={styles.button} 
            onPress={() => router.push('/seleccionar-rubro')} // Aquí pones la ruta a tu Dashboard actual
          >
            <Text style={styles.buttonText}>INICIO</Text>
          </TouchableOpacity>

        </View>
      </ImageBackground>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(46, 125, 50, 0.8)', // Verde con 80% de opacidad
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 38,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 10,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginTop: 5,
  },
  featuresList: {
    width: '100%',
    marginBottom: 60,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },
  checkCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  featureText: {
    fontSize: 17,
    color: 'white',
    fontWeight: '500',
  },
  button: {
    backgroundColor: 'white',
    paddingVertical: 16,
    paddingHorizontal: 60,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
    // Sombra para que resalte
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  buttonText: {
    color: '#2E7D32',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1.2,
  },
});