import { CashierShift, PaymentRecord, RefundRecord } from '../types';
import { roundMoney } from './costingEngine';

export const STANDARD_SHIFT_FLOAT_EGP = 500;

/**
 * Calculates expected cash in the physical drawer according to the exact business formula:
 *
 * Expected Cash =
 *   Opening Float (500 EGP)
 *   + Cash Received (cash payments)
 *   + Cash Deposits (any cash added to drawer)
 *   - Cash Refunds (cash returned to customers)
 *   - Authorized Cash Expenses (petty cash paid out)
 *   - Cash Withdrawals (cash pulled by owner/supervisor).
 *
 * CRITICAL RULE: Card and InstaPay transactions MUST NEVER increase physical cash drawer balances!
 */
export function calculateExpectedDrawerCash(params: {
  openingFloat: number;
  cashReceived: number;
  cashDeposits?: number;
  cashRefunds?: number;
  cashExpenses?: number;
  cashWithdrawals?: number;
}): number {
  const {
    openingFloat = STANDARD_SHIFT_FLOAT_EGP,
    cashReceived = 0,
    cashDeposits = 0,
    cashRefunds = 0,
    cashExpenses = 0,
    cashWithdrawals = 0
  } = params;

  const expected = 
    openingFloat + 
    cashReceived + 
    cashDeposits - 
    cashRefunds - 
    cashExpenses - 
    cashWithdrawals;

  return roundMoney(expected);
}

/**
 * Reconciles the cash shift during handover when physical cash is counted.
 */
export function reconcileShiftHandover(params: {
  shift: CashierShift;
  actualCashCounted: number;
  handoverCashierId: string;
  handoverCashierName: string;
  withdrawalAmount?: number;
  reconciliationNotes?: string;
}): {
  expectedCash: number;
  actualCashCounted: number;
  discrepancy: number; // actual - expected
  retainedFloat: number; // must equal 500 EGP
  netWithdrawnTakings: number;
  isFloatSufficient: boolean;
  statusTextAr: string;
} {
  const { shift, actualCashCounted, withdrawalAmount } = params;

  const expectedCash = calculateExpectedDrawerCash({
    openingFloat: shift.openingFloat,
    cashReceived: shift.cashReceived,
    cashDeposits: shift.cashDeposits,
    cashRefunds: shift.cashRefunds,
    cashExpenses: shift.cashExpenses,
    cashWithdrawals: shift.cashWithdrawals
  });

  const discrepancy = roundMoney(actualCashCounted - expectedCash);

  // Policy: Retain EGP 500 float, withdraw the remainder of takings
  const retainedFloat = Math.min(actualCashCounted, STANDARD_SHIFT_FLOAT_EGP);
  const netWithdrawnTakings = withdrawalAmount !== undefined 
    ? withdrawalAmount 
    : Math.max(0, roundMoney(actualCashCounted - retainedFloat));

  const isFloatSufficient = actualCashCounted >= STANDARD_SHIFT_FLOAT_EGP;

  let statusTextAr = 'مطابق تماماً';
  if (discrepancy < 0) {
    statusTextAr = `عجز في النقدية بقيمة ${Math.abs(discrepancy)} ج.م`;
  } else if (discrepancy > 0) {
    statusTextAr = `زيادة غير مفسرة في النقدية بقيمة ${discrepancy} ج.م`;
  }

  return {
    expectedCash,
    actualCashCounted: roundMoney(actualCashCounted),
    discrepancy,
    retainedFloat,
    netWithdrawnTakings,
    isFloatSufficient,
    statusTextAr
  };
}

/**
 * Summarizes shift payments separated by payment method.
 * Verifies that Card and InstaPay DO NOT enter physical cash calculations!
 */
export function aggregateShiftPayments(payments: PaymentRecord[]): {
  totalGrossSales: number;
  cashReceived: number;
  instapayReceived: number;
  cardReceived: number;
  electronicTotal: number;
} {
  let cashReceived = 0;
  let instapayReceived = 0;
  let cardReceived = 0;

  for (const p of payments) {
    if (p.status !== 'verified') continue;

    if (p.method === 'cash') {
      cashReceived += p.amount;
    } else if (p.method === 'instapay') {
      instapayReceived += p.amount;
    } else if (p.method === 'card') {
      cardReceived += p.amount;
    }
  }

  const electronicTotal = roundMoney(instapayReceived + cardReceived);
  const totalGrossSales = roundMoney(cashReceived + electronicTotal);

  return {
    totalGrossSales,
    cashReceived: roundMoney(cashReceived),
    instapayReceived: roundMoney(instapayReceived),
    cardReceived: roundMoney(cardReceived),
    electronicTotal
  };
}
