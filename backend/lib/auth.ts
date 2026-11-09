import { NextRequest } from 'next/server';

const DEFAULT_PIN = '250504';

export function getExpectedPin(): string {
  return process.env.DASHBOARD_PIN || DEFAULT_PIN;
}

export function verifyPin(pin: string | null | undefined): boolean {
  if (!pin) return false;
  return pin.trim() === getExpectedPin().trim();
}

export function checkRequestAuth(request: NextRequest): boolean {
  // Check header 'x-dashboard-pin'
  const headerPin = request.headers.get('x-dashboard-pin');
  if (headerPin && verifyPin(headerPin)) {
    return true;
  }

  // Check Authorization Bearer
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (verifyPin(token)) {
      return true;
    }
  }

  // Check query parameter ?pin=
  try {
    const { searchParams } = new URL(request.url);
    const queryPin = searchParams.get('pin');
    if (queryPin && verifyPin(queryPin)) {
      return true;
    }
  } catch {
    // URL parsing fallback
  }

  return false;
}

