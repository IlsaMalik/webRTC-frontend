"use client";

import { useState, useEffect, useRef } from "react";
import { PeerSession } from "../lib/peerSession.js";
import { ReconnectManager } from "../lib/reconnectManager.js";
import { attachInputCapture } from "../lib/inputCapture.js";
import s from "./WebRTCSession.module.css";

const BASE = "http://localhost:8081";

async function fetchToken() {
  const res = await fetch(`${BASE}/sessions/demo-token?user_id=demo-user-1`);
  const data = await res.json();
  return (data.token || "").replace(/^Bearer\s+/i, "").trim();
}

async function createSession(jwt) {
  const res = await fetch(`${BASE}/sessions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ metadata: { source: "frontend" }, diagnostic: false }),
  });
  const data = await res.json();
  return data.session_id;
}

async function fetchBootstrap(sessionId, jwt) {
  const res = await fetch(
    `${BASE}/sessions/${sessionId}/bootstrap?token=${jwt}`,
    { method: "POST" }
  );
  return await res.json();
}

async function waitForReady(sessionId, jwt) {
  const timeoutMs = 20000;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${BASE}/sessions/${sessionId}`, {
      headers: { "Authorization": `Bearer ${jwt}` },
    });
    if (res.ok) {
      const data = await res.json();
      const state = data.state || data.session_state || "";
      if (state === "READY" || state === "ACTIVE") return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Pod not ready (timeout)");
}

export default function WebRTCSession() {
  const [status, setStatus]       = useState("Initializing...");
  const [isError, setIsError]     = useState(false);
  const [isReady, setIsReady]     = useState(false);
  const [isMuted, setIsMuted]     = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [duration, setDuration]   = useState(0);
  const [metrics, setMetrics]     = useState({
    fps: 0, bitrate: 0, packetsLost: 0,
    jitter: 0, connectionState: "new", iceState: "new",
  });

  const videoRef      = useRef(null);
  const videoWrapRef  = useRef(null);
  const sessionRef    = useRef(null);
  const cleanupRef    = useRef(null);
  const managerRef    = useRef(null);
  const pcRef         = useRef(null);

  // Duration timer
  useEffect(() => {
    if (!isReady) return;
    const timer = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(timer);
  }, [isReady]);

  // Metrics polling
  useEffect(() => {
    if (!isReady || !pcRef.current) return;
    let prevBytes = 0;
    let prevTime  = Date.now();

    const interval = setInterval(async () => {
      if (!pcRef.current) return;
      const report = await pcRef.current.getStats();
      report.forEach((stat) => {
        if (stat.type === "inbound-rtp" && stat.kind === "video") {
          const now     = Date.now();
          const elapsed = (now - prevTime) / 1000;
          const diff    = stat.bytesReceived - prevBytes;
          prevBytes     = stat.bytesReceived;
          prevTime      = now;
          setMetrics({
            fps:             Math.round(stat.framesPerSecond ?? 0),
            bitrate:         Math.round((diff * 8) / elapsed / 1000),
            packetsLost:     stat.packetsLost ?? 0,
            jitter:          Math.round((stat.jitter ?? 0) * 1000),
            connectionState: pcRef.current?.connectionState ?? "—",
            iceState:        pcRef.current?.iceConnectionState ?? "—",
          });
        }
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isReady]);

  useEffect(() => {
    async function startSession() {
      try {
        setIsError(false);

        setStatus("Getting token...");
        const jwt = await fetchToken();

        setStatus("Creating session...");
        const sid = await createSession(jwt);
        setSessionId(sid);

        setStatus("Fetching bootstrap...");
        const boot = await fetchBootstrap(sid, jwt);
        const signalingUrl = boot.signalingUrl || boot.signaling_url;
        const iceServers   = boot.iceServers   || boot.ice_servers || [];

        setStatus("Waiting for pod...");
        await waitForReady(sid, jwt);

        setStatus("Connecting...");

        const session = new PeerSession(signalingUrl, iceServers);
        sessionRef.current = session;

        session.onTrack = (stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
            setIsReady(true);
            setStatus("Connected");
          }
        };

        session.onInputChannelOpen = () => {
          if (videoRef.current && session.inputChannel) {
            cleanupRef.current = attachInputCapture(
              videoRef.current,
              session.inputChannel
            );
          }
        };

        session.onInputChannelClose = () => {
          cleanupRef.current?.();
          cleanupRef.current = null;
        };

        await session.start(sid);
        pcRef.current = session.pc;

      } catch (err) {
        setIsError(true);
        setStatus(`Error: ${err.message}`);
        throw err;
      }
    }

    const manager = new ReconnectManager(startSession, {
      maxRetries: 5,
      baseDelay: 1000,
    });
    managerRef.current = manager;
    manager.run();

    return () => {
      manager.stop();
      cleanupRef.current?.();
      sessionRef.current?.stop();
    };
  }, []);

  const formatDuration = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s2 = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s2}`;
  };

  const shortId = sessionId
    ? sessionId.split("-")[0].toUpperCase()
    : "—";

  function toggleMute() {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      videoWrapRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }

  function handleDisconnect() {
    cleanupRef.current?.();
    sessionRef.current?.stop();
    managerRef.current?.stop();
    setIsReady(false);
    setStatus("Disconnected");
  }

  return (
    <div className={s.page}>

      {/* ── NAVBAR ── */}
      <div className={s.navbar}>
        <div className={s.navLeft}>
          <span className={s.navDivider}>|</span>
          <span className={s.navTitle}>Remote Session</span>
        </div>
        <div className={s.navRight}>
          <div className={`${s.statusPill} ${
            isError ? s.statusPillError :
            isReady ? s.statusPillConnected :
            s.statusPillConnecting
          }`}>
            <span className={`${s.statusDot} ${
              isError ? s.statusDotError :
              isReady ? s.statusDotConnected :
              s.statusDotConnecting
            }`} />
            {status}
          </div>
        </div>
      </div>

      {/* ── LOADING ── */}
      {!isReady && (
        <div className={s.loadingScreen}>
          <div className={s.loadingCard}>
            <div className={s.logoLarge}>⬡</div>
            <h2 className={s.loadingTitle}>BotGauge Remote</h2>
            <div className={s.loadingSpinner} />
            <p className={`${s.loadingStatus} ${isError ? s.loadingStatusError : ""}`}>
              {status}
            </p>
            {isError && (
              <button
                className={s.retryBtn}
                onClick={() => managerRef.current?.run()}
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── MAIN ── */}
      <div className={s.main}>

        {/* LEFT — Video + Toolbar */}
        <div className={s.videoSide}>
          <div className={s.videoWrapper} ref={videoWrapRef}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={s.video}
            />
          </div>

          {/* Bottom toolbar */}
          <div className={s.toolbar}>
            <div className={s.toolbarLeft}>
              <span className={s.toolbarTime}>{formatDuration(duration)}</span>
            </div>

            <div className={s.toolbarCenter}>
              {/* Mute */}
              <button
                className={`${s.toolbarBtn} ${isMuted ? s.toolbarBtnMuted : ""}`}
                onClick={toggleMute}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? "🔇" : "🔊"}
              </button>

              {/* Disconnect */}
              <button
                className={s.toolbarBtnEnd}
                onClick={handleDisconnect}
                title="End Session"
              >
                ✕
              </button>

              {/* Fullscreen */}
              <button
                className={`${s.toolbarBtn} ${isFullscreen ? s.toolbarBtnActive : ""}`}
                onClick={toggleFullscreen}
                title="Fullscreen"
              >
                {isFullscreen ? "⊠" : "⛶"}
              </button>
            </div>

            <div className={s.toolbarRight}>
              <span className={s.toolbarStatus}>
                {isReady ? "● Live" : "○ Offline"}
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT — Sidebar */}
        <div className={s.sidebar}>

          {/* Session Info */}
          <div className={s.sidebarCard}>
            <div className={s.sidebarCardTitle}>Session Info</div>
            <div className={s.infoRow}>
              <span className={s.infoLabel}>Session ID</span>
              <span className={s.infoValue}>{shortId}</span>
            </div>
            <div className={s.infoRow}>
              <span className={s.infoLabel}>Duration</span>
              <span className={s.infoValue}>{formatDuration(duration)}</span>
            </div>
            <div className={s.infoRow}>
              <span className={s.infoLabel}>Status</span>
              <span className={`${s.infoValue} ${isError ? s.infoValueRed : s.infoValueGreen}`}>
                {isReady ? "Active" : isError ? "Failed" : "Connecting"}
              </span>
            </div>
            <div className={s.infoRow}>
              <span className={s.infoLabel}>Connection</span>
              <span className={s.infoValue}>{metrics.connectionState}</span>
            </div>
            <div className={s.infoRow}>
              <span className={s.infoLabel}>ICE</span>
              <span className={s.infoValue}>{metrics.iceState}</span>
            </div>
          </div>

          {/* Live Metrics — always visible */}
          <div className={s.sidebarCard}>
            <div className={s.sidebarCardTitle}>Live Metrics</div>
            <div className={s.metricRow}>
              <span className={s.metricLabel}>FPS</span>
              <span className={s.metricValue}>{metrics.fps}</span>
            </div>
            <div className={s.metricRow}>
              <span className={s.metricLabel}>Bitrate</span>
              <span className={s.metricValue}>{metrics.bitrate} kbps</span>
            </div>
            <div className={s.metricRow}>
              <span className={s.metricLabel}>Packets Lost</span>
              <span className={s.metricValue}>{metrics.packetsLost}</span>
            </div>
            <div className={s.metricRow}>
              <span className={s.metricLabel}>Jitter</span>
              <span className={s.metricValue}>{metrics.jitter} ms</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}