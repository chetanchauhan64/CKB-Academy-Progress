'use client';

import React, { useEffect } from 'react';
import { Provider, useCcc } from '@ckb-ccc/connector-react';
import { useStore } from '@/lib/store';

/**
 * Inner component that runs inside the CCC Provider so it has access to useCcc().
 * Syncs the CCC signer address → Zustand store whenever the user connects via JoyID.
 */
function CKBWalletSync({ children }: { children: React.ReactNode }) {
  const { signerInfo, open: openCKBModal } = useCcc();
  const { setWallet, setWalletType, walletType, pushNotification, disconnectWallet } = useStore();

  // Sync CKB signer address into the store whenever signerInfo changes
  useEffect(() => {
    async function sync() {
      if (signerInfo?.signer) {
        try {
          const address = await signerInfo.signer.getRecommendedAddress();
          setWallet(address);
          setWalletType('CKB');
          pushNotification({ type: 'success', message: `JoyID connected: ${address.slice(0, 12)}...`, duration: 4000 });
        } catch {
          // signer exists but address fetch failed — ignore
        }
      } else if (walletType === 'CKB') {
        // CKB wallet was disconnected from connector side
        disconnectWallet();
      }
    }
    sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signerInfo]);

  // Override store's connectWallet to open CCC modal for CKB
  useEffect(() => {
    useStore.setState({
      connectWallet: async (address?: string) => {
        if (address) {
          // Manual address entry (simulation/demo mode)
          setWallet(address);
          setWalletType('CKB');
          return;
        }
        // No address → open CCC's JoyID connector
        openCKBModal();
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCKBModal]);

  return <>{children}</>;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <Provider>
      <CKBWalletSync>
        {children}
      </CKBWalletSync>
    </Provider>
  );
}
