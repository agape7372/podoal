import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { applyAuthCookie, createToken } from "@/lib/auth";
import { clientKey, rateLimit } from "@/lib/rateLimit";

const loginLimit = rateLimit({
  windowMs: 60_000,
  max: 10,
  message: "잠시 후 다시 시도해주세요.",
});

// 열거 타이밍 오라클 봉쇄용 고정 더미 해시(register와 동일 cost=10).
// 유저 부재 경로에서도 존재 계정과 동일하게 bcrypt.compare를 1회 수행해
// 응답 시간 프로파일을 평준화한다. 리터럴 상수 — 빌드타임 생성 금지.
const DUMMY_PASSWORD_HASH =
  "$2b$10$Sj0zDm/pVtDRkCpsSaEbDer3emTXhS2csV0KAJ6xwg7qj/JkaFVkC";

export async function POST(request: NextRequest) {
  try {
    const blocked = await loginLimit(clientKey(request));
    if (blocked) return blocked;

    const body = await request.json();
    const { email, password } = body;

    // Validate fields exist
    if (!email || !password) {
      return Response.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // 존재 계정과 응답 시간을 맞추기 위해 더미 해시로 compare 1회 수행(결과는 버림).
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      return Response.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    // OAuth-only account (no password set) — point the user back to the social login.
    if (!user.password) {
      const provider = user.provider || 'social';
      return Response.json(
        { error: `이 계정은 ${provider} 로그인으로 가입했어요. 첫 화면에서 해당 버튼을 눌러주세요.` },
        { status: 409 }
      );
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return Response.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    // Create JWT token
    const token = await createToken(user.id);

    const profile = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
    };

    return applyAuthCookie(Response.json({ user: profile }), token);
  } catch (error) {
    console.error("Login error:", error);
    return Response.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
