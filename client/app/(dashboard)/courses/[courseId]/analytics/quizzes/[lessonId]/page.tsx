"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Bot,
  CheckCircle2,
  Clock,
  Loader2,
  UserRound,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/utils";

interface TeacherQuizAttempt {
  id: string;
  score: number | null;
  totalPoints: number | null;
  startedAt: string;
  submittedAt: string | null;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    imageUrl: string | null;
    email: string;
  };
}

interface QuestionAnalyticsRow {
  questionText: string;
  options: {
    id: string;
    text: string;
    isCorrect: boolean;
  }[];
  totalAttempts: number;
  wrongCount: number;
  errorRatePercentage: number;
}

function getStudentName(student: TeacherQuizAttempt["student"]) {
  return `${student.firstName} ${student.lastName}`.trim() || "Học viên";
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDate(value: string | null) {
  if (!value) return "Chưa ghi nhận";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatScore(score: number | null, totalPoints: number | null) {
  if (score === null || !totalPoints || totalPoints <= 0) {
    return "Chưa có điểm";
  }

  const percentage = Math.round((score / totalPoints) * 100);
  return `${score}/${totalPoints} (${percentage}%)`;
}

function DetailSkeleton() {
  return (
    <div className="container mx-auto max-w-7xl px-6 py-8 md:px-24">
      <Skeleton className="h-9 w-40 rounded-xl" />
      <div className="mt-8 space-y-3">
        <Skeleton className="h-10 w-80 rounded-xl" />
        <Skeleton className="h-5 w-full max-w-xl rounded-lg" />
      </div>
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center gap-4">
              <Skeleton className="size-10 rounded-full" />
              <Skeleton className="h-5 flex-1 rounded-lg" />
              <Skeleton className="h-5 w-32 rounded-lg" />
              <Skeleton className="h-5 w-48 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function QuizAnalyticsDetailPage() {
  const params = useParams();
  const courseId = params?.courseId as string;
  const lessonId = params?.lessonId as string;
  const api = useApi();

  const [attempts, setAttempts] = useState<TeacherQuizAttempt[]>([]);
  const [questionStats, setQuestionStats] = useState<QuestionAnalyticsRow[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!lessonId) return;

    setIsLoading(true);
    setError(null);

    try {
      const [attemptsRes, analyticsRes] = await Promise.all([
        api.get<TeacherQuizAttempt[]>(`/api/lessons/${lessonId}/quiz/attempts`),
        api.get<QuestionAnalyticsRow[]>(
          `/api/lessons/${lessonId}/quiz/analytics`,
        ),
      ]);

      if (!attemptsRes.success || !attemptsRes.data) {
        throw new Error(
          attemptsRes.error ??
            attemptsRes.message ??
            "Không thể tải bảng điểm của bài kiểm tra.",
        );
      }

      if (!analyticsRes.success || !analyticsRes.data) {
        throw new Error(
          analyticsRes.error ??
            analyticsRes.message ??
            "Không thể tải phân tích câu hỏi.",
        );
      }

      setAttempts(attemptsRes.data);
      setQuestionStats(analyticsRes.data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Đã xảy ra lỗi khi tải thống kê bài kiểm tra.",
      );
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleGenerateAdvice() {
    if (questionStats.length === 0 || isGenerating) return;

    setIsGenerating(true);
    const toastId = toast.loading("AI Tutor đang phân tích dữ liệu quiz...");

    try {
      const res = await api.post<{ advice: string }>(
        `/api/lessons/${lessonId}/quiz/ai-advice`,
        {
          topQuestions: questionStats.map((question) => ({
            questionText: question.questionText,
            errorRatePercentage: question.errorRatePercentage,
          })),
        },
      );

      if (!res.success || !res.data?.advice) {
        throw new Error(
          res.error ?? res.message ?? "Không thể tạo gợi ý từ AI Tutor.",
        );
      }

      setAiAdvice(res.data.advice);
      toast.success("AI Tutor đã tạo gợi ý sư phạm.", { id: toastId });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Không thể tạo gợi ý từ AI Tutor.",
        { id: toastId },
      );
    } finally {
      setIsGenerating(false);
    }
  }

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-7xl px-6 py-16 md:px-24">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-red-50">
            <AlertCircle size={28} className="text-red-400" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">
              Không thể tải thống kê
            </p>
            <p className="mt-1 max-w-md text-sm text-slate-500">{error}</p>
          </div>
          <div className="flex gap-2">
            <Link href={`/courses/${courseId}?tab=analytics`}>
              <Button variant="outline" className="rounded-xl">
                Quay lại
              </Button>
            </Link>
            <Button
              type="button"
              className="rounded-xl bg-sky-500 text-white hover:bg-sky-600"
              onClick={() => void loadData()}
            >
              Thử lại
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-6 py-8 md:px-24">
      <Link href={`/courses/${courseId}?tab=analytics`}>
        <Button
          type="button"
          variant="ghost"
          className="mb-8 gap-2 rounded-xl text-slate-600 hover:text-sky-600"
        >
          <ArrowLeft size={16} />
          Quay lại
        </Button>
      </Link>

      <div className="mb-12">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Chi tiết thống kê quiz
        </h1>
        <p className="mt-1 text-base text-slate-500">
          Xem bảng điểm của học viên và các câu hỏi mà lớp thường trả lời sai.
        </p>
      </div>

      <Tabs defaultValue="scoreboard" className="space-y-6">
        <TabsList
          variant="line"
          className="w-full justify-start gap-8 rounded-none font-semibold"
        >
          <TabsTrigger
            value="scoreboard"
            className="gap-2 px-0 text-base after:bg-sky-500 data-active:text-sky-600"
          >
            <UserRound size={16} />
            Bảng điểm
          </TabsTrigger>
          <TabsTrigger
            value="questions"
            className="gap-2 px-0 text-base after:bg-sky-500 data-active:text-sky-600"
          >
            <BarChart3 size={16} />
            Phân tích câu hỏi
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scoreboard">
          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Bảng điểm</h2>
              <p className="mt-1 text-sm text-slate-500">
                Danh sách lượt nộp bài của học viên trong bài kiểm tra này.
              </p>
            </div>

            {attempts.length === 0 ? (
              <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
                <Clock size={32} className="text-slate-300" />
                <div>
                  <p className="font-semibold text-slate-800">
                    Chưa có lượt nộp bài
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Khi học viên nộp bài, bảng điểm sẽ xuất hiện tại đây.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-4 py-3">Học viên</TableHead>
                      <TableHead className="px-4 py-3">Điểm số</TableHead>
                      <TableHead className="px-4 py-3">
                        Thời gian nộp bài
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attempts.map((attempt) => {
                      const name = getStudentName(attempt.student);

                      return (
                        <TableRow key={attempt.id}>
                          <TableCell className="px-4 py-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <Avatar className="size-10">
                                <AvatarImage
                                  src={attempt.student.imageUrl ?? undefined}
                                />
                                <AvatarFallback className="bg-sky-100 font-bold text-sky-700">
                                  {getInitials(name) || <UserRound size={16} />}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-slate-900">
                                  {name}
                                </p>
                                <p className="truncate text-xs text-slate-500">
                                  {attempt.student.email}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3 font-semibold text-slate-800">
                            {formatScore(attempt.score, attempt.totalPoints)}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-slate-600">
                            {formatDate(
                              attempt.submittedAt ?? attempt.startedAt,
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </TabsContent>

        <TabsContent value="questions">
          <section className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Khuyết điểm của lớp
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Các câu hỏi có tỷ lệ trả lời sai cao nhất, giúp giảng viên
                  biết phần nào cần ôn tập thêm.
                </p>
              </div>
              <Button
                type="button"
                disabled={questionStats.length === 0 || isGenerating}
                className="gap-2 rounded-xl bg-linear-to-r from-blue-600 via-indigo-500 to-purple-600 text-white shadow-md hover:shadow-indigo-500/30"
                onClick={() => void handleGenerateAdvice()}
              >
                {isGenerating ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Bot size={16} />
                )}
                ✨ Phân tích bằng AI Tutor
              </Button>
            </div>

            {aiAdvice && (
              <Card className="border-sky-200 bg-sky-50/70 shadow-sm dark:border-sky-900/50 dark:bg-sky-950/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base text-slate-900 dark:text-slate-100">
                    <Bot size={18} className="text-sky-600" />
                    Gợi ý sư phạm từ AI Tutor
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {aiAdvice}
                    </ReactMarkdown>
                  </div>
                </CardContent>
              </Card>
            )}

            {questionStats.length === 0 ? (
              <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
                <BarChart3 size={32} className="text-slate-300" />
                <div>
                  <p className="font-semibold text-slate-800">
                    Chưa đủ dữ liệu phân tích
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Cần có lượt nộp bài để xác định câu hỏi thường bị trả lời
                    sai.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-4">
                {questionStats.map((question, index) => (
                  <article
                    key={`${question.questionText}-${index}`}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <Badge
                          variant="outline"
                          className="border-red-200 bg-red-50 text-red-700"
                        >
                          Sai {question.errorRatePercentage}%
                        </Badge>
                        <p className="mt-3 font-semibold leading-7 text-slate-900">
                          {question.questionText}
                        </p>
                        {question.options.length > 0 && (
                          <ul className="mt-3 flex flex-col gap-1.5">
                            {question.options.map((option) => (
                              <li
                                key={option.id}
                                className={cn(
                                  "flex items-start gap-2 rounded-lg px-3 py-2 text-sm",
                                  option.isCorrect
                                    ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                                    : "bg-slate-50 text-muted-foreground dark:bg-slate-900/40",
                                )}
                              >
                                {option.isCorrect && (
                                  <CheckCircle2
                                    size={15}
                                    className="mt-0.5 shrink-0"
                                  />
                                )}
                                <span>{option.text}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-start gap-2 text-sm text-slate-500 sm:items-end">
                        <span>
                          {question.wrongCount}/{question.totalAttempts} lượt
                          sai
                        </span>
                        <Link
                          href={`/courses/${courseId}/edit?tab=curriculum&lessonId=${lessonId}`}
                        >
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 rounded-lg text-sky-600 hover:bg-sky-50 hover:text-sky-700"
                          >
                            Sửa câu hỏi
                          </Button>
                        </Link>
                      </div>
                    </div>
                    <Progress
                      value={question.errorRatePercentage}
                      className="mt-4"
                    />
                  </article>
                ))}
              </div>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
