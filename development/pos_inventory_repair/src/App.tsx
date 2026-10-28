import React from 'react';
import { useApp } from './context/AppContext';
import { Header } from './components/layout/Header';
import { SubHeader } from './components/dashboard/SubHeader';
import { KpiCards } from './components/dashboard/KpiCards';
import { ProfitabilityTable } from './components/dashboard/ProfitabilityTable';
import { ProductList } from './components/products/ProductList';
import { IngredientManager } from './components/ingredients/IngredientManager';
import { PurchaseManager } from './components/purchases/PurchaseManager';
import { OperatingBudget } from './components/expenses/OperatingBudget';
import { FinancialReports } from './components/reports/FinancialReports';
import { SettingsView } from './components/settings/SettingsView';
import { RecipeBuilderModal } from './components/recipes/RecipeBuilderModal';
import { PosTerminal } from './components/pos/PosTerminal';
import { ShiftManager } from './components/shifts/ShiftManager';
import { ApprovalsCenter } from './components/approvals/ApprovalsCenter';
import { PaymentFeeManager } from './components/payments/PaymentFeeManager';
import { CustomerReceiptModal } from './components/pos/CustomerReceiptModal';
import { PreparationTicketModal } from './components/pos/PreparationTicketModal';
import { FirstRunOwnerSetupModal } from './components/auth/FirstRunOwnerSetupModal';
import { DataOnboardingWizard } from './components/common/DataOnboardingWizard';
import { Toast } from './components/common/Toast';
import { ShieldCheck, X } from 'lucide-react';

export const AppContent: React.FC = () => {
  const { 
    activeTab, 
    setActiveTab,
    receiptModalData, 
    setReceiptModalData,
    ticketModalOrder,
    setTicketModalOrder,
    ingredients,
    products,
    recipes,
    invoices,
    shifts,
    isFirstRun,
    isFirstRunModalOpen,
    setIsFirstRunModalOpen,
    isOnboardingModalOpen,
    setIsOnboardingModalOpen,
    showToast
  } = useApp();

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F7F5] text-slate-800">
      
      {/* Top Header */}
      <Header />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Onboarding Wizard Stepper (Shows if toggled OR if clean slate with 0 ingredients) */}
        {(isOnboardingModalOpen || ingredients.length === 0) && (
          <div className="relative">
            {ingredients.length > 0 && (
              <button
                onClick={() => setIsOnboardingModalOpen(false)}
                className="absolute top-4 left-4 z-10 p-1.5 rounded-lg bg-navy-800/80 hover:bg-navy-700 text-cream-200 border border-navy-700"
                title="إغلاق المعالج"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <DataOnboardingWizard
              currentTab={activeTab}
              onNavigate={(tab) => {
                setActiveTab(tab);
              }}
              ingredientsCount={ingredients.length}
              productsCount={products.length}
              recipesCount={recipes.length}
              invoicesCount={invoices.length}
              shiftsCount={shifts.length}
            />
          </div>
        )}

        {activeTab === 'pos' && <PosTerminal />}
        {activeTab === 'shifts' && <ShiftManager />}
        {activeTab === 'approvals' && <ApprovalsCenter />}
        {activeTab === 'payment_fees' && <PaymentFeeManager />}

        {activeTab === 'dashboard' && (
          <div>
            <SubHeader />
            <KpiCards />
            <ProfitabilityTable />
          </div>
        )}

        {activeTab === 'products' && <ProductList />}
        {activeTab === 'ingredients' && <IngredientManager />}
        {activeTab === 'purchases' && <PurchaseManager />}
        {activeTab === 'recipes' && <ProductList />}
        {activeTab === 'reports' && <FinancialReports />}
        {activeTab === 'expenses' && <OperatingBudget />}
        {activeTab === 'settings' && <SettingsView />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200/80 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-[#172D36]">FRUIT CITY MANAGEMENT SYSTEM</span>
            <span>—</span>
            <span>فرع وسط البلد، القاهرة</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>جاهز للعمل دون إنترنت (Offline Ready)</span>
            </span>
            <span>نظام محلي آمن 100%</span>
          </div>

        </div>
      </footer>

      {/* Modals & Toasts */}
      <RecipeBuilderModal />
      <Toast />

      {/* Global Receipt Modal when triggered after payment */}
      {receiptModalData && (
        <CustomerReceiptModal
          order={receiptModalData.order}
          payment={receiptModalData.payment}
          onClose={() => setReceiptModalData(null)}
        />
      )}

      {/* Global Ticket Modal */}
      {ticketModalOrder && (
        <PreparationTicketModal
          order={ticketModalOrder}
          onClose={() => setTicketModalOrder(null)}
        />
      )}

      {/* First-Run Owner Setup Modal */}
      <FirstRunOwnerSetupModal
        isOpen={isFirstRunModalOpen}
        onSuccess={(user) => {
          setIsFirstRunModalOpen(false);
          showToast(`تم تأسيس حساب المالك [${user.fullNameAr}] بنجاح وحفظه في SQLite!`);
        }}
      />

    </div>
  );
};

export default function App() {
  return <AppContent />;
}
