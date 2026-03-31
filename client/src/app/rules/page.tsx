import Link from 'next/link';

export default function RulesPage() {
  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-outfit), sans-serif',
      padding: '0 24px 60px',
      maxWidth: 600,
      margin: '0 auto',
    }}>
      {/* Back */}
      <div style={{ position: 'sticky', top: 0, background: 'var(--bg-primary)', paddingTop: 20, paddingBottom: 12, zIndex: 10 }}>
        <Link href="/" style={{
          fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase',
          color: '#666', textDecoration: 'none', fontFamily: 'var(--font-outfit), sans-serif',
        }}>
          ← Back
        </Link>
      </div>

      {/* Title */}
      <div style={{ marginBottom: 32, marginTop: 8 }}>
        <h1 style={{
          fontSize: 13, fontWeight: 700, letterSpacing: '0.25em',
          textTransform: 'uppercase', color: 'var(--text-primary)',
          margin: '0 0 4px',
        }}>
          Knocks
        </h1>
        <p style={{
          fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase',
          color: '#666', margin: 0,
        }}>
          How to Play
        </p>
      </div>

      <Section title="The Basics">
        <Item>2 to 6 players in a private room.</Item>
        <Item>Game is played in orbits. Each orbit has 5 or 6 rounds.</Item>
        <Item>First player to reach the knock target (5 or 6) wins the pot.</Item>
      </Section>

      <Section title="Rounds">
        <p style={bodyStyle}>Each round you get one more card. Cards carry over within an orbit.</p>
        <Item><Mono>Round 1</Mono> — 1 card. Highest card wins. Suit breaks ties: Spades &gt; Hearts &gt; Diamonds &gt; Clubs.</Item>
        <Item><Mono>Round 2</Mono> — 2 cards. System imagines the best third card for you.</Item>
        <Item><Mono>Round 3</Mono> — 3 cards. If 2 cards share a color and 1 is different, the odd one out becomes a wild card.</Item>
        <Item><Mono>Round 4</Mono> — 4 cards. Muflis — worst hand wins. System picks your best 3.</Item>
        <Item><Mono>Round 5</Mono> — 5 cards. Best Teen Patti hand. System picks your best 3.</Item>
        <Item><Mono>Round 6</Mono> (if enabled) — 6 cards. Best Poker hand. System picks your best 5.</Item>
        <p style={{ ...bodyStyle, marginTop: 10 }}>A new deck is shuffled each orbit.</p>
      </Section>

      <Section title="Your Turn">
        <p style={bodyStyle}>Each round you choose <strong style={{ color: 'var(--text-primary)' }}>IN</strong> or <strong style={{ color: 'var(--text-primary)' }}>OUT</strong> based on your cards.</p>
      </Section>

      <Section title="Challenges">
        <p style={bodyStyle}>After everyone decides, OUT players can <strong style={{ color: 'var(--text-primary)' }}>JOIN</strong> the challenge or <strong style={{ color: 'var(--text-primary)' }}>PASS</strong>. All participants compete in a single showdown.</p>
      </Section>

      <Section title="How Knocks Work">
        <p style={bodyStyle}>You earn a knock <em>only</em> when:</p>
        <Item>You are the <strong style={{ color: 'var(--text-primary)' }}>ONLY</strong> player who said IN</Item>
        <Item>AND nobody joins the challenge</Item>
        <p style={{ ...bodyStyle, marginTop: 10 }}>Standing alone unchallenged = 1 knock. Winning a showdown <em>never</em> earns a knock.</p>
      </Section>

      <Section title="Showdowns">
        <Item>All participants' cards are compared.</Item>
        <Item>Best hand wins the challenge amount.</Item>
        <Item>Only the player with the <strong style={{ color: 'var(--text-primary)' }}>worst</strong> hand pays.</Item>
        <Item>Middle-ranked players are safe.</Item>
        <Item>If multiple players tie for worst, they split the payment.</Item>
      </Section>

      <Section title="Challenge Amount">
        <Item>Orbits 1 &amp; 2 — full pot (or custom limit if set).</Item>
        <Item>Orbit 3+ — pot or the room's challenge limit, whichever is less.</Item>
      </Section>

      <Section title="Pot & Money">
        <Item>Each orbit, every player puts $2 into the pot.</Item>
        <Item>Pot grows every orbit and never resets.</Item>
        <Item>When someone reaches the knock target, they win the entire pot.</Item>
      </Section>

      <Section title="Teen Patti Rankings" subtitle="Best to worst — used in Round 5">
        <RankList items={[
          ['Trail', 'three of a kind (AAA is best)'],
          ['Pure Sequence', 'straight flush (A-K-Q highest, A-2-3 second highest)'],
          ['Sequence', 'straight, mixed suits'],
          ['Color', 'flush, same suit'],
          ['Pair', 'two matching + kicker'],
          ['High Card', 'nothing matches'],
        ]} />
      </Section>

      <Section title="Muflis — Round 4">
        <p style={bodyStyle}>Rankings reversed — worst normal hand wins. 2-3-5 offsuit is the best Muflis hand.</p>
      </Section>

      <Section title="Poker Rankings" subtitle="Best to worst — used in Round 6">
        <RankList items={[
          ['Royal Flush', ''],
          ['Straight Flush', ''],
          ['Four of a Kind', ''],
          ['Full House', ''],
          ['Flush', ''],
          ['Straight', 'A-2-3-4-5 is the lowest'],
          ['Three of a Kind', ''],
          ['Two Pair', ''],
          ['One Pair', ''],
          ['High Card', ''],
        ]} />
      </Section>

      <Section title="Wild Card — Round 3" last>
        <p style={bodyStyle}>If 2 of your 3 cards are the same color and 1 is different, the odd one out becomes a wild card. It transforms into whatever makes your hand strongest.</p>
      </Section>
    </div>
  );
}

const bodyStyle: React.CSSProperties = {
  fontSize: 13, color: '#b3b3b3', lineHeight: 1.6, margin: '0 0 6px',
};

function Section({ title, subtitle, children, last = false }: {
  title: string; subtitle?: string; children: React.ReactNode; last?: boolean;
}) {
  return (
    <div style={{ marginBottom: last ? 0 : 28 }}>
      <div style={{
        borderTop: '1px solid #2a2a2a',
        paddingTop: 16, marginBottom: 10,
      }}>
        <p style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '0.2em',
          textTransform: 'uppercase', color: 'var(--text-primary)',
          margin: '0 0 2px',
        }}>
          {title}
        </p>
        {subtitle && (
          <p style={{ fontSize: 10, color: '#555', letterSpacing: '0.08em', margin: 0 }}>
            {subtitle}
          </p>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Item({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 5, alignItems: 'flex-start' }}>
      <span style={{ color: '#444', fontSize: 13, lineHeight: 1.6, flexShrink: 0 }}>—</span>
      <span style={{ fontSize: 13, color: '#b3b3b3', lineHeight: 1.6 }}>{children}</span>
    </div>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontFamily: 'var(--font-jetbrains-mono), monospace',
      color: 'var(--text-primary)', fontSize: 12,
    }}>
      {children}
    </span>
  );
}

function RankList({ items }: { items: [string, string][] }) {
  return (
    <ol style={{ margin: 0, padding: 0, listStyle: 'none' }}>
      {items.map(([name, note], i) => (
        <li key={name} style={{
          display: 'flex', alignItems: 'baseline', gap: 8,
          marginBottom: 4,
        }}>
          <span style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: 10, color: '#555', minWidth: 16, textAlign: 'right',
          }}>
            {i + 1}.
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{name}</span>
          {note && <span style={{ fontSize: 11, color: '#555' }}>— {note}</span>}
        </li>
      ))}
    </ol>
  );
}
