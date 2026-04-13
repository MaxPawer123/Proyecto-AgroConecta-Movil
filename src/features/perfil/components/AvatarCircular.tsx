import React, { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { styles } from '../screens/PerfilScreen.styles';
import type { TeamMember } from '../types/team';

type AvatarCircularProps = {
  member: TeamMember;
  onPress: (member: TeamMember) => void;
};

export function AvatarCircular({ member, onPress }: AvatarCircularProps) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <Pressable style={styles.avatarCard} onPress={() => onPress(member)} android_ripple={{ color: '#e2f3e6' }}>
      <View style={styles.avatarRing}>
        {imageFailed ? (
          <View style={styles.avatarFallback}>
            <MaterialCommunityIcons name="account" size={30} color="#b8c7bb" />
          </View>
        ) : (
          <Image
            source={member.image}
            style={styles.avatarImage}
            onError={() => setImageFailed(true)}
          />
        )}
      </View>
      <Text style={styles.avatarName} numberOfLines={2}>
        {member.name}
      </Text>
      <Text style={styles.avatarRole} numberOfLines={2}>
        {member.role}
      </Text>
    </Pressable>
  );
}
