import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Monitor, VideoOff, Volume2, VolumeX, Scan, Cpu, Activity, Wifi, Clock, Terminal, Radio } from 'lucide-react';

// الاتصال بخادم الإشارات (استبدلي localhost بـ IP اللابتوب عند التجربة من الجوال)
// استبدلي هذا الرابط برابط السيرفر بعد رفعه على Render (مثال: https://my-signaling-server.onrender.com)
// استبدلي هذا برابط Render الفعلي وليس Vercel
const SERVER_URL = 'https://livecam-0jst.onrender.com'; 
const socket = io(SERVER_URL);

export default function Dashboard() {
  const [cameras, setCameras] = useState({
    'CAM-01': { connected: false, name: 'ستيم', muted: false, fps: 0, bitrate: '0 Mbps' },
    'CAM-02': { connected: false, name: 'المهارات الرقمية', muted: false, fps: 0, bitrate: '0 Mbps' }
  });
  
  const [systemHealth, setSystemHealth] = useState({ cpu: 18, ram: 38, latency: 5 });
  const [logs, setLogs] = useState([]);
  const [currentTime, setCurrentTime] = useState('');

  const videoRef1 = useRef(null);
  const videoRef2 = useRef(null);
  const peerConnections = useRef({});

  // تكوين إعدادات STUN Server لتخطي جدران الحماية للشبكة المحلية
 const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:global.metered.ca:443',
      username: 'YOUR_METERED_USERNAME',
      credential: 'YOUR_METERED_PASSWORD'
    }
  ],
  iceCandidatePoolSize: 10
};
  useEffect(() => {
    // 1. تحديثات ساعة النظام والـ Telemetry
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
    const healthTimer = setInterval(() => {
      setSystemHealth(prev => ({
        cpu: Math.floor(Math.random() * (28 - 12) + 12),
        ram: Math.floor(Math.random() * (42 - 36) + 36),
        latency: Math.floor(Math.random() * (12 - 4) + 4)
      }));
    }, 4000);

    addLog('info', 'تم تشغيل استوديو البث بانتظار إشارات الهواتف...');

    // 2. الاستماع لاتصالات WebRTC من خادم الإشارات
    socket.emit('join-studio', { type: 'dashboard' });

    socket.on('webrtc-offer', async ({ camId, offer }) => {
      addLog('success', `تم استقبال طلب اتصال (Offer) من ${camId}`);
      
      const pc = new RTCPeerConnection(rtcConfig);
      peerConnections.current[camId] = pc;

      // عند استقبال الـ Stream من الهاتف، نربطه بعنصر الفيديو المناسب
      pc.ontrack = (event) => {
        addLog('success', `تم ربط دفق الفيديو المباشر لـ ${camId}`);
        if (camId === 'CAM-01' && videoRef1.current) videoRef1.current.srcObject = event.streams[0];
        if (camId === 'CAM-02' && videoRef2.current) videoRef2.current.srcObject = event.streams[0];
        
        setCameras(prev => ({
          ...prev,
          [camId]: { ...prev[camId], connected: true, fps: 60, bitrate: '4.2 Mbps' }
        }));
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('webrtc-candidate', { camId, candidate: event.candidate, to: 'mobile' });
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      socket.emit('webrtc-answer', { camId, answer });
    });

    socket.on('webrtc-candidate', async ({ camId, candidate }) => {
      if (peerConnections.current[camId]) {
        await peerConnections.current[camId].addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    socket.on('device-disconnected', (socketId) => {
      // التعامل مع انقطاع البث المفاجئ
      addLog('error', 'انقطع اتصال أحد الأجهزة التابع للشبكة.');
    });

    return () => {
      clearInterval(timer);
      clearInterval(healthTimer);
      socket.off();
    };
  }, []);

  const addLog = (type, text) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [{ id: Date.now(), time, type, text }, ...prev.slice(0, 6)]);
  };

  const toggleMute = (camId) => {
    setCameras(prev => {
      const updated = { ...prev, [camId]: { ...prev[camId], muted: !prev[camId].muted } };
      if (camId === 'CAM-01' && videoRef1.current) videoRef1.current.muted = updated[camId].muted;
      if (camId === 'CAM-02' && videoRef2.current) videoRef2.current.muted = updated[camId].muted;
      addLog('info', `تم تغيير حالة الصوت لجهاز ${camId}`);
      return updated;
    });
  };

  const takeScreenshot = (camName) => {
    addLog('info', `تم التقاط لقطة شاشة للـ Feed الخاص بـ ${camName}`);
    alert(`📸 تم حفظ لقطة الشاشة لـ ${camName} بنجاح!`);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 antialiased overflow-x-hidden font-sans">
      {/* HEADER HUD */}
      <header className="border-b border-slate-800 bg-[#0f172a]/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-600"></span>
          </div>
          <div>
            <h1 className="text-lg font-black tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-500 uppercase">
              العرض المباشر | مدراس الأندلس الأهلية -الزهراء بنات
            </h1>
          </div>
        </div>

        {/* TELEMETRY */}
        <div className="flex items-center gap-6 text-xs font-mono bg-slate-900/60 p-2 rounded-xl border border-slate-800" dir="ltr">
          <div className="flex items-center space-x-1.5 text-blue-400"><Cpu size={14} /><span>CPU: {systemHealth.cpu}%</span></div>
          <div className="flex items-center space-x-1.5 text-purple-400"><Activity size={14} /><span>RAM: {systemHealth.ram}%</span></div>
          <div className="flex items-center space-x-1.5 text-emerald-400"><Wifi size={14} /><span>LATENCY: {systemHealth.latency}ms</span></div>
          <div className="hidden sm:flex items-center space-x-1.5 text-amber-400"><Clock size={14} /><span>{currentTime}</span></div>
        </div>
      </header>

      {/* MATRIX STREAM GRID */}
      <main className="max-w-[1800px] mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        <section class="lg:col-span-3 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(cameras).map(([id, cam], index) => (
              <div key={id} className="bg-slate-900/40 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl backdrop-blur-xl group hover:border-purple-500/40 transition-all">
                <div class="p-4 bg-slate-950/60 flex justify-between items-center border-b border-slate-800/60">
                  <div className="flex items-center space-x-3 space-x-reverse">
                    <div className="p-2 bg-slate-900 rounded-lg text-purple-400"><Monitor size={16} /></div>
                    <div>
                      <h3 className="font-bold text-sm">{cam.name}</h3>
                      <p className="text-[10px] font-mono text-slate-500">{id} • 1080p</p>
                    </div>
                  </div>
                  <div>
                    {cam.connected ? (
                      <span className="bg-red-500/10 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded border border-red-500/20 flex items-center gap-1.5 animate-pulse">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span> LIVE
                      </span>
                    ) : (
                      <span className="bg-slate-800 text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-700">OFFLINE</span>
                    )}
                  </div>
                </div>

                {/* VIDEO WRAPPER */}
                <div className="relative aspect-video bg-black flex items-center justify-center">
                  <video ref={index === 0 ? videoRef1 : videoRef2} autoPlay playsInline className={`w-full h-full object-cover transform scale-x-[-1] ${!cam.connected && 'hidden'}`} />
                  {!cam.connected && (
                    <div className="text-center space-y-2">
                      <div className="mx-auto w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600"><VideoOff size={18} /></div>
                      <p className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">Awaiting WebRTC Ingestion Pipeline</p>
                    </div>
                  )}
                  {cam.connected && (
                    <div className="absolute top-3 left-3 bg-slate-950/80 px-2 py-0.5 rounded text-[10px] font-mono text-slate-300 border border-slate-800" dir="ltr">
                      FPS: {cam.fps} | BITRATE: {cam.bitrate}
                    </div>
                  )}
                </div>

                {/* CONTROLS */}
                <div className="p-4 bg-slate-950/40 border-t border-slate-800/60 flex justify-between items-center">
                  <div className="flex gap-2">
                    <button onClick={() => toggleMute(id)} disabled={!cam.connected} className={`p-2 rounded-xl border transition-all ${cam.muted ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-slate-900 border-slate-800 text-slate-300'}`}>
                      {cam.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                    <button onClick={() => takeScreenshot(cam.name)} disabled={!cam.connected} className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300"><Scan size={16} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* LOGS TERMINAL */}
          <div className="bg-slate-950/80 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
            <div className="p-3 bg-slate-900/60 border-b border-slate-800/60 flex items-center space-x-2 space-x-reverse px-4">
              <Terminal size={14} className="text-purple-400" />
              <span className="text-xs font-mono text-slate-400"> سجل جودة إشارة البث </span>
            </div>
            <div className="p-4 font-mono text-xs space-y-2 max-h-[140px] overflow-y-auto custom-scrollbar">
              {logs.map(log => (
                <div key={log.id} className="flex items-start space-x-2 space-x-reverse">
                  <span className="text-slate-600">[{log.time}]</span>
                  <span className={`font-bold uppercase text-[9px] px-1 rounded ${log.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>{log.type}</span>
                  <span className="text-slate-300 mr-2">{log.text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SIDE QR PANEL */}
        <section className="space-y-6">
          <div className="bg-gradient-to-b from-slate-900/60 to-slate-950/40 rounded-2xl border border-slate-800 p-5 shadow-xl">
            <div className="flex items-center space-x-2 space-x-reverse mb-4 text-blue-400"><Radio size={18} /><h2> الربط المباشر مع هاتف </h2></div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed"> امسحي الرمز للربط المباشر مع الهاتف</p>
            <div className="bg-white p-3 rounded-xl max-w-[150px] mx-auto border border-purple-500/30">
             
<img 
  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${window.location.origin}/ingest`} 
  alt="QR Link" 
  className="w-full h-auto" 
/>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}