"use client";

import { useMemo, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/utils";
import type { QuizAttemptData, QuizData } from "./QuizResult";

interface QuizTakerProps {
  lessonId: string;
  quiz: QuizData;
  remainingAttempts?: number;
  onComplete: (attemptData: QuizAttemptData) => void;
}

function sortQuestions(quiz: QuizData) {
  return quiz.questions
    .slice()
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
}

function sortOptions<T extends { orderIndex?: number }>(options: T[]) {
  return options
    .slice()
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
}

export function QuizTaker({
  lessonId,
  quiz,
  remainingAttempts,
  onComplete,
}: QuizTakerProps) {
  const api = useApi();
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<string, string>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const questions = useMemo(() => sortQuestions(quiz), [quiz]);
  const answeredCount = Object.keys(selectedAnswers).length;
  const isComplete = answeredCount === questions.length;
  const progressValue =
    questions.length > 0
      ? Math.round((answeredCount / questions.length) * 100)
      : 0;

  async function submitQuiz() {
    if (!isComplete) {
      toast.error("Vui lòng trả lời tất cả câu hỏi trước khi nộp bài.");
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading("Đang nộp bài...");
    const answers = questions.map((question) => ({
      questionId: question.id,
      optionId: selectedAnswers[question.id],
    }));

    const res = await api.post<QuizAttemptData>(
      `/api/lessons/${lessonId}/quiz/submit`,
      { answers },
    );

    if (res.success && res.data) {
      toast.success("Đã nộp Quiz.", { id: toastId });
      setIsConfirmOpen(false);
      onComplete(res.data);
    } else {
      toast.error(res.error ?? res.message ?? "Không thể nộp Quiz.", {
        id: toastId,
      });
    }

    setIsSubmitting(false);
  }

  return (
    <>
      <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-slate-50/70">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Quiz</p>
              <CardTitle className="mt-1 text-2xl font-extrabold text-slate-900">
                Quiz của bài học
              </CardTitle>
              <p className="mt-2 text-sm text-slate-500">
                {questions.length} câu hỏi
              </p>
            </div>
            {remainingAttempts !== undefined && (
              <Badge
                variant="outline"
                className="w-fit rounded-full border-sky-200 bg-sky-50 px-3 py-1 text-sky-700"
              >
                Còn {remainingAttempts} lượt làm bài
              </Badge>
            )}
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                Đã trả lời {answeredCount}/{questions.length}
              </span>
              <span>{progressValue}%</span>
            </div>
            <Progress value={progressValue} className="h-2" />
          </div>
        </CardHeader>

        <CardContent className="space-y-5 p-5">
          {questions.map((question, questionIndex) => (
            <Card key={question.id} className="border-slate-200 shadow-none">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <CardTitle className="text-base text-slate-900">
                    {questionIndex + 1}. {question.questionText}
                  </CardTitle>
                  <Badge variant="secondary" className="w-fit rounded-md">
                    {question.points} điểm
                  </Badge>
                </div>
                <p className="text-xs text-slate-500">
                  Câu {questionIndex + 1}/{questions.length}
                </p>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={selectedAnswers[question.id] ?? ""}
                  onValueChange={(optionId) =>
                    setSelectedAnswers((current) => ({
                      ...current,
                      [question.id]: optionId,
                    }))
                  }
                  className="gap-2"
                >
                  {sortOptions(question.options).map((option) => {
                    const isSelected =
                      selectedAnswers[question.id] === option.id;

                    return (
                      <Label
                        key={option.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-lg border bg-white p-3 text-sm text-slate-700 transition-colors hover:border-sky-200 hover:bg-sky-50/50",
                          isSelected
                            ? "border-sky-300 bg-sky-50"
                            : "border-slate-200",
                        )}
                      >
                        <RadioGroupItem value={option.id} className="mt-0.5" />
                        <span>{option.optionText}</span>
                      </Label>
                    );
                  })}
                </RadioGroup>
              </CardContent>
            </Card>
          ))}

          <div className="flex justify-end border-t border-slate-100 pt-4">
            <Button
              type="button"
              disabled={!isComplete || isSubmitting}
              onClick={() => setIsConfirmOpen(true)}
              className="gap-2 bg-sky-500 text-white hover:bg-sky-600"
            >
              {isSubmitting ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Send size={15} />
              )}
              Nộp bài
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bạn chắc chắn muốn nộp bài?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn sẽ không thể thay đổi câu trả lời sau khi nộp bài.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSubmitting}
              onClick={(event) => {
                event.preventDefault();
                void submitQuiz();
              }}
              className="gap-2 bg-sky-500 text-white hover:bg-sky-600"
            >
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              Nộp bài
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
