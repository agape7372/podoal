import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
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

    // Validate password length
    if (password.length < 4) {
      return Response.json(
        { error: "Password must be at least 4 characters." },
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

    // Set cookie and return response
    const response = Response.json({ user: profile });
    response.headers.set(
      "Set-Cookie",
      `token=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax`
    );
    return response;
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
