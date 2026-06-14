"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/utils";

export interface QuizOptionData {
  id: string;
  optionText: string;
  isCorrect?: boolean;
  orderIndex?: number;
}

export interface QuizQuestionData {
  id: string;
  questionText: string;
  explanation?: string | null;
  points: number;
  orderIndex?: number;
  options: QuizOptionData[];
}

export interface QuizData {
  id: string;
  lessonId: string;
  dueDate?: string | Date | null;
  maxAttempts: number;
  passingScore: number;
  questions: QuizQuestionData[];
}

export interface QuizAttemptAnswerData {
  id: string;
  questionId: string;
  optionId: string;
  question?: QuizQuestionData;
  option?: QuizOptionData;
}

export interface QuizAttemptData {
  id: string;
  quizId: string;
  score: number;
  totalPoints: number;
  startedAt?: string | Date | null;
  submittedAt?: string | Date | null;
  answers: QuizAttemptAnswerData[];
}

interface QuizResultProps {
  attempt: QuizAttemptData;
  quiz: QuizData;
}

interface AIExplanationState {
  loading: boolean;
  text?: string;
  visible: boolean;
}

interface AIExplanationResponse {
  explanation: string;
}

function formatPercent(score: number, totalPoints: number) {
  if (totalPoints <= 0) return 0;
  return Math.round((score / totalPoints) * 100);
}

function sortQuestions(questions: QuizQuestionData[]) {
  return questions
    .slice()
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
}

function sortOptions(options: QuizOptionData[]) {
  return options
    .slice()
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
}

function getAIExplanationCacheKey(attemptId: string, quizId: string) {
  return `learnai:quiz-ai-explanations:${quizId}:${attemptId}`;
}

function loadAIExplanationCache(
  cacheKey: string,
): Record<string, AIExplanationState> {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.sessionStorage.getItem(cacheKey);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Record<string, { text?: unknown }>;
    return Object.fromEntries(
      Object.entries(parsed).flatMap(([questionId, value]) => {
        if (typeof value?.text !== "string" || !value.text) {
          return [];
        }

        return [
          [
            questionId,
            {
              loading: false,
              text: value.text,
              visible: false,
            } satisfies AIExplanationState,
          ],
        ];
      }),
    );
  } catch (error) {
    console.error("Failed to read quiz AI explanation cache.", {
      cacheKey,
      error,
    });
    return {};
  }
}

function saveAIExplanationCache(
  cacheKey: string,
  aiData: Record<string, AIExplanationState>,
) {
  if (typeof window === "undefined") return;

  try {
    const cachePayload = Object.fromEntries(
      Object.entries(aiData).flatMap(([questionId, value]) => {
        if (!value.text) return [];
        return [[questionId, { text: value.text }]];
      }),
    );

    window.sessionStorage.setItem(cacheKey, JSON.stringify(cachePayload));
  } catch (error) {
    console.error("Failed to save quiz AI explanation cache.", {
      cacheKey,
      error,
    });
  }
}

export function QuizResult({ attempt, quiz }: QuizResultProps) {
  const api = useApi();
  const aiCacheKey = useMemo(
    () => getAIExplanationCacheKey(attempt.id, quiz.id),
    [attempt.id, quiz.id],
  );
  const [aiData, setAiData] = useState<Record<string, AIExplanationState>>(() =>
    loadAIExplanationCache(aiCacheKey),
  );
  const percent = formatPercent(attempt.score, attempt.totalPoints);
  const passed =
    attempt.totalPoints > 0 &&
    attempt.score / attempt.totalPoints >= quiz.passingScore;
  const answersByQuestionId = new Map(
    attempt.answers.map((answer) => [answer.questionId, answer]),
  );
  const questions = sortQuestions(
    quiz.questions.map((question) => {
      const gradedQuestion = answersByQuestionId.get(question.id)?.question;
      return gradedQuestion ?? question;
    }),
  );

  useEffect(() => {
    setAiData(loadAIExplanationCache(aiCacheKey));
  }, [aiCacheKey]);

  useEffect(() => {
    saveAIExplanationCache(aiCacheKey, aiData);
  }, [aiCacheKey, aiData]);

  async function handleExplainQuestion({
    question,
    options,
    correctOption,
    studentOption,
  }: {
    question: QuizQuestionData;
    options: QuizOptionData[];
    correctOption: QuizOptionData | undefined;
    studentOption: QuizOptionData | undefined;
  }) {
    const current = aiData[question.id];

    if (current?.text) {
      setAiData((previous) => ({
        ...previous,
        [question.id]: {
          ...current,
          visible: !current.visible,
        },
      }));
      return;
    }

    setAiData((previous) => ({
      ...previous,
      [question.id]: {
        loading: true,
        visible: true,
      },
    }));

    const res = await api.post<AIExplanationResponse>("/api/quiz/explain", {
      questionText: question.questionText,
      options: options.map((option) => option.optionText),
      correctOption: correctOption?.optionText ?? "Không có đáp án đúng",
      studentOption: studentOption?.optionText ?? "Chưa chọn đáp án",
    });

    const explanation = res.data?.explanation;

    if (res.success && explanation) {
      setAiData((previous) => ({
        ...previous,
        [question.id]: {
          loading: false,
          text: explanation,
          visible: true,
        },
      }));
    } else {
      toast.error(
        res.error ??
          res.message ??
          "Không thể tạo giải thích. Vui lòng thử lại.",
      );
      setAiData((previous) => ({
        ...previous,
        [question.id]: {
          loading: false,
          visible: false,
        },
      }));
    }
  }

  return (
    <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 bg-slate-50/70">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Kết quả Quiz</p>
            <CardTitle className="mt-1 text-3xl font-extrabold text-slate-900">
              {attempt.score}/{attempt.totalPoints} - {percent}%
            </CardTitle>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "w-fit rounded-full px-3 py-1 text-sm font-semibold",
              passed
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700",
            )}
          >
            {passed ? "Đạt" : "Chưa đạt"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-5">
        {questions.map((question, questionIndex) => {
          const answer = answersByQuestionId.get(question.id);
          const options = sortOptions(question.options);
          const correctOption = options.find((option) => option.isCorrect);
          const selectedOption = options.find(
            (option) => option.id === answer?.optionId,
          );
          const selectedWasCorrect =
            selectedOption?.isCorrect === true ||
            answer?.option?.isCorrect === true ||
            (Boolean(correctOption) &&
              selectedOption?.id === correctOption?.id);
          const explanationState = aiData[question.id];

          return (
            <section
              key={question.id}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {questionIndex + 1}. {question.questionText}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {question.points} điểm
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "w-fit rounded-full",
                    selectedWasCorrect
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-red-200 bg-red-50 text-red-700",
                  )}
                >
                  {selectedWasCorrect ? "Đúng" : "Sai"}
                </Badge>
              </div>

              <div className="space-y-2">
                {options.map((option) => {
                  const isSelected = option.id === selectedOption?.id;
                  const isCorrect = option.isCorrect === true;

                  return (
                    <div
                      key={option.id}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-sm transition-colors",
                        isCorrect &&
                          "border-emerald-200 bg-emerald-50 text-emerald-800",
                        isSelected &&
                          !isCorrect &&
                          "border-red-200 bg-red-50 text-red-800",
                        !isSelected &&
                          !isCorrect &&
                          "border-slate-200 bg-slate-50/60 text-slate-700",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span>{option.optionText}</span>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {isSelected && (
                            <Badge variant="outline" className="bg-white/70">
                              Đáp án của bạn
                            </Badge>
                          )}
                          {isCorrect && (
                            <Badge
                              variant="outline"
                              className="border-emerald-200 bg-white/70 text-emerald-700"
                            >
                              Đúng
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {!selectedWasCorrect && correctOption && (
                <p className="mt-3 text-sm text-slate-600">
                  Đáp án đúng:{" "}
                  <span className="font-semibold text-emerald-700">
                    {correctOption.optionText}
                  </span>
                </p>
              )}

              {question.explanation && (
                <Alert className="mt-4 border-slate-200 bg-slate-50">
                  <AlertDescription>{question.explanation}</AlertDescription>
                </Alert>
              )}

              <div className="mt-4 border-t border-slate-100 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={explanationState?.loading}
                  onClick={() =>
                    void handleExplainQuestion({
                      question,
                      options,
                      correctOption,
                      studentOption: selectedOption,
                    })
                  }
                  className="gap-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  {explanationState?.loading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  Hỏi trợ giảng AI giải thích
                </Button>

                {explanationState?.visible && explanationState.text && (
                  <Alert className="mt-3 border-indigo-200 bg-indigo-50/70 text-slate-800">
                    <Sparkles className="size-4 text-indigo-500" />
                    <AlertDescription>
                      <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1">
                        <ReactMarkdown>{explanationState.text}</ReactMarkdown>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}
