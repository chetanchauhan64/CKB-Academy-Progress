import { createRoot } from "react-dom/client";
import React, { useEffect, useState } from 'react';
import { capacityOf, generateAccountFromPrivateKey, shannonToCKB, transfer, wait } from './lib';
import { Script } from '@ckb-ccc/core';

const container = document.getElementById("root");
const root = createRoot(container)
root.render(<App />);

export function App() {
  const [privKey, setPrivKey] = useState('0x6109170b275a09ad54877b82f7d9930f88cab5717d484fb4741ae9d1dd078cd6');
  const [fromAddr, setFromAddr] = useState('');
  const [fromLock, setFromLock] = useState<Script>();
  const [balance, setBalance] = useState('0');

  const [toAddr, setToAddr] = useState('ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqt435c3epyrupszm7khk6weq5lrlyt52lg48ucew');
  const [amountInCKB, setAmountInCKB] = useState('62');

  const [isTransferring, setIsTransferring] = useState(false);
  const [txHash, setTxHash] = useState<string>();

  useEffect(() => {
    if (privKey) {
      updateFromInfo();
    }
  }, [privKey]);

  const updateFromInfo = async () => {
    const { lockScript, address } = await generateAccountFromPrivateKey(privKey);
    const capacity = await capacityOf(address);
    setFromAddr(address);
    setFromLock(lockScript);
    setBalance(shannonToCKB(capacity).toString());
  };

  const onInputPrivKey = (e: React.ChangeEvent<HTMLInputElement>) => {
    const priv = e.target.value;
    const privateKeyRegex = /^0x[0-9a-fA-F]{64}$/;
    const isValid = privateKeyRegex.test(priv);

    if (isValid) {
      setPrivKey(priv);
    } else {
      alert(`Invalid private key`);
    }
  };

  const onTransfer = async () => {
    setIsTransferring(true);
    const txHash = await transfer(toAddr, amountInCKB, privKey).catch(alert);

    if(txHash){
      setTxHash(txHash);
      await wait(10);
      await updateFromInfo();
    }
    
    setIsTransferring(false);
  }

  const enabled = +amountInCKB > 61 && +balance > +amountInCKB && toAddr.length > 0 && !isTransferring;

  return (
    <div>
      <h1>View and Transfer Balance</h1>
      <label>Private Key: </label>
      <input type="text" value={privKey} onChange={onInputPrivKey} />

      <ul>
        <li>CKB Address: {fromAddr}</li>
        <li>
          Current lock script:
          <pre>{JSON.stringify(fromLock, null, 2)}</pre>
        </li>
        <li>Total capacity: {balance} CKB</li>
      </ul>

      <label>Transfer to Address: </label>
      <input type="text" value={toAddr} onChange={(e) => setToAddr(e.target.value)} />

      <label>Amount</label>
      <input type="number" value={amountInCKB} onChange={(e) => setAmountInCKB(e.target.value)} /> CKB
      <small>Tx fee: 0.001 CKB</small>

      <button disabled={!enabled} onClick={onTransfer}>Transfer</button>

      {txHash && <div>tx hash: {txHash}</div>}
    </div>
  );
}
