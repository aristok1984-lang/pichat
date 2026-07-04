'use client';

import { useState, useEffect } from 'react';

export default function StatusBarTime() {
  const [time, setTime] = useState('');

  useEffect(() => {
    function update() {
      const now = new Date();
      const h = now?.getHours();
      const m = now?.getMinutes()?.toString()?.padStart(2, '0');
      const hour = h % 12 || 12;
      setTime(`${hour}:${m}`);
    }
    update();
    const id = setInterval(update, 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="text-xs font-bold text-foreground font-tabular">{time}</span>
  );
}
