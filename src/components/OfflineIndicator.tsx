import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 rounded-xl bg-amber-600 dark:bg-amber-700 px-4 py-2.5 text-xs font-semibold text-white shadow-xl border border-amber-400/30 backdrop-blur-md animate-pulse">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>وضع عدم الاتصال بالشبكة — يتم استخدام البيانات المخزنة محلياً.</span>
    </div>
  );
};
