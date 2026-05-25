import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { applyAuthCookie, createToken } from "@/lib/auth";
import { clientKey, rateLimit } from "@/lib/rateLimit";

const registerLimit = rateLimit({
  windowMs: 60 * 60_000,
  max: 5,
  message: "잠시 후 다시 시도해주세요.",
});

export async function POST(request: NextRequest) {
  try {
    const blocked = registerLimit(clientKey(request));
    if (blocked) return blocked;

    const body = await request.json();
    const { name, email, password } = body;

    // Validate all fields exist
    if (!name || !email || !password) {
      return Response.json(
        { error: "Name, email, and password are required." },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Response.json(
        { error: "Invalid email format." },
        { status: 400 }
      );
    }

    // Validate password length (min 8 chars)
    if (typeof password !== "string" || password.length < 8) {
      return Response.json(
        { error: "비밀번호는 8자 이상이어야 합니다." },
        { status: 400 }
      );
    }
    if (password.length > 128) {
      return Response.json(
        { error: "비밀번호가 너무 깁니다 (최대 128자)." },
        { status: 400 }
      );
    }

    // Validate name length
    if (typeof name !== "string" || name.trim().length === 0 || name.length > 40) {
      return Response.json(
        { error: "이름은 1~40자여야 합니다." },
        { status: 400 }
      );
    }

    // Validate email length
    if (typeof email !== "string" || email.length > 254) {
      return Response.json(
        { error: "이메일 형식이 올바르지 않습니다." },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user in DB
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    // Create JWT token
    const token = await createToken(user.id);

    const profile = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
    };

    return applyAuthCookie(Response.json({ user: profile }), token);
  } catch (error: any) {
    // Handle duplicate email error (Prisma unique constraint violation)
    if (error?.code === "P2002") {
      return Response.json(
        { error: "Email is already registered." },
        { status: 409 }
      );
    }

    console.error("Register error:", error);
    return Response.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
