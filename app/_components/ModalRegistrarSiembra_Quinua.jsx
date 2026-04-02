import React from 'react';
import { ModalRegistroSiembra } from '@/src/features/registroSiembra';

export default function ModalRegistrarSiembra_Quinua({ visible, onClose, onCreated }) {
  return (
    <ModalRegistroSiembra
      visible={visible}
      onClose={onClose}
      onGuardarExitoso={onCreated}
      rubro="quinua"
    />
  );
}

