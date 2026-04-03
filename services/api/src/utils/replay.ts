const usedReplayKeys = new Map<string, number>();

const cleanupExpiredNonces = () => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  for (const [replayKey, exp] of usedReplayKeys.entries()) {
    if (exp <= nowSeconds) {
      usedReplayKeys.delete(replayKey);
    }
  }
};

export const consumeNonce = (replayKey: string, exp: number): boolean => {
  cleanupExpiredNonces();

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (exp <= nowSeconds) {
    return false;
  }

  if (usedReplayKeys.has(replayKey)) {
    return false;
  }

  usedReplayKeys.set(replayKey, exp);
  return true;
};
