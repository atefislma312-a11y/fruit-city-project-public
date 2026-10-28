import { 
  ManagerApprovalRequest, 
  ApprovalRequestType, 
  ApprovalRequestStatus, 
  PosOrder, 
  PaymentRecord, 
  RefundRecord 
} from '../types';
import { roundMoney } from './costingEngine';

export const CASHIER_CASH_REFUND_LIMIT_EGP = 200; // EGP cumulative threshold

/**
 * Validates whether a refund request can be processed directly by the cashier,
 * or requires manager authorization.
 *
 * Rules:
 * 1. Original verified payment must exist.
 * 2. Refund amount cannot exceed remaining refundable amount.
 * 3. Authority applies to CASH refunds ONLY:
 *    - If cash and cumulative refund <= EGP 200: Allowed directly by cashier.
 *    - If cash and (new refund > 200 OR cumulative refund + new refund > 200): Requires Manager Approval.
 * 4. Card or InstaPay refunds: ALWAYS require Manager Approval.
 * 5. Splitting refunds to bypass EGP 200 limit is strictly blocked by checking cumulative total.
 */
export function evaluateRefundEligibility(params: {
  order: PosOrder;
  refundAmount: number;
  refundMethod: 'cash' | 'instapay' | 'card';
  reason: string;
  existingRefunds: RefundRecord[];
}): {
  canProceedDirectly: boolean;
  requiresManagerApproval: boolean;
  maxRefundableAmount: number;
  remainingAfterRefund: number;
  cumulativeRefundAmount: number;
  errorMessage?: string;
} {
  const { order, refundAmount, refundMethod, reason, existingRefunds } = params;

  if (!reason || reason.trim().length === 0) {
    return {
      canProceedDirectly: false,
      requiresManagerApproval: false,
      maxRefundableAmount: 0,
      remainingAfterRefund: 0,
      cumulativeRefundAmount: 0,
      errorMessage: 'يجب كتابة سبب استرداد المبلغ بشكل إلزامي لتوثيق السجل المالي'
    };
  }

  if (order.paymentStatus !== 'paid' && order.paymentStatus !== 'partial') {
    return {
      canProceedDirectly: false,
      requiresManagerApproval: false,
      maxRefundableAmount: 0,
      remainingAfterRefund: 0,
      cumulativeRefundAmount: 0,
      errorMessage: 'لا يمكن استرداد مالي لطلب غير مدفوع أو لم يتم التحقق من سداده'
    };
  }

  // Calculate previously refunded amount for this order
  const orderRefunds = existingRefunds.filter(r => r.orderId === order.id && r.status === 'completed');
  const priorRefundedSum = orderRefunds.reduce((sum, r) => sum + r.amount, 0);

  const cleanAmount = roundMoney(refundAmount);
  if (cleanAmount <= 0) {
    return {
      canProceedDirectly: false,
      requiresManagerApproval: false,
      maxRefundableAmount: 0,
      remainingAfterRefund: 0,
      cumulativeRefundAmount: priorRefundedSum,
      errorMessage: 'مبلغ الاسترداد يجب أن يكون أكبر من صفر'
    };
  }

  const maxRefundableAmount = roundMoney(Math.max(0, order.totalAmount - priorRefundedSum));

  if (cleanAmount > maxRefundableAmount) {
    return {
      canProceedDirectly: false,
      requiresManagerApproval: false,
      maxRefundableAmount,
      remainingAfterRefund: 0,
      cumulativeRefundAmount: priorRefundedSum,
      errorMessage: `المبلغ المطلوب (${cleanAmount} ج) يتجاوز الرصيد المتبقي القابل للاسترداد (${maxRefundableAmount} ج)`
    };
  }

  const newCumulativeTotal = roundMoney(priorRefundedSum + cleanAmount);
  const remainingAfterRefund = roundMoney(maxRefundableAmount - cleanAmount);

  // Rule: Electronic refunds (Card / InstaPay) ALWAYS require manager authorization
  if (refundMethod === 'card' || refundMethod === 'instapay') {
    return {
      canProceedDirectly: false,
      requiresManagerApproval: true,
      maxRefundableAmount,
      remainingAfterRefund,
      cumulativeRefundAmount: newCumulativeTotal
    };
  }

  // Rule: Cash refund <= 200 cumulative
  if (newCumulativeTotal <= CASHIER_CASH_REFUND_LIMIT_EGP) {
    return {
      canProceedDirectly: true,
      requiresManagerApproval: false,
      maxRefundableAmount,
      remainingAfterRefund,
      cumulativeRefundAmount: newCumulativeTotal
    };
  }

  // Cash refund > 200 cumulative
  return {
    canProceedDirectly: false,
    requiresManagerApproval: true,
    maxRefundableAmount,
    remainingAfterRefund,
    cumulativeRefundAmount: newCumulativeTotal
  };
}

/**
 * Creates a new Manager Approval Request with expiry and execution token
 */
export function createManagerApprovalRequest(params: {
  requestType: ApprovalRequestType;
  requestedByCashierId: string;
  requestedByCashierName: string;
  reason: string;
  orderId?: string;
  orderNumber?: string;
  shiftId?: string;
  amount?: number;
  evidenceNotes?: string;
  ttlMinutes?: number;
}): ManagerApprovalRequest {
  const {
    requestType,
    requestedByCashierId,
    requestedByCashierName,
    reason,
    orderId,
    orderNumber,
    shiftId,
    amount,
    evidenceNotes,
    ttlMinutes = 15 // Default 15 minutes validity
  } = params;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000).toISOString();
  const token = `token_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  return {
    id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    requestType,
    orderId,
    orderNumber,
    shiftId,
    requestedByCashierId,
    requestedByCashierName,
    amount: amount ? roundMoney(amount) : undefined,
    reason,
    evidenceNotes,
    status: 'pending',
    createdAt: now.toISOString(),
    expiresAt,
    isApplied: false,
    executionToken: token
  };
}

/**
 * Validates and executes an approved request.
 * Enforces security rules:
 * - Checks if expired.
 * - Prevents replay attack / duplicate execution.
 * - Confirms manager approval status.
 */
export function validateAndApplyApproval(params: {
  request: ManagerApprovalRequest;
  managerPin: string;
  expectedManagerPin: string;
}): {
  canApply: boolean;
  updatedRequest?: ManagerApprovalRequest;
  errorMessage?: string;
} {
  const { request, managerPin, expectedManagerPin } = params;

  // 1. PIN verification
  if (managerPin !== expectedManagerPin) {
    return {
      canApply: false,
      errorMessage: 'رمز PIN الخاص بالمدير غير صحيح'
    };
  }

  // 2. Check replay attack
  if (request.isApplied) {
    return {
      canApply: false,
      errorMessage: 'تم تطبيق وتنفيذ هذا الطلب مسبقاً، ولا يمكن إعادة استخدامه (Replay Blocked)'
    };
  }

  // 3. Check expiration
  const now = new Date().toISOString();
  if (now > request.expiresAt) {
    return {
      canApply: false,
      errorMessage: 'انتهت صلاحية طلب الموافقة (Expired Request)'
    };
  }

  const updated: ManagerApprovalRequest = {
    ...request,
    status: 'approved',
    reviewedAt: now,
    reviewedByManagerId: 'mgr_admin',
    reviewedByManagerName: 'المدير المسؤول',
    isApplied: true,
    appliedAt: now
  };

  return {
    canApply: true,
    updatedRequest: updated
  };
}
