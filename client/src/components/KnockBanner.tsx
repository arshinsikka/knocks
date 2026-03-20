'use client';

import { useEffect } from 'react';

interface Props {
  playerName:    string;
  newKnockCount: number;
  knockTarget:   number;
  onDismiss:     () => void;
}

export default function KnockBanner({ playerName, newKnockCount, knockTarget, onDismiss }: Props) {
  useEffect(() => {
    // 3.6s matches the knockSlide CSS animation duration
    const t = setTimeout(onDismiss, 3600);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className="knock-banner"
      onClick={onDismiss}
      style={{
        position:    'fixed',
        top:          80,    // below status bar
        left:         0,
        right:        0,
        zIndex:       70,
        background:  'var(--bg-surface)',
        borderBottom: '1px solid var(--border-medium)',
        padding:     '10px 20px',
        display:     'flex',
        alignItems:  'center',
        justifyContent: 'center',
        gap:          12,
        cursor:      'pointer',
      }}
    >
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.15em',
        textTransform: 'uppercase', color: 'var(--text-muted)',
      }}>
        Knock
      </span>
      <span style={{
        fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
      }}>
        {playerName}
      </span>
      <span className="mono" style={{
        fontSize: 12, color: 'var(--text-muted)',
      }}>
        {newKnockCount}/{knockTarget}
      </span>
    </div>
  );
}
