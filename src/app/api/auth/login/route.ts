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
