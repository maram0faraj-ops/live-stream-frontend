import React from 'react';
import Dashboard from './Dashboard';
import MobileCam from './MobileCam';

export default function App() {
  // فحص رابط المتصفح الحالي لمعرفة الصفحة المطلوبة
  const currentPath = window.location.pathname;

  // إذا كان الرابط يحتوي على /ingest، افتح واجهة كاميرا الجوال
  if (currentPath === '/ingest' || currentPath.endsWith('/ingest')) {
    return <MobileCam />;
  }

  // في أي حالة أخرى (الرابط الرئيسي)، افتح لوحة تحكم المخرج
  return <Dashboard />;
}