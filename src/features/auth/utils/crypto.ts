import * as Crypto from 'expo-crypto';

export async function hashearPin(pin: string): Promise<string> {
  const pinLimpio = pin.trim();

  if (!/^\d{4}$/.test(pinLimpio)) {
    throw new Error('El PIN debe contener exactamente 4 digitos numericos.');
  }

  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pinLimpio);
}
