/**
 * Fruit City — Unified Local Backend API Client
 * Connects the frontend to the local SQLite & Argon2id service layer.
 */

export interface ApiResponse<T = any> {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export class ApiClient {
  private static baseUrl = '';

  static async isApiAvailable(): Promise<boolean> {
    try {
      const res = await fetch('/api/health', { signal: AbortSignal.timeout(2000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  static async getHealth(): Promise<{ status: string; isFirstRun: boolean; branchId: string; database: string } | null> {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  static async setupOwner(params: {
    fullNameAr: string;
    username: string;
    password: string;
  }): Promise<{ success: boolean; user?: any; error?: string; message?: string }> {
    const res = await fetch('/api/auth/setup-owner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    return await res.json();
  }

  static async login(username: string, password: string): Promise<{ success: boolean; user?: any; error?: string; message?: string }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    return await res.json();
  }

  static async getState(): Promise<any | null> {
    try {
      const res = await fetch('/api/state');
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  static async saveIngredient(ingredient: any): Promise<any> {
    const res = await fetch('/api/ingredients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ingredient)
    });
    return await res.json();
  }

  static async saveInvoice(invoice: any): Promise<any> {
    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoice)
    });
    return await res.json();
  }

  static async createOrder(order: any): Promise<any> {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order)
    });
    return await res.json();
  }

  static async recordPayment(payment: any): Promise<any> {
    const res = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payment)
    });
    return await res.json();
  }

  static async openShift(shift: any): Promise<any> {
    const res = await fetch('/api/shifts/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shift)
    });
    return await res.json();
  }

  static async closeShift(shiftId: string, actualCashCounted: number, notes?: string): Promise<any> {
    const res = await fetch('/api/shifts/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shiftId, actualCashCounted, notes })
    });
    return await res.json();
  }
}
