/**
 * ==================================================
 * API Route: POST /api/auth/passkey/login/verify
 * ==================================================
 * ตรวจสอบการเข้าสู่ระบบด้วย passkey แล้วสร้าง session เหมือนการ login ด้วยรหัสผ่าน
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/server';
import { prisma } from '@/lib/prisma';
import { generateSecureToken, generateAvatarInitials } from '@/lib/security';
import {
  getRpConfig,
  consumeChallenge,
  fromBase64url,
  parseTransports,
} from '@/lib/webauthn';
import { logger } from '@/lib/logger';

/** ดึง IP address ของ client จาก request */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  if (forwarded) return forwarded.split(',')[0].trim();
  if (realIp) return realIp;
  return 'unknown';
}

export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request);

  try {
    const { rpID, origin } = getRpConfig();

    const body = await request.json();
    const authResp = body?.response as AuthenticationResponseJSON | undefined;
    if (!authResp) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'ข้อมูลไม่ครบถ้วน' },
        { status: 400 }
      );
    }

    // ดึง challenge ที่เก็บไว้จากขั้น options
    const stored = await consumeChallenge();
    if (!stored || !stored.userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'CHALLENGE_INVALID',
          message: 'คำขอหมดอายุหรือไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง',
        },
        { status: 400 }
      );
    }

    // ค้นหา authenticator จาก credential ID ที่ส่งมา และต้องเป็นของผู้ใช้เดียวกับ challenge
    const authenticator = await prisma.authenticator.findUnique({
      where: { credentialId: authResp.id },
      include: { user: true },
    });

    if (!authenticator || authenticator.userId !== stored.userId) {
      return NextResponse.json(
        { success: false, error: 'PASSKEY_NOT_FOUND', message: 'ไม่พบ passkey นี้' },
        { status: 404 }
      );
    }

    if (!authenticator.user.isActive) {
      return NextResponse.json(
        { success: false, error: 'ACCOUNT_DISABLED', message: 'บัญชีของคุณถูกปิดใช้งาน' },
        { status: 403 }
      );
    }

    const verification = await verifyAuthenticationResponse({
      response: authResp,
      expectedChallenge: stored.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
      credential: {
        id: authenticator.credentialId,
        publicKey: fromBase64url(authenticator.publicKey),
        counter: authenticator.counter,
        transports: parseTransports(authenticator.transports) as AuthenticatorTransportFuture[] | undefined,
      },
    });

    if (!verification.verified) {
      await prisma.loginAttempt.create({
        data: {
          userId: authenticator.userId,
          username: authenticator.user.username,
          ipAddress: clientIp,
          success: false,
          reason: 'passkey ยืนยันไม่สำเร็จ',
        },
      });
      return NextResponse.json(
        { success: false, error: 'VERIFICATION_FAILED', message: 'ไม่สามารถยืนยัน passkey ได้' },
        { status: 401 }
      );
    }

    // อัปเดต counter (ป้องกัน replay) และเวลาใช้งานล่าสุด
    await prisma.authenticator.update({
      where: { id: authenticator.id },
      data: {
        counter: verification.authenticationInfo.newCounter,
        lastUsedAt: new Date(),
      },
    });

    const user = authenticator.user;
    logger.info('User logged in with passkey', { userId: user.id, ip: clientIp });

    // --- สร้าง session เหมือนการ login ด้วยรหัสผ่าน เพื่อให้ requireAuth/getCurrentUser ทำงานต่อได้ ---
    const token = generateSecureToken(64);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
        ipAddress: clientIp,
        userAgent: request.headers.get('user-agent') || undefined,
      },
    });

    await prisma.loginAttempt.create({
      data: {
        userId: user.id,
        username: user.username,
        ipAddress: clientIp,
        success: true,
      },
    });

    const avatar = user.avatar || generateAvatarInitials(user.name);

    (await cookies()).set('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: expiresAt,
      path: '/',
    });

    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json({
      success: true,
      data: {
        user: { ...userWithoutPassword, avatar },
        token,
        expiresAt,
      },
      message: 'เข้าสู่ระบบสำเร็จ',
    });
  } catch (error) {
    logger.error('Passkey login verify error', { error, ip: clientIp });
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR', message: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}
