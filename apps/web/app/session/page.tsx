'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSessionClient, SessionClient, ConnectionState, SessionStats } from 'session-sdk';
import SessionPlayer from '../../components/SessionPlayer';
import Toolbar from '../../components/Toolbar';
import StatsPanel from '../../components/StatsPanel';

export default function SessionPage() {
  const router = useRouter();
  const clientRef = useRef<SessionClient | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [stats, setStats] = useState<SessionStats | null>(null);

  useEffect(() => {
    const paramsStr = sessionStorage.getItem('connectionParams');
    if (!paramsStr) {
      router.push('/connect');
      return;
    }
    const params = JSON.parse(paramsStr);

    const client = createSessionClient();
    clientRef.current = client;

    client.onConnectionState((state, err) => {
      setConnectionState(state);
      if (state === 'disconnected' && err) console.error('Disconnected:', err);
    });

    client.onVideoStream((stream) => setVideoStream(stream));
    client.onStats((s) => setStats(s));

    client.connect({
  baseUrl: params.host,
  wsPath: params.wsPath,
  username: params.username,
  password: params.password,
  backend: 'neko'
}).catch(console.error);
    client.startStats(2000);

    return () => {
      client.disconnect();
    };
  }, [router]);

  const handleKeyframe = () => clientRef.current?.requestKeyframe();
  const handleQualityChange = (profile: '1080p' | '720p' | '480p') => clientRef.current?.setQualityProfile(profile);

  return (
    <div className="flex flex-col h-screen">
      <Toolbar
        connectionState={connectionState}
        onRequestKeyframe={handleKeyframe}
        onSetQuality={handleQualityChange}
      />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative bg-black">
          {videoStream ? (
            <SessionPlayer videoStream={videoStream} client={clientRef.current!} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-white">
              {connectionState === 'connecting' && 'Connecting...'}
              {connectionState === 'reconnecting' && 'Reconnecting...'}
              {connectionState === 'disconnected' && 'Disconnected'}
            </div>
          )}
        </div>
        <StatsPanel stats={stats} />
      </div>
    </div>
  );
}