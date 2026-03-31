'use client';

interface Props {
  names: string[];
}

export default function MatchPointBanner({ names }: Props) {
  if (names.length === 0) return null;

  const label =
    names.length === 1
      ? `MATCH POINT \u2014 ${names[0]} needs 1 more knock`
      : `MATCH POINT \u2014 ${names.join(' & ')} need 1 more knock`;

  return (
    <div
      style={{
        position: 'absolute',
        top: 'calc(80px + env(safe-area-inset-top, 0px))',
        left: 0,
        right: 0,
        zIndex: 20,
        background: '#1a1a1a',
        borderTop: '1px solid #2a2a2a',
        borderBottom: '1px solid #2a2a2a',
        padding: '5px 0',
        textAlign: 'center',
      }}
    >
      <span
        className="match-text-pulse"
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color: '#ffffff',
          fontFamily: 'var(--font-outfit), sans-serif',
        }}
      >
        {label}
      </span>
    </div>
  );
}
