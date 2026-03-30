import { useState, useEffect, useRef } from "react";

export function MetricsPanel({ peerConnection }) {
  const [stats, setStats] = useState({
    connectionState: "new",
    iceState: "new",
    fps: 0,
    bitrate: 0,
    packetsLost: 0,
    jitter: 0,
  });

  const [logs, setLogs] = useState([]);
  const prevBytesRef = useRef(0);
  const prevTimeRef = useRef(Date.now());

  function addLog(msg) {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${time}] ${msg}`, ...prev].slice(0, 50));
  }

  useEffect(() => {
    if (!peerConnection) return;

    const onConnectionChange = () => {
      setStats((prev) => ({ ...prev, connectionState: peerConnection.connectionState }));
      addLog(`Connection state: ${peerConnection.connectionState}`);
    };

    const onIceChange = () => {
      setStats((prev) => ({ ...prev, iceState: peerConnection.iceConnectionState }));
      addLog(`ICE state: ${peerConnection.iceConnectionState}`);
    };

    peerConnection.addEventListener("connectionstatechange", onConnectionChange);
    peerConnection.addEventListener("iceconnectionstatechange", onIceChange);

    const statsInterval = setInterval(async () => {
      const report = await peerConnection.getStats();

      report.forEach((s) => {
        if (s.type === "inbound-rtp" && s.kind === "video") {
          const now = Date.now();
          const elapsed = (now - prevTimeRef.current) / 1000;
          const bytesDiff = s.bytesReceived - prevBytesRef.current;
          const bitrate = Math.round((bytesDiff * 8) / elapsed / 1000);

          prevBytesRef.current = s.bytesReceived;
          prevTimeRef.current = now;

          setStats((prev) => ({
            ...prev,
            fps: s.framesPerSecond ?? 0,
            bitrate,
            packetsLost: s.packetsLost ?? 0,
            jitter: Math.round((s.jitter ?? 0) * 1000),
          }));
        }
      });
    }, 2000);

    return () => {
      peerConnection.removeEventListener("connectionstatechange", onConnectionChange);
      peerConnection.removeEventListener("iceconnectionstatechange", onIceChange);
      clearInterval(statsInterval);
    };
  }, [peerConnection]);

  return (
    <div style={styles.container}>
      <div style={styles.section}>
        <h3 style={styles.heading}>Live Metrics</h3>
        <p>Connection: <b>{stats.connectionState}</b></p>
        <p>ICE: <b>{stats.iceState}</b></p>
        <p>FPS: <b>{stats.fps}</b></p>
        <p>Bitrate: <b>{stats.bitrate} kbps</b></p>
        <p>Packets Lost: <b>{stats.packetsLost}</b></p>
        <p>Jitter: <b>{stats.jitter} ms</b></p>
      </div>

      <div style={styles.section}>
        <h3 style={styles.heading}>Debug Log</h3>
        <div style={styles.logBox}>
          {logs.map((log, i) => (
            <p key={i} style={styles.logLine}>{log}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    fontFamily: "monospace",
    fontSize: "12px",
    background: "#1a1a1a",
    color: "#e0e0e0",
    padding: "12px",
    borderRadius: "8px",
    width: "300px",
  },
  section: {
    marginBottom: "16px",
  },
  heading: {
    fontSize: "13px",
    marginBottom: "8px",
    color: "#ffffff",
  },
  logBox: {
    maxHeight: "200px",
    overflowY: "auto",
    background: "#111",
    padding: "8px",
    borderRadius: "4px",
  },
  logLine: {
    margin: "2px 0",
    color: "#a0a0a0",
  },
};