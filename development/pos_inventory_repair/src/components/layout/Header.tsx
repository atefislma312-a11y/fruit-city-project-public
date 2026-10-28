import React from 'react';
import { useApp, NavigationTab } from '../../context/AppContext';
import { 
  LayoutDashboard, 
  Coffee, 
  Boxes, 
  Receipt,
  BookOpen, 
  BarChart3, 
  Wallet, 
  Settings,
  Sparkles,
  ShoppingBag,
  Clock,
  Lock,
  CreditCard,
  Database,
  HelpCircle,
  UserCheck
} from 'lucide-react';

export const Header: React.FC = () => {
  const { 
    activeTab, 
    setActiveTab, 
    approvalRequests, 
    currentShift,
    isApiConnected,
    isFirstRun,
    setIsFirstRunModalOpen,
    isOnboardingModalOpen,
    setIsOnboardingModalOpen
  } = useApp();

  const pendingApprovalsCount = approvalRequests.filter(r => r.status === 'pending').length;

  const navItems: { id: NavigationTab; label: string; icon: React.FC<{ className?: string }>; badge?: number }[] = [
    { id: 'pos', label: 'الكاشير (POS)', icon: ShoppingBag },
    { id: 'shifts', label: 'الورديات والخزينة', icon: Clock },
    { id: 'approvals', label: 'موافقات المدير', icon: Lock, badge: pendingApprovalsCount },
    { id: 'payment_fees', label: 'رسوم وتسويات الدفع', icon: CreditCard },
    { id: 'purchases', label: 'المشتريات', icon: Receipt },
    { id: 'dashboard', label: 'لوحة التكاليف', icon: LayoutDashboard },
    { id: 'products', label: 'المنتجات', icon: Coffee },
    { id: 'ingredients', label: 'الخامات', icon: Boxes },
    { id: 'recipes', label: 'الوصفات', icon: BookOpen },
    { id: 'reports', label: 'التقارير', icon: BarChart3 },
    { id: 'expenses', label: 'المصروفات', icon: Wallet },
    { id: 'settings', label: 'الإعدادات', icon: Settings }
  ];

  return (
    <header className="bg-[#172D36] text-white shadow-md sticky top-0 z-40 border-b border-[#203F4B]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          
          {/* Brand Logo & Name (Right side in RTL) */}
          <div className="flex items-center space-x-3 space-x-reverse shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#147D73] to-[#0E5C55] flex items-center justify-center shadow-lg border border-[#259b8f]/40">
              <Sparkles className="w-5 h-5 text-[#FAF6EE]" />
            </div>
            <div>
              <div className="text-xl font-black tracking-wider text-white flex items-center gap-1.5 font-sans">
                FRUIT CITY
                <span className="inline-block w-2 h-2 rounded-full bg-[#C59A45]"></span>
              </div>
              <div className="text-[10px] tracking-widest text-[#B5C9C3] uppercase font-bold">
                MANAGEMENT SYSTEM
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center space-x-1 space-x-reverse overflow-x-auto py-2 mx-4 scrollbar-thin">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 whitespace-nowrap relative ${
                    isActive
                      ? 'bg-[#147D73] text-white shadow-sm ring-1 ring-white/10'
                      : 'text-[#D5E2DF] hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-[#9CB6B0]'}`} />
                  <span>{item.label}</span>
                  {Boolean(item.badge && item.badge > 0) && (
                    <span className="w-4 h-4 bg-rose-500 text-white rounded-full text-[10px] font-mono flex items-center justify-center -mr-0.5">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Quick Info & Database Status */}
          <div className="hidden lg:flex items-center gap-2.5 shrink-0">
            {/* Database Connection Badge */}
            {isApiConnected ? (
              <div 
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold"
                title="متصل بخادم SQLite المحلي على نظام Windows"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span>SQLite متصل</span>
              </div>
            ) : (
              <div 
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/70 border border-amber-500/40 text-amber-300 text-[11px] font-bold"
                title="يعمل بنظام التخزين المحلي الاحتياطي في المتصفح"
              >
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span>تخزين محلي (متصفح)</span>
              </div>
            )}

            {/* First-Run Setup Button if uninitialized */}
            {isFirstRun && (
              <button
                onClick={() => setIsFirstRunModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#C59A45] hover:bg-[#d6aa56] text-slate-950 font-bold text-[11px] transition-colors shadow-sm animate-bounce"
                title="تأسيس حساب المالك وتشفير كلمة المرور بـ Argon2id"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>تأسيس المالك</span>
              </button>
            )}

            {/* Onboarding Wizard Toggle */}
            <button
              onClick={() => setIsOnboardingModalOpen(!isOnboardingModalOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#203F4B] hover:bg-[#2a5363] text-[#FAF6EE] text-[11px] font-semibold border border-[#2d5869] transition-colors"
              title="معالج إدخال البيانات ومراجعة الوحدات (8 خطوات)"
            >
              <HelpCircle className="w-3.5 h-3.5 text-[#C59A45]" />
              <span>معالج البداية (8 خطوات)</span>
            </button>

            {/* Branch Badge */}
            <div className="bg-[#0f2128] px-2.5 py-1 rounded-lg border border-[#234552] text-right">
              <div className="text-[9px] text-[#8EA7A1] font-medium">الفرع الرئيسي</div>
              <div className="text-xs font-bold text-[#E3EDE9]">وسط البلد</div>
            </div>
          </div>

        </div>
      </div>
    </header>
  );
};
