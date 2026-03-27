const usedNonces = new Map<string, number>();

const cleanupExpiredNonces = () => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  for (const [nonce, exp] of usedNonces.entries()) {
    if (exp <= nowSeconds) {
      usedNonces.delete(nonce);
    }
  }
};

export const consumeNonce = (nonce: string, exp: number): boolean => {
  cleanupExpiredNonces();

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (exp <= nowSeconds) {
    return false;
  }

  if (usedNonces.has(nonce)) {
    return false;
  }

  usedNonces.set(nonce, exp);
  return true;
};
