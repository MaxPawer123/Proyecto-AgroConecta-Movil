import React from 'react';
import { ModalRegistroSiembra } from '@/src/features/registroSiembra';

export default function ModalRegistrarSiembra_Hortalizas({ visible, onClose, onCreated }) {
  return (
    <ModalRegistroSiembra
      visible={visible}
      onClose={onClose}
      onGuardarExitoso={onCreated}
      rubro="hortalizas"
    />
  );
}


