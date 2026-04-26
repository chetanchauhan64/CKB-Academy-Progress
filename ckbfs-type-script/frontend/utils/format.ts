export function formatCkb(shannons: bigint | string): string {
  const n = typeof shannons === 'string' ? BigInt(shannons) : shannons;
  return (Number(n) / 1e8).toFixed(4) + ' CKB';
}

export function shortenHash(hash: string, chars = 8): string {
  if (!hash || hash.length < chars * 2 + 2) return hash;
  return hash.slice(0, chars + 2) + '…' + hash.slice(-chars);
}

export function explorerTxUrl(txHash: string): string {
  return `https://pudge.explorer.nervos.org/transaction/${txHash}`;
}

export function explorerAddrUrl(address: string): string {
  return `https://pudge.explorer.nervos.org/address/${address}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function mimeToEmoji(mime: string): string {
  if (mime.startsWith('image/')) return '🖼️';
  if (mime.startsWith('text/')) return '📄';
  if (mime.startsWith('video/')) return '🎬';
  if (mime.startsWith('audio/')) return '🎵';
  if (mime.includes('pdf')) return '📕';
  if (mime.includes('json')) return '📋';
  return '📁';
}
