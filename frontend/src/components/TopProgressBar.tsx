'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function TopProgressBar() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    // Show bar on route change
    setVisible(true);
    setWidth(30);

    const t1 = setTimeout(() => setWidth(70), 100);
    const t2 = setTimeout(() => setWidth(90), 400);
    const t3 = setTimeout(() => setWidth(100), 700);
    const t4 = setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 900);

    return () => {
      clearTimeout(t1); clearTimeout(t2);
      clearTimeout(t3); clearTimeout(t4);
    };
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      className="top-progress-bar"
      style={{ width: `${width}%` }}
      aria-hidden="true"
    />
  );
}
