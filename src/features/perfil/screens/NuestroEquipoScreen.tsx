import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { AvatarCircular } from '../components/AvatarCircular';
import { MemberModalComponent } from '../components/MemberModalComponent';
import type { TeamMember } from '../types/team';
import { styles } from './PerfilScreen.styles';

const TEAM_MEMBERS: TeamMember[] = [
  {
    id: '1',
    name: 'Ghilmar David Mamani Valeriano',
    role: 'Informática',
    phone: '+591 69769901',
    email: 'davidmamanivaleriano3@gmail.com',
    image: require('../../../../assets/images/david.png'),
  },
  {
    id: '2',
    name: 'Tatiana Borras Anze',
    role: 'Administración de Empresas',
    phone: '+591 69948832',
    email: 'tatianaborrasanze@gmail.com',
    image: require('../../../../assets/images/tati.png'),
  },
  {
    id: '3',
    name: 'Irene Loida Uruchi Callisaya',
    role: 'Ingeniería Agronómica',
    phone: '+591 76231248',
    email: 'ireneuruchicallisaya@gmail.com',
    image: require('../../../../assets/images/perfil.png'),
  },
  {
    id: '4',
    name: 'Fatima Zulema Saavedra Suarez',
    role: 'Trabajo Social',
    phone: '+591 77211575',
    email: 'fatimazulemasaavedrasuarez@gmail.com',
    image: require('../../../../assets/images/zule.png'),
  },
  {
    id: '5',
    name: 'Gabriela Fatima Mayta Quispe',
    role: 'Trabajo Social',
    phone: '+591 69755602',
    email: 'fatimamaytaquispe@gmail.com',
    image: require('../../../../assets/images/fati.png'),
  },
  {
    id: '6',
    name: 'Enrique Javier Mamani Nina',
    role: 'Comunicación Social',
    phone: '+591 79149684',
    email: '...',
    image: require('../../../../assets/images/perfil.png'),
  },
];

const COORDINADORES: TeamMember[] = [
  {
    id: 'c1',
    name: 'Ing. MSc. Isidro Callizaya Mamani',
    role: 'IIAREN',
    cargo: 'Coordinadora del proyecto',
    phone: '+591 71507416',
    email: '',
    image: require('../../../../assets/images/perfil.png'),
  },
  {
    id: 'c2',
    name: 'Ing. MSc. Fanny Arragan Tancara',
    role: 'Docente Facultad de Agronomía - UMSA',
    cargo: 'Co-coordinadora del proyecto',
    phone: '',
    email: '',
    image: require('../../../../assets/images/perfil.png'),
  },
  {
    id: 'c3',
    name: 'Ing. MSc. Marco Antonio Patiño Fernández',
    role: 'Docente Facultad de Agronomía - UMSA',
    cargo: 'Responsable técnico, administrativo del proyecto y tutor',
    phone: '+591 77766857',   
    email: 'mapatino1@umsa.bo',
    image: require('../../../../assets/images/ing_patiño.png'),
  },
  {
    id: 'c4',
    name: 'MSc. Madelina Loza Soliz',
    role: 'Informática',
    cargo: 'Tutor',
    phone: '+591 72070331',
    email: '',
    image: require('../../../../assets/images/perfil.png'),
  },
];

export function NuestroEquipoScreen() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [vista, setVista] = useState<'equipo' | 'coordinadores'>('equipo');

  const miembrosVisibles = vista === 'equipo' ? TEAM_MEMBERS : COORDINADORES;

  const handleOpenMember = (member: TeamMember) => {
    setSelectedMember(member);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleAction = () => {
    if (vista === 'equipo') {
      setVista('coordinadores');
      return;
    }

    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.headerArea}>
            <Text style={styles.title}>
              {vista === 'equipo' ? 'Equipo Multidiciplinario' : 'Coordinadores'}
            </Text>
            <Text style={styles.subtitle}>El motor detrás de Yapu Aroma</Text>
          </View>

          <View style={styles.gridWrap}>
            <View style={styles.grid}>
              {miembrosVisibles.map((member) => (
                <AvatarCircular key={member.id} member={member} onPress={handleOpenMember} />
              ))}
            </View>
          </View>

          <View style={styles.footerActionWrap}>
            <TouchableOpacity style={styles.actionButton} onPress={handleAction} activeOpacity={0.88}>
              <Text style={styles.actionButtonText}>{vista === 'equipo' ? 'Siguiente' : 'Salir'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <MemberModalComponent visible={isModalOpen} member={selectedMember} onClose={handleCloseModal} />
      </SafeAreaView>
    </>
  );
}
