import { NextRequest } from 'next/server';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAccountFromRequest } from '@/lib/auth';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(request: NextRequest) {
  const account = getAccountFromRequest(request);
  if (!account) {
    return errorResponse('Chưa đăng nhập hoặc phiên làm việc đã hết hạn', 401);
  }

  return jsonResponse({
    success: true,
    account,
  });
}

