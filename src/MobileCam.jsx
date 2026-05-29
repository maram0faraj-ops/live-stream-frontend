import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Camera, Radio, Wifi, VideoOff, Smartphone, ShieldCheck } from 'lucide-react';

// الاتصال بخادم الإشارات المشترك
// استبدلي هذا الرابط برابط السيرفر بعد رفعه على Render (مثال: https://my-signaling-server.onrender.com)
const SERVER_URL = 'https://livecam-0jst.onrender.com'; 
const socket = io(SERVER_URL);

export default function MobileCam() {
  const [selectedCam, setSelectedCam] = useState('CAM-01'); // تحديد معرف الكاميرا (CAM-01 أو CAM-02)
  const [status, setStatus] = useState('idle'); // idle, streaming, error
  const [logStatus, setLogStatus] = useState('بانتظار بدء التهيئة...');
  
  const localVideoRef = useRef(null);
  const peerConnection = useRef(null);
  const localStream = useRef(null);

  const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ],
  iceCandidatePoolSize: 10 // تحسين سرعة بناء الاتصال عبر الإنترنت العام
};

  // 1. تشغيل الكاميرا فور فتح الرابط وتأكيد الصلاحيات
  useEffect(() => {
    async function initCamera() {
      try {
        setLogStatus('جاري طلب إذن الوصول للكاميرا والمايكروفون...');
        
        // طلب أعلى إعدادات ممكنة مدعومة من كاميرا الجوال الخلفية بشكل تفضيلي (facingMode)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment', 
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 60 }
          },
          audio: true
        });

        localStream.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setStatus('ready');
        setLogStatus('الكاميرا جاهزة للبث الحقيقي.');
      } catch (err) {
        console.error(err);
        setStatus('error');
        setLogStatus('خطأ: فشل الوصول للكاميرا. يرجى تفعيل الصلاحيات.');
      }
    }

    initCamera();

    // الاستماع للإشارات الراجعة من الـ Dashboard (الـ Answer والـ Candidates)
    socket.on('webrtc-answer', async ({ camId, answer }) => {
      if (camId === selectedCam && peerConnection.current) {
        setLogStatus('تم قبول الاتصال من لوحة الإخراج. البث نشط الآن.');
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
        setStatus('streaming');
      }
    });

    socket.on('webrtc-candidate', async ({ camId, candidate }) => {
      if (camId === selectedCam && peerConnection.current) {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    return () => {
      stopStreaming();
      socket.off();
    };
  }, [selectedCam]);

  // 2. بدء عملية ضخ دفق البيانات والـ Signaling Handshake
  const startStreaming = async () => {
    if (!localStream.current) return;

    setLogStatus('جاري إنشاء قناة Peer Connection وضخ حزم البيانات...');
    const pc = new RTCPeerConnection(rtcConfig);
    peerConnection.current = pc;

    // إضافة المسارات (Tracks) الصوتية والمرئية للـ WebRTC Pipeline
    localStream.current.getTracks().forEach(track => {
      pc.addTrack(track, localStream.current);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc-candidate', { camId: selectedCam, candidate: event.candidate, to: 'dashboard' });
      }
    };

    // إنشاء الـ Offer البرمجي وإرساله فوراً للمخرج
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    socket.emit('webrtc-offer', { camId: selectedCam, offer });
    setLogStatus('تم إرسال طلب البث (Offer).. بانتظار استجابة المخرج.');
  };

  const stopStreaming = () => {
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    setStatus('ready');
    setLogStatus('تم إيقاف البث يدوياً. الكاميرا في وضع الاستعداد.');
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-200 p-4 flex flex-col justify-between font-sans">
      
      {/* HEADER HUD */}
      <div className="flex justify-between items-center bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center space-x-2 space-x-reverse">
          <Smartphone size={18} className="text-purple-400" />
          <span className="text-xs font-mono font-bold">MOBILE INGESTION NODE</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          <span className={`h-2 w-2 rounded-full ${status === 'streaming' ? 'bg-red-500 animate-pulse' : 'bg-amber-400'}`}></span>
          <span className="uppercase">{status}</span>
        </div>
      </div>

      {/* CAMERA VIEWPORT CONTAINER */}
      <div className="my-4 relative rounded-2xl border border-slate-800 bg-black aspect-[9/16] max-h-[65vh] mx-auto w-full overflow-hidden flex items-center justify-center shadow-2xl">
        <video 
          ref={localVideoRef} 
          autoPlay 
          playsInline 
          muted 
          className="w-full h-full object-cover"
        />
        
        {/* Overlay HUD indicators */}
        <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg text-[11px] font-mono border border-slate-700/50">
          NODE: <span className="text-purple-400 font-bold">{selectedCam}</span>
        </div>
      </div>

      {/* FOOTER CONFIGURATION PANEL */}
      <div className="space-y-4 bg-slate-900/40 p-4 rounded-2xl border border-slate-800/80 backdrop-blur-md">
        
        {/* Cam Selector Control */}
        <div className="flex gap-3 justify-center">
          {['CAM-01', 'CAM-02'].map((cam) => (
            <button
              key={cam}
              onClick={() => setSelectedCam(cam)}
              disabled={status === 'streaming'}
              className={`flex-1 py-2 rounded-xl text-xs font-mono font-bold tracking-wider transition-all border ${
                selectedCam === cam 
                ? 'bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-900/30' 
                : 'bg-slate-900 border-slate-800 text-slate-400'
              } disabled:opacity-40`}
            >
              ASSIGN TO {cam}
            </button>
          ))}
        </div>

        {/* Console Log Message Indicator */}
        <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800/60 font-mono text-[11px] text-slate-400 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping"></div>
          <span>{logStatus}</span>
        </div>

        {/* Core Broadcast Trigger Action Button */}
        {status === 'streaming' ? (
          <button 
            onClick={stopStreaming}
            className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide bg-gradient-to-r from-red-600 to-red-700 border border-red-500 text-white shadow-lg shadow-red-900/40 transition-all active:scale-[0.98]"
          >
            DISCONNECT BROADCAST
          </button>
        ) : (
          <button 
            onClick={startStreaming}
            disabled={status !== 'ready'}
            className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide bg-gradient-to-r from-blue-600 to-purple-600 border border-blue-400 text-white shadow-lg shadow-purple-900/40 transition-all active:scale-[0.98] disabled:opacity-40"
          >
            START LIVE STREAMING
          </button>
        )}
      </div>

    </div>
  );
}