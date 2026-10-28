import { PaymentFeeRule, PaymentFeeSnapshot, PaymentRecord, SettlementBatch, SettlementImportRow } from '../types';
import { roundMoney } from './costingEngine';

export const PROVISIONAL_MONTHLY_PAYMENT_FEE_BUDGET = 1200; // EGP in operating budget

/**
 * Finds the currently active fee rule for a given provider and payment method
 * based on the transaction date.
 */
export function findApplicableFeeRule(params: {
  providerName?: string;
  paymentMethod: 'card' | 'instapay';
  transactionDate: string; // YYYY-MM-DD
  rules: PaymentFeeRule[];
}): PaymentFeeRule | null {
  const { providerName, paymentMethod, transactionDate, rules } = params;

  const activeRules = rules.filter(r => {
    if (!r.active) return false;
    if (r.paymentMethod !== paymentMethod) return false;
    if (providerName && r.providerName.toLowerCase() !== providerName.toLowerCase()) return false;

    // Check effective date range
    if (r.effectiveStartDate && transactionDate < r.effectiveStartDate) return false;
    if (r.effectiveEndDate && transactionDate > r.effectiveEndDate) return false;

    return true;
  });

  if (activeRules.length === 0) return null;

  // Return highest version or most specific
  return activeRules.sort((a, b) => b.version - a.version)[0];
}

/**
 * Calculates fee snapshot for an electronic payment.
 * If fee rule is NOT configured, returns null (displayed as "غير محددة" in UI).
 */
export function calculatePaymentFeeSnapshot(params: {
  grossAmount: number;
  rule: PaymentFeeRule | null;
  providerNameFallback?: string;
}): PaymentFeeSnapshot | null {
  const { grossAmount, rule, providerNameFallback } = params;

  // If no rule is configured, DO NOT assume 0 fee! Return null so UI shows "غير محددة".
  if (!rule) {
    return null;
  }

  const feePercent = Number(rule.feePercent) || 0;
  const fixedFee = Number(rule.fixedFee) || 0;

  let feeAmount = (grossAmount * (feePercent / 100)) + fixedFee;

  // Apply VAT on fees if contractualTaxPercent is set
  if (rule.contractualTaxPercent && rule.contractualTaxPercent > 0) {
    feeAmount += feeAmount * (rule.contractualTaxPercent / 100);
  }

  // Min / Max bounds
  if (rule.minFee !== undefined && rule.minFee > 0) {
    feeAmount = Math.max(feeAmount, rule.minFee);
  }
  if (rule.maxFee !== undefined && rule.maxFee > 0) {
    feeAmount = Math.min(feeAmount, rule.maxFee);
  }

  // Rounding
  const expectedFeeAmount = rule.roundingRule === 'ceil_piastre' 
    ? Math.ceil(feeAmount * 100) / 100 
    : roundMoney(feeAmount);

  const expectedNetSettlement = roundMoney(Math.max(0, grossAmount - expectedFeeAmount));

  return {
    ruleId: rule.id,
    providerName: rule.providerName || providerNameFallback || 'بوابة الدفع',
    feePercent,
    fixedFee,
    expectedFeeAmount,
    expectedNetSettlement,
    reconciliationStatus: 'unreconciled'
  };
}

/**
 * Compares actual total payment fees against the planned budget provision (EGP 1,200).
 * Avoids double-counting against operating expenses.
 */
export function comparePaymentFeesToBudget(actualTotalFees: number): {
  budgetProvision: number;
  actualTotalFees: number;
  variance: number; // actual - provision
  variancePercent: number;
  status: 'within_budget' | 'exceeded';
  statusAr: string;
} {
  const cleanActual = roundMoney(actualTotalFees);
  const variance = roundMoney(cleanActual - PROVISIONAL_MONTHLY_PAYMENT_FEE_BUDGET);
  const variancePercent = roundMoney((cleanActual / PROVISIONAL_MONTHLY_PAYMENT_FEE_BUDGET) * 100);

  const status = cleanActual <= PROVISIONAL_MONTHLY_PAYMENT_FEE_BUDGET ? 'within_budget' : 'exceeded';
  const statusAr = status === 'within_budget'
    ? `ضمن المخصص التقديري (${variance <= 0 ? Math.abs(variance) + ' ج.م فائض متاح' : ''})`
    : `تجاوز المخصص التقديري بمقدار ${variance} ج.م`;

  return {
    budgetProvision: PROVISIONAL_MONTHLY_PAYMENT_FEE_BUDGET,
    actualTotalFees: cleanActual,
    variance,
    variancePercent,
    status,
    statusAr
  };
}

/**
 * Parses and validates CSV bank/provider settlement report data
 */
export function parseSettlementCsv(csvContent: string): {
  rows: SettlementImportRow[];
  totalGross: number;
  totalFees: number;
  totalNet: number;
} {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
  const rows: SettlementImportRow[] = [];

  let totalGross = 0;
  let totalFees = 0;
  let totalNet = 0;

  // Expect CSV header: Reference, Date, Gross, Fee, Net
  // Skip header if line 0 contains letters
  const startIndex = lines[0] && lines[0].includes('Gross') || lines[0].includes('Reference') || lines[0].includes('مرجع') ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const parts = lines[i].split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
    if (parts.length < 3) continue;

    const transactionReference = parts[0];
    const transactionDate = parts[1] || new Date().toISOString().split('T')[0];
    const grossAmount = parseFloat(parts[2]) || 0;
    const deductedFee = parseFloat(parts[3]) || 0;
    const netSettlement = parseFloat(parts[4]) || roundMoney(grossAmount - deductedFee);

    totalGross += grossAmount;
    totalFees += deductedFee;
    totalNet += netSettlement;

    rows.push({
      transactionReference,
      transactionDate,
      grossAmount: roundMoney(grossAmount),
      deductedFee: roundMoney(deductedFee),
      netSettlement: roundMoney(netSettlement),
      status: 'unmatched'
    });
  }

  return {
    rows,
    totalGross: roundMoney(totalGross),
    totalFees: roundMoney(totalFees),
    totalNet: roundMoney(totalNet)
  };
}

/**
 * Reconciles imported settlement rows against confirmed payment records.
 * Marks match status and detects discrepancies.
 */
export function matchSettlementWithPayments(params: {
  settlementRows: SettlementImportRow[];
  payments: PaymentRecord[];
}): {
  reconciledCount: number;
  discrepancyCount: number;
  unmatchedCount: number;
  updatedRows: SettlementImportRow[];
} {
  const { settlementRows, payments } = params;
  let reconciledCount = 0;
  let discrepancyCount = 0;
  let unmatchedCount = 0;

  const updatedRows = settlementRows.map(row => {
    // Find payment by reference
    const matchedPayment = payments.find(p => 
      (p.cardTransactionReference && p.cardTransactionReference === row.transactionReference) ||
      (p.instapayReference && p.instapayReference === row.transactionReference) ||
      p.id === row.transactionReference
    );

    if (!matchedPayment) {
      unmatchedCount++;
      return {
        ...row,
        status: 'unmatched' as const,
        notes: 'لم يتم العثور على معاملة مطابقة في النظام'
      };
    }

    // Check gross difference
    const diff = Math.abs(matchedPayment.amount - row.grossAmount);
    if (diff > 0.05) {
      discrepancyCount++;
      return {
        ...row,
        status: 'discrepancy' as const,
        matchedPaymentId: matchedPayment.id,
        notes: `فارق في قيمة المعاملة: النظام (${matchedPayment.amount} ج) مقابل التقرير (${row.grossAmount} ج)`
      };
    }

    reconciledCount++;
    return {
      ...row,
      status: 'matched' as const,
      matchedPaymentId: matchedPayment.id,
      notes: 'مطابقة بنجاح'
    };
  });

  return {
    reconciledCount,
    discrepancyCount,
    unmatchedCount,
    updatedRows
  };
}
