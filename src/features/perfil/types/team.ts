import type { ImageSourcePropType } from 'react-native';

export type TeamMember = {
  id: string;
  name: string;
  role: string;
  cargo?: string;
  phone: string;
  email: string;
  image: ImageSourcePropType;
};
