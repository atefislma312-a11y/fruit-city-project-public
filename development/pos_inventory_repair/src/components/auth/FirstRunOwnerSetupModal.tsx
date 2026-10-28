import React, { useState } from 'react';
import { ShieldCheck, Lock, User, CheckCircle2, AlertCircle, KeyRound } from 'lucide-react';
import { ApiClient } from '../../services/apiClient';

interface FirstRunOwnerSetupModalProps {
  isOpen: boolean;
  onSuccess: (user: any) => void;
}

export const FirstRunOwnerSetupModal: React.FC<FirstRunOwnerSetupModalProps> = ({
  isOpen,
  onSuccess
}) => {
  const [fullNameAr, setFullNameAr] = useState('');
  const [username, setUsername] = useState('owner');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullNameAr.trim()) {
      setError('يرجى كتابة الاسم الكامل للمالك.');
      return;
    }
    if (!username.trim() || username.trim().length < 3) {
      setError('اسم المستخدم يجب أن يتكون من 3 أحرف على الأقل.');
      return;
    }
    if (password.length < 8) {
      setError('كلمة المرور يجب أن تكون 8 خانات على الأقل لضمان الأمان.');
      return;
    }
    if (password !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين.');
      return;
    }

    setLoading(true);
    try {
      const res = await ApiClient.setupOwner({
        fullNameAr: fullNameAr.trim(),
        username: username.trim(),
        password
      });

      if (res.success && res.user) {
        onSuccess(res.user);
      } else {
        setError(res.message || res.error || 'فشل إعداد الحساب. يرجى المحاولة ثانية.');
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ في الاتصال بالخادم المحلي.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/85 backdrop-blur-md p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-navy-900 border border-gold-500/40 p-6 md:p-8 shadow-2xl text-cream-50 text-right">
        
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-navy-700/60 pb-4 mb-6">
          <div className="p-3 rounded-xl bg-gold-500/10 border border-gold-500/30 text-gold-400">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-cream-50">تأسيس حساب المالك — التشغيل الأول (First-Run Setup)</h2>
            <p className="text-xs text-cream-300 mt-1">قاعدة بيانات Fruit City نظيفة وجاهزة. يرجى إعداد حساب المالك الرئيسي.</p>
          </div>
        </div>

        {/* Security Notice */}
        <div className="rounded-xl bg-navy-800/80 border border-navy-700 p-3.5 mb-6 text-xs text-cream-200 leading-relaxed flex items-start gap-2.5">
          <KeyRound className="w-5 h-5 text-gold-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-gold-300">أمان تشغيلي فائق (Argon2id):</span>
            <p className="mt-1 text-cream-300">
              كلمة المرور لا تظهر ولا تُحفظ كنص صريح في أي كود أو سجل. يتم تشفيرها مباشرة في قاعدة بيانات SQLite المحلية باستخدام خوارزمية Argon2id المتخصصة وبصمة Salt عشوائية فريدة.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-950/60 border border-red-500/40 p-3 mb-5 flex items-center gap-2 text-xs text-red-200">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-cream-200 mb-1">الاسم الكامل للمالك</label>
            <div className="relative">
              <input
                type="text"
                required
                value={fullNameAr}
                onChange={e => setFullNameAr(e.target.value)}
                placeholder="مثال: أحمد عبد الله (المالك)"
                className="w-full rounded-xl bg-navy-800 border border-navy-700 px-4 py-2.5 text-sm text-cream-50 focus:border-gold-500 focus:outline-none"
              />
              <User className="absolute left-3 top-3 w-4 h-4 text-cream-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-cream-200 mb-1">اسم المستخدم للدخول</label>
            <input
              type="text"
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="owner"
              className="w-full rounded-xl bg-navy-800 border border-navy-700 px-4 py-2.5 text-sm text-cream-50 focus:border-gold-500 focus:outline-none dir-ltr text-left"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-cream-200 mb-1">كلمة المرور الجديدة (8 خانات على الأقل)</label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-xl bg-navy-800 border border-navy-700 px-4 py-2.5 text-sm text-cream-50 focus:border-gold-500 focus:outline-none dir-ltr text-left"
              />
              <Lock className="absolute left-3 top-3 w-4 h-4 text-cream-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-cream-200 mb-1">تأكيد كلمة المرور</label>
            <div className="relative">
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-xl bg-navy-800 border border-navy-700 px-4 py-2.5 text-sm text-cream-50 focus:border-gold-500 focus:outline-none dir-ltr text-left"
              />
              <Lock className="absolute left-3 top-3 w-4 h-4 text-cream-400" />
            </div>
          </div>

          <div className="pt-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gold-500 hover:bg-gold-600 active:scale-[0.99] text-navy-950 font-bold py-3 text-sm transition-all shadow-lg disabled:opacity-50"
            >
              {loading ? (
                <span>جاري تشفير وتأسيس الحساب بـ Argon2id...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>تأكيد وإنشاء حساب المالك الأول</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
