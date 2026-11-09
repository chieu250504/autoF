import { NextRequest } from 'next/server';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { verifyPin } from '@/lib/auth';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const pin = body.pin || request.headers.get('x-dashboard-pin');

    if (!pin) {
      return errorResponse('Mã PIN không được để trống', 400);
    }

    const isValid = verifyPin(pin);
    if (!isValid) {
      return jsonResponse({ success: false, valid: false, message: 'Mã PIN không chính xác' }, 401);
    }

    return jsonResponse({
      success: true,
      valid: true,
      message: 'Xác thực mã PIN thành công',
    });
  } catch (err: any) {
    return errorResponse(err?.message || 'Lỗi kiểm tra mã PIN', 500);
  }
}
