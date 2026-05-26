import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
    try {
        const userCount = await prisma.user.count();

        return NextResponse.json(
            {
                success: true,
                status: "ok",
                message: "Next.js and Prisma are working perfectly!",
                data: {
                    userCount: userCount,
                },
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Database connection error:", error);
        return NextResponse.json(
            {
                success: false,
                status: "error",
                message: "Failed to connect to the database.",
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}