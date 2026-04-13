import React, { useEffect, useState } from 'react';
import { Image, Linking, Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../screens/PerfilScreen.styles';
import type { TeamMember } from '../types/team';

type MemberModalComponentProps = {
  visible: boolean;
  member: TeamMember | null;
  onClose: () => void;
};

export function MemberModalComponent({ visible, member, onClose }: MemberModalComponentProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [member?.id, visible]);

  const handleCallPhone = (phone: string) => {
    if (!phone || phone.trim() === '') {
      alert('Número de teléfono no disponible');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const handleWhatsApp = (phone: string) => {
    if (!phone || phone.trim() === '') {
      alert('Número de WhatsApp no disponible');
      return;
    }
    // Remover espacios y caracteres especiales del número
    const cleanPhone = phone.replace(/\s+/g, '').replace(/\D/g, '');
    // WhatsApp requiere el código de país sin el +
    const whatsappPhone = cleanPhone.startsWith('591') ? cleanPhone : cleanPhone.substring(cleanPhone.length - 8);
    Linking.openURL(`whatsapp://send?phone=+591${whatsappPhone}`);
  };

  const handleEmail = (email: string) => {
    if (!email || email.trim() === '' || email === '...') {
      alert('Correo electrónico no disponible');
      return;
    }
    Linking.openURL(`mailto:${email}`);
  };

  if (!member) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
          <Pressable style={styles.modalCloseButton} onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color="#1f2937" />
          </Pressable>

          <View style={styles.modalAvatarWrap}>
            <View style={styles.modalAvatarBorder}>
              <View style={styles.modalAvatarInner}>
                {imageFailed ? (
                  <Text style={styles.modalAvatarPlaceholder}>{member.name.charAt(0)}</Text>
                ) : (
                  <Image
                    source={member.image}
                    style={styles.modalAvatarImage}
                    onError={() => setImageFailed(true)}
                  />
                )}
              </View>
            </View>
          </View>

          <Text style={styles.modalName}>{member.name.toUpperCase()}</Text>
          <Text style={styles.modalRole}>{member.role}</Text>
          {member.cargo ? <Text style={styles.modalCargo}>{member.cargo}</Text> : null}

          <View style={styles.contactList}>
            <Pressable
              style={styles.contactItem}
              onPress={() => handleCallPhone(member.phone)}
              disabled={!member.phone || member.phone.trim() === ''}
              android_ripple={{ color: 'rgba(43, 161, 74, 0.1)' }}
            >
              <View style={styles.contactIconWrap}>
                <Ionicons name="call-outline" size={18} color="#2BA14A" />
              </View>
              <View style={styles.contactTextWrap}>
                <Text style={styles.contactLabel}>Teléfono / WhatsApp</Text>
                <Text style={styles.contactValue}>{member.phone}</Text>
              </View>
            </Pressable>

            <Pressable
              style={styles.contactItem}
              onPress={() => handleEmail(member.email)}
              disabled={!member.email || member.email.trim() === '' || member.email === '...'}
              android_ripple={{ color: 'rgba(43, 161, 74, 0.1)' }}
            >
              <View style={styles.contactIconWrap}>
                <Ionicons name="mail-outline" size={18} color="#2BA14A" />
              </View>
              <View style={styles.contactTextWrap}>
                <Text style={styles.contactLabel}>Correo electrónico</Text>
                <Text style={styles.contactValue}>{member.email}</Text>
              </View>
            </Pressable>
          </View>

          <Pressable style={styles.closeAction} onPress={onClose}>
            <Text style={styles.closeActionText}>Cerrar</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}
