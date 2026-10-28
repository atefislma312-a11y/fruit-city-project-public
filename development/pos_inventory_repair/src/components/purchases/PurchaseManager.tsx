import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { InvoiceEditor } from './InvoiceEditor';
import { InvoiceHistory } from './InvoiceHistory';
import { PrintInvoiceModal } from './PrintInvoiceModal';
import { PurchaseInvoice } from '../../types';
import { Receipt, History, PlusCircle } from 'lucide-react';

export const PurchaseManager: React.FC = () => {
  const { invoices, printingInvoice, setPrintingInvoice } = useApp();
  
  const [activeSubTab, setActiveSubTab] = useState<'editor' | 'history'>('editor');
  const [selectedInvoiceForEdit, setSelectedInvoiceForEdit] = useState<PurchaseInvoice | null>(null);
  const [userExplicitBlank, setUserExplicitBlank] = useState<boolean>(false);

  // Keep selectedInvoiceForEdit in sync with invoices state or auto-select pending draft
  useEffect(() => {
    if (selectedInvoiceForEdit) {
      const updated = invoices.find(inv => inv.id === selectedInvoiceForEdit.id || inv.invoiceNumber === selectedInvoiceForEdit.invoiceNumber);
      if (updated) {
        setSelectedInvoiceForEdit(updated);
      }
    } else if (!userExplicitBlank) {
      const pendingDraft = invoices.find(inv => inv.status === 'draft');
      if (pendingDraft) {
        setSelectedInvoiceForEdit(pendingDraft);
      }
    }
  }, [invoices, userExplicitBlank]);

  const handleSelectInvoiceFromHistory = (invoice: PurchaseInvoice) => {
    setUserExplicitBlank(false);
    setSelectedInvoiceForEdit(invoice);
    setActiveSubTab('editor');
  };

  const handleOpenBlankEditor = () => {
    setUserExplicitBlank(true);
    setSelectedInvoiceForEdit(null);
    setActiveSubTab('editor');
  };

  return (
    <div className="space-y-6">
      
      {/* Navigation Sub-Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenBlankEditor}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition ${
              activeSubTab === 'editor' && !selectedInvoiceForEdit
                ? 'bg-[#147D73] text-white shadow-sm ring-1 ring-black/5'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>فاتورة مشتريات جديدة</span>
          </button>

          {selectedInvoiceForEdit && activeSubTab === 'editor' && (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold">
              <span>تعديل فاتورة: {selectedInvoiceForEdit.invoiceNumber}</span>
              <button
                onClick={handleOpenBlankEditor}
                className="text-amber-700 hover:text-amber-900 underline text-[11px] mr-1"
              >
                (فتح جديدة)
              </button>
            </div>
          )}

          <button
            onClick={() => setActiveSubTab('history')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition ${
              activeSubTab === 'history'
                ? 'bg-[#172D36] text-white shadow-sm ring-1 ring-black/5'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <History className="w-4 h-4" />
            <span>سجل الفواتير والمشتريات</span>
            <span className="bg-slate-200 text-slate-800 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
              {invoices.length}
            </span>
          </button>
        </div>

        <div className="text-xs text-slate-500 font-semibold flex items-center gap-1.5">
          <Receipt className="w-4 h-4 text-[#147D73]" />
          <span>إدارة مشتريات سوق الجملة وتحديث أوزان وأسعار الخامات</span>
        </div>

      </div>

      {/* Sub-tab view */}
      {activeSubTab === 'editor' && (
        <InvoiceEditor
          initialInvoice={selectedInvoiceForEdit}
          onSaved={(saved) => {
            setUserExplicitBlank(false);
            if (saved) {
              setSelectedInvoiceForEdit(saved);
            }
          }}
        />
      )}

      {activeSubTab === 'history' && (
        <InvoiceHistory onSelectInvoice={handleSelectInvoiceFromHistory} />
      )}

      {/* Print Modal */}
      <PrintInvoiceModal
        invoice={printingInvoice}
        onClose={() => setPrintingInvoice(null)}
      />

    </div>
  );
};
