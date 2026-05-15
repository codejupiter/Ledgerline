import { useEffect, useState } from 'react';
import { useFrameStats } from '../hooks/useFrameStats';
import { getBinanceClient } from '../lib/binanceClient';

export function PerfOverlay() {
  const stats = useFrameStats();
  const [msgs, setMsgs] = useState({
    received: 0,
    dropped: 0,
    rate: 0,
    latency: 0,
    reconnects: 0,
  });

  useEffect(() => {
    const client = getBinanceClient();
    let prev = client.stats.messagesReceived;
    let prevT = performance.now();
    const interval = setInterval(() => {
      const now = performance.now();
      const dt = (now - prevT) / 1000;
      const delta = client.stats.messagesReceived - prev;
      const rate = dt > 0 ? Math.round(delta / dt) : 0;
      prev = client.stats.messagesReceived;
      prevT = now;
      setMsgs({
        received: client.stats.messagesReceived,
        dropped: client.stats.messagesDropped,
        rate,
        latency: client.stats.lastLatencyMs,
        reconnects: client.stats.reconnects,
      });
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const fpsColor = stats.fps >= 55 ? '#8FE3B2' : stats.fps >= 30 ? '#E3D88F' : '#E37B85';

  return (
    <div
      data-testid="perf-overlay"
      className="perf-overlay"
      role="status"
      aria-label="Performance metrics"
      style={{
        background: 'rgba(15, 15, 13, 0.85)',
        backdropFilter: 'blur(8px)',
        border: '1px solid #1a1a17',
        borderRadius: 6,
        padding: '8px 12px',
        fontSize: 11,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        color: '#a8a89e',
        display: 'grid',
        gridTemplateColumns: 'auto auto',
        gap: '2px 12px',
        zIndex: 100,
        minWidth: 200,
      }}
    >
      <Stat label="FPS" value={String(stats.fps)} color={fpsColor} />
      <Stat
        label="Frame avg"
        value={`${stats.avgFrameMs.toFixed(1)}ms`}
      />
      <Stat
        label="Frame worst"
        value={`${stats.worstFrameMs.toFixed(1)}ms`}
      />
      <Stat
        label="Dropped"
        value={`${stats.droppedFrames}/${Math.min(120, stats.totalFrames)}`}
      />
      <Sep />
      <Stat label="Msg/s" value={String(msgs.rate)} />
      <Stat label="Total" value={String(msgs.received)} />
      <Stat
        label="Buffer dropped"
        value={String(msgs.dropped)}
        color={msgs.dropped > 0 ? '#E3D88F' : undefined}
      />
      <Stat label="Latency" value={`${msgs.latency}ms`} />
      <Stat
        label="Reconnects"
        value={String(msgs.reconnects)}
        color={msgs.reconnects > 0 ? '#E3D88F' : undefined}
      />
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <>
      <div style={{ color: '#5a5a52' }}>{label}</div>
      <div style={{ textAlign: 'right', color: color ?? '#c8c8be' }}>{value}</div>
    </>
  );
}

function Sep() {
  return (
    <div
      style={{
        gridColumn: '1 / -1',
        height: 1,
        background: '#1a1a17',
        margin: '4px 0',
      }}
    />
  );
}
