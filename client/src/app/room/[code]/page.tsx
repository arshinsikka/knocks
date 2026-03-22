'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSocket } from '@/lib/socket';
import { GameProvider, useGame, PublicPlayer } from '@/context/GameContext';

import StatusBar      from '@/components/StatusBar';
import HandTray       from '@/components/HandTray';
import ActionBar      from '@/components/ActionBar';
import PlayerSlot     from '@/components/PlayerSlot';
import ShowdownOverlay, { ShowdownToast } from '@/components/ShowdownOverlay';
import KnockBanner    from '@/components/KnockBanner';
import GameOverScreen from '@/components/GameOverScreen';
import ReconnectBanner from '@/components/ReconnectBanner';
import { sounds } from '@/lib/sounds';

// ── Player Ring ───────────────────────────────────────────────────────────────

function PlayerRing() {
  const { players, myId, knockTarget, waitingFor, playerChoices } = useGame();

  const me        = players.find((p) => p.id === myId);
  const opponents = players.filter((p) => p.id !== myId);

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'center',
      padding: '12px', gap: 24, overflow: 'hidden',
    }}>
      {/* Opponents */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8,
        justifyContent: 'center', alignContent: 'center',
      }}>
        {opponents.map((p) => (
          <PlayerSlot
            key={p.id}
            player={p}
            knockTarget={knockTarget}
            isMe={false}
            isActiveTurn={waitingFor?.playerName === p.name}
            choice={playerChoices[p.name]}
          />
        ))}
      </div>

      {/* My slot */}
      {me && (
        <PlayerSlot
          player={me}
          knockTarget={knockTarget}
          isMe
          isActiveTurn={false}
          choice={playerChoices[me.name]}
        />
      )}
    </div>
  );
}

// ── Game Board ────────────────────────────────────────────────────────────────

function GameBoard({ roomCode, hostId }: { roomCode: string; hostId: string }) {
  const {
    orbit, round, potTotal, payout, knockTarget,
    players, myCards, selectedCards, myId,
    isMyTurn, turnPhase, serverPhase, waitingFor,
    showdownData, latestKnock, gameOver, playerChoices,
    emitIn, emitOut, emitJoin, emitPass,
    dismissShowdown, dismissKnock,
  } = useGame();

  const myName = players.find((p) => p.id === myId)?.name ?? '';
  const isHost = myId === hostId;

  // ── Sound effects (all hooks before early return — React rules) ─────────────

  // YOUR TURN — ping only when isMyTurn flips from false → true
  const wasMyTurnRef = useRef(false);
  useEffect(() => {
    if (isMyTurn && !wasMyTurnRef.current) {
      sounds.yourTurn();
      sounds.vibrate(50);
    }
    wasMyTurnRef.current = isMyTurn;
  }, [isMyTurn]);

  // CHALLENGE — when server phase enters CHALLENGE_JOIN
  const prevPhaseRef = useRef(serverPhase);
  useEffect(() => {
    if (serverPhase === 'CHALLENGE_JOIN' && prevPhaseRef.current !== 'CHALLENGE_JOIN') {
      sounds.challenge();
    }
    prevPhaseRef.current = serverPhase;
  }, [serverPhase]);

  // SHOWDOWN REVEAL — when overlay opens for a participant
  useEffect(() => {
    if (showdownData && !showdownData.isPublic) {
      sounds.showdown();
    }
  }, [showdownData]);

  // KNOCK EARNED — when latestKnock arrives
  useEffect(() => {
    if (latestKnock) {
      sounds.knock();
      sounds.vibrate([50, 30, 50]);
    }
  }, [latestKnock]);

  // GAME OVER — victory for winner, neutral for others
  useEffect(() => {
    if (gameOver) {
      const amWinner = gameOver.winnerName === myName;
      if (amWinner) {
        sounds.gameOverWin();
        sounds.vibrate([100, 50, 100, 50, 200]);
      } else {
        sounds.gameOverLose();
      }
    }
  // myName is stable once the game starts
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver]);

  if (gameOver) return <GameOverScreen data={gameOver} roomCode={roomCode} isHost={isHost} />;

  return (
    <div style={{
      display: 'grid',
      gridTemplateRows: 'calc(80px + env(safe-area-inset-top, 0px)) 1fr 120px calc(80px + env(safe-area-inset-bottom, 0px))',
      height: '100dvh',
      maxWidth: 480,
      margin: '0 auto',
      background: 'var(--bg-primary)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Zone 1 — Status Bar */}
      <StatusBar
        roomCode={roomCode}
        orbit={orbit}
        round={round}
        potTotal={potTotal}
        serverPhase={serverPhase}
        isMyTurn={isMyTurn}
      />

      {/* Zone 2 — Player Ring */}
      <PlayerRing />

      {/* Zone 3 — Hand Tray */}
      <HandTray cards={myCards} selectedCards={selectedCards} round={round} />

      {/* Zone 4 — Action Bar */}
      <ActionBar
        isMyTurn={isMyTurn}
        turnPhase={turnPhase}
        serverPhase={serverPhase}
        waitingFor={waitingFor}
        myName={myName}
        playerChoices={playerChoices}
        emitIn={emitIn}
        emitOut={emitOut}
        emitJoin={emitJoin}
        emitPass={emitPass}
      />

      {/* Overlays — rendered inside the grid container so they clip correctly */}

      {/* Knock banner (below status bar) */}
      {latestKnock && (
        <KnockBanner
          playerName={latestKnock.playerName}
          newKnockCount={latestKnock.newKnockCount}
          knockTarget={latestKnock.knockTarget}
          onDismiss={dismissKnock}
        />
      )}

      {/* Showdown overlay */}
      {showdownData && !showdownData.isPublic && (
        <ShowdownOverlay
          data={showdownData}
          myName={myName}
          onClose={dismissShowdown}
        />
      )}

      {/* Non-participant showdown toast */}
      {showdownData?.isPublic && (
        <ShowdownToast
          winnerName={showdownData.winner}
          payout={showdownData.payout}
          tie={showdownData.tie}
          onClose={dismissShowdown}
        />
      )}
    </div>
  );
}

// ── Lobby View ────────────────────────────────────────────────────────────────

interface LobbyPlayer { id: string; name: string }
interface StoredSession {
  playerName: string; roomCode: string; knockTarget: number; roundsPerOrbit: number;
  players: LobbyPlayer[]; hostId: string;
}

function LobbyView({ code, session }: { code: string; session: StoredSession }) {
  const [players,  setPlayers]  = useState<LobbyPlayer[]>(session.players);
  const [hostId,   setHostId]   = useState(session.hostId);
  const [copied,   setCopied]   = useState(false);
  const [shared,   setShared]   = useState(false);
  const [error,    setError]    = useState('');
  const socket = getSocket();
  const myId   = socket.id ?? '';
  const isHost = myId === hostId;

  useEffect(() => {
    const onJoined = (d: { players: LobbyPlayer[]; hostId: string }) => {
      setPlayers(d.players); setHostId(d.hostId);
    };
    const onLeft = (d: { players: LobbyPlayer[]; hostId: string }) => {
      setPlayers(d.players); setHostId(d.hostId);
    };
    const onErr = (d: { message: string }) => setError(d.message);

    socket.on('player_joined', onJoined);
    socket.on('player_left',   onLeft);
    socket.on('error',         onErr);
    return () => {
      socket.off('player_joined', onJoined);
      socket.off('player_left',   onLeft);
      socket.off('error',         onErr);
    };
  }, [socket]);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, [code]);

  const shareLink = `https://knocks.vercel.app/join/${code}`;
  const share = useCallback(async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: 'Join my Knocks game', url: shareLink });
      } else {
        await navigator.clipboard.writeText(shareLink);
        setShared(true);
        setTimeout(() => setShared(false), 1800);
      }
    } catch {
      await navigator.clipboard.writeText(shareLink);
      setShared(true);
      setTimeout(() => setShared(false), 1800);
    }
  }, [shareLink]);

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '0 24px',
    }}>
      <div style={{ width: '100%', maxWidth: 360 }}>

        {/* Room code */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
            color: 'var(--text-muted)', marginBottom: 16,
          }}>
            Room Code
          </div>
          <button
            onClick={copy}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 10,
            }}
          >
            <span className="mono" style={{
              fontSize: 40, fontWeight: 700, letterSpacing: '0.2em',
              color: 'var(--text-primary)',
            }}>
              {code}
            </span>
            <span style={{
              fontSize: 16, color: copied ? 'var(--text-secondary)' : 'var(--text-muted)',
              transition: 'color 150ms ease',
            }}>
              {copied ? '\u2713' : '\u2398'}
            </span>
          </button>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
            Share this code with your friends
          </p>

          {/* Share link button */}
          <button
            onClick={share}
            style={{
              marginTop: 10,
              background: 'none',
              border: '1px solid var(--border-medium)',
              borderRadius: 6,
              padding: '8px 20px',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: shared ? 'var(--text-secondary)' : 'var(--text-muted)',
              transition: 'color 150ms ease, border-color 150ms ease',
              fontFamily: 'var(--font-outfit), sans-serif',
            }}
          >
            {shared ? 'Link Copied!' : 'Share Link'}
          </button>
        </div>

        {/* Knock target + rounds per orbit pill */}
        <div style={{
          border: '1px solid var(--border-subtle)',
          padding: '12px 20px', textAlign: 'center',
          marginBottom: 28, borderRadius: 4,
          display: 'flex', justifyContent: 'center', gap: 20,
        }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Playing to{' '}
            <span className="mono" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
              {session.knockTarget}
            </span>
            {' '}knock{session.knockTarget !== 1 ? 's' : ''}
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            <span className="mono" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
              {session.roundsPerOrbit ?? 5}
            </span>
            {' '}rounds/orbit
          </span>
        </div>

        {/* Player list */}
        <div style={{ marginBottom: 28 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', marginBottom: 12,
          }}>
            <span style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Players
            </span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {players.length} / 6
            </span>
          </div>

          {players.map((p, i) => (
            <div
              key={p.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 0',
                borderBottom: i < players.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              }}
            >
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', width: 18 }}>
                {i + 1}.
              </span>
              <span style={{ flex: 1, fontSize: 14, color: 'var(--text-primary)' }}>
                {p.name}
                {p.id === myId && (
                  <span style={{
                    marginLeft: 8, fontSize: 9, letterSpacing: '0.1em',
                    textTransform: 'uppercase', color: 'var(--text-muted)',
                  }}>
                    you
                  </span>
                )}
              </span>
              {p.id === hostId && (
                <span style={{
                  fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-muted)', padding: '2px 7px', borderRadius: 2,
                }}>
                  Host
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Host CTA */}
        {isHost ? (
          <>
            <button
              onClick={() => { setError(''); socket.emit('start_game', { roomCode: code }); }}
              disabled={players.length < 2}
              style={{
                width: '100%', padding: '15px 0',
                fontSize: 13, fontWeight: 500,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                border: `1px solid ${players.length >= 2 ? 'var(--border-bright)' : 'var(--border-subtle)'}`,
                borderRadius: 8,
                background: players.length >= 2 ? 'var(--border-medium)' : 'var(--bg-elevated)',
                color: players.length >= 2 ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: players.length >= 2 ? 'pointer' : 'not-allowed',
                transition: 'all 150ms ease-out',
                fontFamily: 'var(--font-outfit), sans-serif',
              }}
            >
              Start Game
            </button>
            {players.length < 2 && (
              <p style={{
                marginTop: 10, textAlign: 'center', fontSize: 11,
                color: 'var(--text-muted)', letterSpacing: '0.05em',
              }}>
                Waiting for {2 - players.length} more player{2 - players.length !== 1 ? 's' : ''} to join
              </p>
            )}
          </>
        ) : (
          <p className="waiting-pulse" style={{
            textAlign: 'center', fontSize: 11,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}>
            Waiting for host to start&hellip;
          </p>
        )}

        {error && (
          <p style={{
            marginTop: 20, textAlign: 'center', fontSize: 11,
            color: 'var(--text-muted)', letterSpacing: '0.05em',
          }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Root page ─────────────────────────────────────────────────────────────────

export default function RoomPage() {
  const router = useRouter();
  const params = useParams();
  const code   = (params.code as string).toUpperCase();

  const [session,     setSession]     = useState<StoredSession | null>(null);
  const [gameStarted, setGameStarted] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('knocks_session');
    if (!stored) { router.push('/'); return; }
    const parsed: StoredSession = JSON.parse(stored);
    if (parsed.roomCode !== code) { router.push('/'); return; }
    setSession(parsed);

    const socket = getSocket();
    const onGameStarted = () => setGameStarted(true);
    socket.on('game_started', onGameStarted);
    // Attempt to rejoin an active game (handles page refresh mid-game).
    // Silent no-op on the server if no game has started yet.
    socket.emit('rejoin_game', { roomCode: code, playerName: parsed.playerName });
    const onSnapshot = () => setGameStarted(true);
    socket.on('state_snapshot', onSnapshot);

    const onRematchStarted = (d: { players: LobbyPlayer[]; hostId: string; knockTarget: number }) => {
      setSession((prev) => prev ? { ...prev, players: d.players, hostId: d.hostId } : null);
      const s = sessionStorage.getItem('knocks_session');
      if (s) {
        sessionStorage.setItem('knocks_session', JSON.stringify({
          ...JSON.parse(s), players: d.players, hostId: d.hostId,
        }));
      }
      setGameStarted(false);
    };
    socket.on('rematch_started', onRematchStarted);

    // Re-join the server room on every reconnect (handles network blips in the
    // lobby where ReconnectBanner isn't mounted, and supplements it mid-game).
    let wasConnected = socket.connected;
    const onReconnect = () => {
      if (wasConnected) {
        // Genuine reconnect — not the initial connection event
        socket.emit('rejoin_game', { roomCode: code, playerName: parsed.playerName });
      }
      wasConnected = true;
    };
    socket.on('connect', onReconnect);

    return () => {
      socket.off('game_started', onGameStarted);
      socket.off('state_snapshot', onSnapshot);
      socket.off('rematch_started', onRematchStarted);
      socket.off('connect', onReconnect);
    };
  }, [code, router]);

  if (!session) return null;

  if (!gameStarted) {
    return <LobbyView code={code} session={session} />;
  }

  return (
    <GameProvider knockTarget={session.knockTarget} roundsPerOrbit={session.roundsPerOrbit ?? 5} roomCode={code}>
      <ReconnectBanner roomCode={code} playerName={session.playerName} />
      <GameBoard roomCode={code} hostId={session.hostId} />
    </GameProvider>
  );
}
