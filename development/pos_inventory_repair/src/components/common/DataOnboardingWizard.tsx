import React from 'react';
import { 
  Sparkles, 
  CheckCircle2, 
  ArrowLeft, 
  Layers, 
  Truck, 
  FlaskConical, 
  Coffee, 
  Boxes, 
  Users, 
  DollarSign, 
  MonitorCheck,
  Info
} from 'lucide-react';
import { NavigationTab } from '../../context/AppContext';

interface DataOnboardingWizardProps {
  currentTab: NavigationTab;
  onNavigate: (tab: NavigationTab) => void;
  ingredientsCount: number;
  productsCount: number;
  recipesCount: number;
  invoicesCount: number;
  shiftsCount: number;
}

export const DataOnboardingWizard: React.FC<DataOnboardingWizardProps> = ({
  currentTab,
  onNavigate,
  ingredientsCount,
  productsCount,
  recipesCount,
  invoicesCount,
  shiftsCount
}) => {
  const steps = [
    {
      num: 1,
      id: 'ingredients' as NavigationTab,
      title: 'المكونات والخامات',
      desc: 'تسجيل الفواكه والخامات وتحديد وحدة الشراء والأساس ونسبة الصافي والهدر (جرام/كيلو/مللي/لتر)',
      isComplete: ingredientsCount > 0,
      icon: Layers,
      unitGuidance: 'ادعم: كجم للفاكهة، جم لوصفات العصائر، لتر/مللي للمشروبات، قطعة للأكواب.'
    },
    {
      num: 2,
      id: 'purchases' as NavigationTab,
      title: 'الموردون والمشتريات',
      desc: 'إدخال فواتير سوق العبور (بالوزن الصافي، أو بالعبوة، أو بالقطعة) واعتمادها',
      isComplete: invoicesCount > 0,
      icon: Truck,
      unitGuidance: 'الشراء بالوزن: إجمالي وزن العبوات × سعر الكيلو. الشراء بالعبوة: عدد × سعر العبوة.'
    },
    {
      num: 3,
      id: 'recipes' as NavigationTab,
      title: 'الوصفات والإنتاجية',
      desc: 'تحديد معادلات الخلطات بالدفعة (Batch Yield بالمللي) أو بالكوب، ومقادير الفاكهة والماء والثلج',
      isComplete: recipesCount > 0,
      icon: FlaskConical,
      unitGuidance: 'حدد ناتج الدفعة الصافي بالمللي (مثلاً: 10,000 مل لدفعة الجوافة أو 1,000 مل للبرتقال).'
    },
    {
      num: 4,
      id: 'products' as NavigationTab,
      title: 'المنتجات والمقاسات والأسعار',
      desc: 'إدخال المشروبات، وربطها بالمقاسات (400 مل، لتر عائلي)، وتكلفة الأكواب والتعبئة وأسعار البيع',
      isComplete: productsCount > 0,
      icon: Coffee,
      unitGuidance: 'حدد سعر البيع لكل مقاس، وتكلفة التعبئة المباشرة (كوب + غطاء + شاليموه).'
    },
    {
      num: 5,
      id: 'ingredients' as NavigationTab,
      title: 'مخزون البداية',
      desc: 'إدخال الأرصدة الافتتاحية للمخزن وتحديد حد التنبيه لنقص الخامات',
      isComplete: ingredientsCount > 0,
      icon: Boxes,
      unitGuidance: 'يتم احتساب الرصيد بالوحدة الأساسية (جرام للفاكهة، قطعة للأكواب).'
    },
    {
      num: 6,
      id: 'settings' as NavigationTab,
      title: 'الموظفون والصلاحيات',
      desc: 'إضافة حسابات الكاشير وطاقم البار وتحديد صلاحيات كل دور في الفرع',
      isComplete: true,
      icon: Users,
      unitGuidance: 'الكاشير: تسجيل البيع. المدير: اعتماد المشتريات والاسترجاع والخصومات.'
    },
    {
      num: 7,
      id: 'expenses' as NavigationTab,
      title: 'المصروفات التشغيلية',
      desc: 'تسجيل التكاليف الشهرية الثابتة (الإيجار، الكهرباء، رواتب العمالة) لحساب الأرباح',
      isComplete: true,
      icon: DollarSign,
      unitGuidance: 'إيجار المحل، فواتير الكهرباء والمياه، رواتب العمالة.'
    },
    {
      num: 8,
      id: 'pos' as NavigationTab,
      title: 'تشغيل الكاشير ونقاط البيع',
      desc: 'فتح أول وردية، تحديد عهدة الدرج (500 جنيه)، وبدء استقبال طلبات الزبائن والطباعة',
      isComplete: shiftsCount > 0,
      icon: MonitorCheck,
      unitGuidance: 'استقبال طلبات الصالة والسفري والدليفري، وطباعة بون المطبخ وإيصال العميل.'
    }
  ];

  const completedCount = steps.filter(s => s.isComplete).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="rounded-2xl bg-navy-900 border border-gold-500/30 p-5 md:p-6 mb-6 shadow-xl text-cream-50 text-right">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-navy-700/60 pb-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gold-500/10 text-gold-400 border border-gold-500/30">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-cream-50">دليل التأسيس المنظم لبيانات Fruit City (Data Onboarding Stepper)</h2>
            <p className="text-xs text-cream-300 mt-0.5">
              خطوات متسلسلة لإدخال البيانات الفعلية النظيفة مع إرشادات الوحدات والمعايير الدقيقة.
            </p>
          </div>
        </div>

        {/* Progress pill */}
        <div className="flex items-center gap-3 bg-navy-800/80 px-4 py-2 rounded-xl border border-navy-700">
          <span className="text-xs text-cream-300">معدل التأسيس:</span>
          <span className="text-sm font-bold text-gold-400">{completedCount} من {steps.length} ({progressPercent}%)</span>
          <div className="w-24 bg-navy-950 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-gold-500 h-full transition-all duration-500" 
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Grid of Steps */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {steps.map(step => {
          const Icon = step.icon;
          const isCurrent = currentTab === step.id;

          return (
            <div
              key={step.num}
              onClick={() => onNavigate(step.id)}
              className={`cursor-pointer rounded-xl p-3.5 border transition-all flex flex-col justify-between ${
                isCurrent 
                  ? 'bg-navy-800/90 border-gold-500 shadow-md ring-1 ring-gold-500/30' 
                  : step.isComplete
                  ? 'bg-navy-900/60 border-emerald-500/30 hover:border-emerald-500/60'
                  : 'bg-navy-950/40 border-navy-800 hover:border-navy-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-navy-800 text-gold-400 font-bold text-xs flex items-center justify-center border border-navy-700">
                      {step.num}
                    </span>
                    <Icon className="w-4 h-4 text-cream-300" />
                  </div>
                  {step.isComplete ? (
                    <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      مكتمل
                    </span>
                  ) : (
                    <span className="text-[11px] text-cream-400">مطلوب</span>
                  )}
                </div>

                <h3 className="font-bold text-sm text-cream-100 mb-1">{step.title}</h3>
                <p className="text-[11px] text-cream-400 leading-relaxed mb-2.5">{step.desc}</p>
              </div>

              <div className="pt-2 border-t border-navy-800/80 text-[10px] text-gold-300/80 flex items-start gap-1">
                <Info className="w-3 h-3 shrink-0 mt-0.5 text-gold-400" />
                <span>{step.unitGuidance}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
