'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ConnectPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    host: 'localhost:8080',
    wsPath: '/ws',
    username: 'user',
    password: 'neko',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Save connection details in sessionStorage
    sessionStorage.setItem('connectionParams', JSON.stringify(form));
    router.push('/session');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6">Connect to Neko</h1>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Host:port</label>
          <input
            type="text"
            value={form.host}
            onChange={(e) => setForm({ ...form, host: e.target.value })}
            className="w-full border p-2 rounded"
            placeholder="localhost:8080"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">WebSocket Path</label>
          <input
            type="text"
            value={form.wsPath}
            onChange={(e) => setForm({ ...form, wsPath: e.target.value })}
            className="w-full border p-2 rounded"
            placeholder="/ws"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Username</label>
          <input
            type="text"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            className="w-full border p-2 rounded"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full border p-2 rounded"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          Connect
        </button>
      </form>
    </div>
  );
}