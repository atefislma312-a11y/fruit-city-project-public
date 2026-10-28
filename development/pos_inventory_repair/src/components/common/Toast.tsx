import React from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle, AlertCircle } from 'lucide-react';

export const Toast: React.FC = () => {
  const { toastMessage } = useApp();

  if (!toastMessage) return null;

  return (
    <div className="fixed bottom-6 left-6 z-50 animate-bounce transition-all">
      <div className="bg-[#172D36] text-white px-5 py-3 rounded-2xl shadow-2xl border border-[#147D73] flex items-center gap-3">
        <CheckCircle className="w-5 h-5 text-[#147D73]" />
        <span className="text-sm font-bold">{toastMessage}</span>
      </div>
    </div>
  );
};
