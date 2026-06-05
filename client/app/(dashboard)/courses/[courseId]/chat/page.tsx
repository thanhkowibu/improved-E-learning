import { notFound } from "next/navigation";

import { ChatWidget } from "@/components/chat/ChatWidget";
import prisma from "@/lib/prisma";

type ChatPageProps = {
  params: Promise<{ courseId: string }>;
};

export default async function CourseChatPage({ params }: ChatPageProps) {
  const { courseId } = await params;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      title: true,
    },
  });

  if (!course) {
    notFound();
  }

  return (
    <main className="mx-auto flex h-[calc(100vh-120px)] max-w-7xl flex-col gap-4 px-6 py-6 md:px-12 lg:px-24">
      <header className="shrink-0">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          AI Tutor: {course.title}
        </h1>
      </header>

      <div className="min-h-0 flex-1">
        <ChatWidget courseId={course.id} />
      </div>
    </main>
  );
}
