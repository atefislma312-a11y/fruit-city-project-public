import { describe, it, expect } from 'vitest';
import { 
  calculateOrderItemTotal, 
  calculateOrderTotals, 
  calculateOrderIngredientDeductions, 
  calculateDrinkWaste, 
  formatWorkerPreparationTicket 
} from './posEngine';
import { 
  calculateExpectedDrawerCash, 
  reconcileShiftHandover, 
  aggregateShiftPayments,
  STANDARD_SHIFT_FLOAT_EGP 
} from './shiftEngine';
import { 
  findApplicableFeeRule, 
  calculatePaymentFeeSnapshot, 
  comparePaymentFeesToBudget, 
  parseSettlementCsv, 
  matchSettlementWithPayments 
} from './paymentFeeEngine';
import { 
  evaluateRefundEligibility, 
  createManagerApprovalRequest, 
  validateAndApplyApproval, 
  CASHIER_CASH_REFUND_LIMIT_EGP 
} from './approvalEngine';
import { 
  PosOrder, 
  PaymentRecord, 
  RefundRecord, 
  PaymentFeeRule, 
  Recipe, 
  Ingredient 
} from '../types';

describe('Fruit City POS & Shift & Approvals Test Suite', () => {

  // ==========================================
  // 1. REFUND LIMITS & POLICY
  // ==========================================

  const samplePaidOrder: PosOrder = {
    id: 'ord_test_1',
    orderNumber: 'ORD-101',
    orderType: 'takeaway',
    items: [
      {
        id: 'item_1',
        productId: 'prod_mango',
        productNameAr: 'مانجو كينج نعومي',
        servingSize: '400ml',
        unitPrice: 50,
        quantity: 5,
        modifiers: { sugarLevel: 'standard', iceLevel: 'standard' },
        totalPrice: 250
      }
    ],
    subtotal: 250,
    discountAmount: 0,
    deliveryFee: 0,
    totalAmount: 250,
    orderStatus: 'completed',
    paymentStatus: 'paid',
    preparationStatus: 'ready',
    cashierId: 'csh_1',
    cashierName: 'أحمد محمود',
    shiftId: 'shift_1',
    createdAt: new Date().toISOString(),
    totalRefundedAmount: 0
  };

  it('1. Cash refund EGP 200 succeeds without manager approval', () => {
    const result = evaluateRefundEligibility({
      order: samplePaidOrder,
      refundAmount: 200,
      refundMethod: 'cash',
      reason: 'العميل تراجع قبل الاستلام',
      existingRefunds: []
    });

    expect(result.canProceedDirectly).toBe(true);
    expect(result.requiresManagerApproval).toBe(false);
    expect(result.cumulativeRefundAmount).toBe(200);
    expect(result.remainingAfterRefund).toBe(50);
  });

  it('2. Cash refund EGP 201 requires manager approval', () => {
    const result = evaluateRefundEligibility({
      order: samplePaidOrder,
      refundAmount: 201,
      refundMethod: 'cash',
      reason: 'طلب مرتجع كبير',
      existingRefunds: []
    });

    expect(result.canProceedDirectly).toBe(false);
    expect(result.requiresManagerApproval).toBe(true);
    expect(result.cumulativeRefundAmount).toBe(201);
  });

  it('3. Repeated partial refunds totaling over EGP 200 require manager approval (No splitting bypass)', () => {
    const existingRefund: RefundRecord = {
      id: 'ref_1',
      orderId: 'ord_test_1',
      orderNumber: 'ORD-101',
      amount: 150,
      method: 'cash',
      reason: 'كوب أول تالف',
      cashierId: 'csh_1',
      cashierName: 'أحمد',
      shiftId: 'shift_1',
      timestamp: new Date().toISOString(),
      requiresManagerApproval: false,
      status: 'completed',
      isPreparedDrinkWaste: true
    };

    // New refund of EGP 60 (150 + 60 = 210 > 200)
    const result = evaluateRefundEligibility({
      order: samplePaidOrder,
      refundAmount: 60,
      refundMethod: 'cash',
      reason: 'كوب ثان تالف',
      existingRefunds: [existingRefund]
    });

    expect(result.canProceedDirectly).toBe(false);
    expect(result.requiresManagerApproval).toBe(true);
    expect(result.cumulativeRefundAmount).toBe(210);
  });

  it('4. Electronic refund (Card/InstaPay) ALWAYS requires manager authorization', () => {
    const result = evaluateRefundEligibility({
      order: samplePaidOrder,
      refundAmount: 50,
      refundMethod: 'card',
      reason: 'استرداد فيزا',
      existingRefunds: []
    });

    expect(result.canProceedDirectly).toBe(false);
    expect(result.requiresManagerApproval).toBe(true);
  });

  it('5. Refund without original verified payment is blocked', () => {
    const unpaidOrder: PosOrder = {
      ...samplePaidOrder,
      id: 'ord_unpaid',
      paymentStatus: 'pending'
    };

    const result = evaluateRefundEligibility({
      order: unpaidOrder,
      refundAmount: 50,
      refundMethod: 'cash',
      reason: 'طلب لم يسدد بعد',
      existingRefunds: []
    });

    expect(result.canProceedDirectly).toBe(false);
    expect(result.errorMessage).toContain('غير مدفوع');
  });

  // ==========================================
  // 2. SHIFTS & CASH DRAWER RECONCILIATION
  // ==========================================

  it('6. Cash reconciliation formula calculates expected drawer cash accurately', () => {
    // Opening Float 500 + Cash Received 1200 + Deposits 100 - Refunds 50 - Expenses 150 - Withdrawals 0 = 1600 EGP
    const expected = calculateExpectedDrawerCash({
      openingFloat: 500,
      cashReceived: 1200,
      cashDeposits: 100,
      cashRefunds: 50,
      cashExpenses: 150,
      cashWithdrawals: 0
    });

    expect(expected).toBe(1600);
  });

  it('7. Card and InstaPay transactions NEVER enter physical cash drawer balances', () => {
    const mockPayments: PaymentRecord[] = [
      { id: 'p1', orderId: 'o1', orderNumber: '1', amount: 300, method: 'cash', status: 'verified', timestamp: '', cashierId: '1', cashierShiftId: '1' },
      { id: 'p2', orderId: 'o2', orderNumber: '2', amount: 500, method: 'card', status: 'verified', timestamp: '', cashierId: '1', cashierShiftId: '1' },
      { id: 'p3', orderId: 'o3', orderNumber: '3', amount: 400, method: 'instapay', status: 'verified', timestamp: '', cashierId: '1', cashierShiftId: '1' }
    ];

    const agg = aggregateShiftPayments(mockPayments);
    expect(agg.totalGrossSales).toBe(1200);
    expect(agg.cashReceived).toBe(300);
    expect(agg.cardReceived).toBe(500);
    expect(agg.instapayReceived).toBe(400);

    // Physical cash drawer should strictly be 500 (float) + 300 (cash) = 800 EGP
    const drawerCash = calculateExpectedDrawerCash({
      openingFloat: 500,
      cashReceived: agg.cashReceived
    });
    expect(drawerCash).toBe(800);
  });

  it('8. Shift handover detects cash shortages and surpluses accurately', () => {
    const mockShift = {
      id: 'sh_1',
      shiftNumber: 1,
      cashierId: 'csh_1',
      cashierName: 'أحمد',
      startTime: '',
      status: 'open' as const,
      openingFloat: 500,
      cashReceived: 1000,
      cashDeposits: 0,
      cashRefunds: 0,
      cashExpenses: 0,
      cashWithdrawals: 0,
      expectedCash: 1500
    };

    // Case A: Shortage (counted 1450 vs expected 1500 -> discrepancy -50)
    const shortageResult = reconcileShiftHandover({
      shift: mockShift,
      actualCashCounted: 1450,
      handoverCashierId: 'csh_2',
      handoverCashierName: 'محمد'
    });
    expect(shortageResult.discrepancy).toBe(-50);
    expect(shortageResult.retainedFloat).toBe(500);
    expect(shortageResult.netWithdrawnTakings).toBe(950);
    expect(shortageResult.isFloatSufficient).toBe(true);

    // Case B: Surplus (counted 1530 vs expected 1500 -> discrepancy +30)
    const surplusResult = reconcileShiftHandover({
      shift: mockShift,
      actualCashCounted: 1530,
      handoverCashierId: 'csh_2',
      handoverCashierName: 'محمد'
    });
    expect(surplusResult.discrepancy).toBe(30);
    expect(surplusResult.retainedFloat).toBe(500);
    expect(surplusResult.netWithdrawnTakings).toBe(1030);
  });

  // ==========================================
  // 3. ELECTRONIC PAYMENT FEES & RECONCILIATION
  // ==========================================

  it('9. Payment fee snapshot calculates 1.5% fee on EGP 1000 correctly (15 EGP fee, 985 EGP net)', () => {
    const mockRule: PaymentFeeRule = {
      id: 'rule_1',
      providerName: 'بنك مصر',
      paymentMethod: 'card',
      feePercent: 1.5,
      fixedFee: 0,
      effectiveStartDate: '2026-01-01',
      roundingRule: 'round_2_decimals',
      active: true,
      version: 1
    };

    const snapshot = calculatePaymentFeeSnapshot({
      grossAmount: 1000,
      rule: mockRule
    });

    expect(snapshot).not.toBeNull();
    expect(snapshot?.expectedFeeAmount).toBe(15);
    expect(snapshot?.expectedNetSettlement).toBe(985);
  });

  it('10. Missing fee configuration returns null ("غير محددة") rather than assuming zero', () => {
    const snapshot = calculatePaymentFeeSnapshot({
      grossAmount: 500,
      rule: null
    });

    expect(snapshot).toBeNull();
  });

  it('11. Fee effective dates filter inactive versions', () => {
    const rules: PaymentFeeRule[] = [
      {
        id: 'r_old',
        providerName: 'فوري',
        paymentMethod: 'card',
        feePercent: 2.0,
        fixedFee: 0,
        effectiveStartDate: '2025-01-01',
        effectiveEndDate: '2025-12-31',
        roundingRule: 'round_2_decimals',
        active: true,
        version: 1
      },
      {
        id: 'r_current',
        providerName: 'فوري',
        paymentMethod: 'card',
        feePercent: 1.2,
        fixedFee: 1.0,
        effectiveStartDate: '2026-01-01',
        effectiveEndDate: '2026-12-31',
        roundingRule: 'round_2_decimals',
        active: true,
        version: 2
      }
    ];

    const matched = findApplicableFeeRule({
      providerName: 'فوري',
      paymentMethod: 'card',
      transactionDate: '2026-05-15',
      rules
    });

    expect(matched?.id).toBe('r_current');
    expect(matched?.feePercent).toBe(1.2);
  });

  it('12. Compares actual payment fees against provisional budget of EGP 1,200', () => {
    const comparison = comparePaymentFeesToBudget(850);
    expect(comparison.budgetProvision).toBe(1200);
    expect(comparison.actualTotalFees).toBe(850);
    expect(comparison.variance).toBe(-350);
    expect(comparison.status).toBe('within_budget');
  });

  // ==========================================
  // 4. MANAGER APPROVAL SECURITY & EXPIRATION
  // ==========================================

  it('13. Manager approval verifies PIN correctly', () => {
    const req = createManagerApprovalRequest({
      requestType: 'cash_refund_over_limit',
      requestedByCashierId: 'csh_1',
      requestedByCashierName: 'أحمد',
      reason: 'استرداد طلب كبير',
      amount: 350
    });

    // Wrong PIN
    const failRes = validateAndApplyApproval({
      request: req,
      managerPin: '0000',
      expectedManagerPin: '1234'
    });
    expect(failRes.canApply).toBe(false);
    expect(failRes.errorMessage).toContain('PIN');

    // Correct PIN
    const successRes = validateAndApplyApproval({
      request: req,
      managerPin: '1234',
      expectedManagerPin: '1234'
    });
    expect(successRes.canApply).toBe(true);
    expect(successRes.updatedRequest?.status).toBe('approved');
    expect(successRes.updatedRequest?.isApplied).toBe(true);
  });

  it('14. Expired approval request is blocked', () => {
    const expiredReq = createManagerApprovalRequest({
      requestType: 'cash_refund_over_limit',
      requestedByCashierId: 'csh_1',
      requestedByCashierName: 'أحمد',
      reason: 'استرداد متأخر',
      amount: 250,
      ttlMinutes: -5 // already expired in the past
    });

    const res = validateAndApplyApproval({
      request: expiredReq,
      managerPin: '1234',
      expectedManagerPin: '1234'
    });

    expect(res.canApply).toBe(false);
    expect(res.errorMessage).toContain('Expired');
  });

  it('15. Replay attack / duplicate approval execution is blocked', () => {
    const req = createManagerApprovalRequest({
      requestType: 'price_override',
      requestedByCashierId: 'csh_1',
      requestedByCashierName: 'أحمد',
      reason: 'تخفيض خاص',
      amount: 20
    });

    // First application
    const firstRes = validateAndApplyApproval({
      request: req,
      managerPin: '1234',
      expectedManagerPin: '1234'
    });
    expect(firstRes.canApply).toBe(true);

    // Second execution with same applied token
    const secondRes = validateAndApplyApproval({
      request: firstRes.updatedRequest!,
      managerPin: '1234',
      expectedManagerPin: '1234'
    });
    expect(secondRes.canApply).toBe(false);
    expect(secondRes.errorMessage).toContain('Replay Blocked');
  });

  // ==========================================
  // 5. WORKER PREPARATION TICKET (NO CUSTOMER PRICES)
  // ==========================================

  it('16. 80mm worker preparation ticket includes items, modifiers, sizes, but ZERO customer prices', () => {
    const ticket = formatWorkerPreparationTicket(samplePaidOrder);
    expect(ticket.ticketNumber).toBe('ORD-101');
    expect(ticket.orderTypeAr).toContain('تيك أواي');
    expect(ticket.items.length).toBe(1);
    expect(ticket.items[0].name).toBe('مانجو كينج نعومي');
    expect(ticket.items[0].size).toContain('400 مل');
    expect(ticket.items[0].sugar).toContain('سكر مظبوط');

    // Verify ticket structure has NO price property for items
    expect((ticket.items[0] as any).unitPrice).toBeUndefined();
    expect((ticket.items[0] as any).totalPrice).toBeUndefined();
  });

  // ==========================================
  // 6. DRINK WASTE TRACKING FOR PREPARED CANCELLATIONS
  // ==========================================

  it('17. Prepared order cancellation creates separate drink waste entry without blindly restoring stock', () => {
    const wasteEntries = calculateDrinkWaste({
      order: samplePaidOrder,
      cashierId: 'csh_1',
      reason: 'انسكاب أو تراجع العميل بعد التجهيز'
    });

    expect(wasteEntries.length).toBe(1);
    expect(wasteEntries[0].orderNumber).toBe('ORD-101');
    expect(wasteEntries[0].productNameAr).toBe('مانجو كينج نعومي');
    expect(wasteEntries[0].estimatedCostLoss).toBeGreaterThan(0);
  });

});
