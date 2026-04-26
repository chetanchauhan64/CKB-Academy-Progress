'use client';
/**
 * hooks/useWallet.ts — Thin re-export of WalletContext for backwards compatibility.
 * All existing components that used useWallet() continue to work unchanged.
 */
export { useWalletContext as useWallet } from '@/context/WalletContext';
