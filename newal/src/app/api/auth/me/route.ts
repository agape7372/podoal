import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function GET() {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return Response.json(
        { error: "Not authenticated." },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return Response.json(
        { error: "User not found." },
        { status: 404 }
      );
    }

    const profile = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
    };

    return Response.json({ user: profile });
  } catch (error) {
    console.error("Get current user error:", error);
    return Response.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    // Clear the token cookie by setting Max-Age=0
    const response = Response.json({ message: "Logged out successfully." });
    response.headers.set(
      "Set-Cookie",
      `token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`
    );
    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return Response.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
