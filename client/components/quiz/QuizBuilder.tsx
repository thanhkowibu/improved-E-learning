"use client";

import { useCallback, useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { z } from "zod";
import {
  CalendarIcon,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  Controller,
  useFieldArray,
  useForm,
  type Control,
  type FieldErrors,
  type FieldArrayWithId,
  type UseFormRegister,
  type UseFormSetValue,
  type UseFormWatch,
} from "react-hook-form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/utils";
import type { QuizCreateInput } from "@/lib/validations/quiz";

const quizBuilderOptionSchema = z.object({
  optionText: z.string().min(1, "Vui lòng nhập nội dung lựa chọn.").max(2_000),
  isCorrect: z.boolean(),
});

const quizBuilderQuestionSchema = z
  .object({
    questionText: z
      .string()
      .min(1, "Vui lòng nhập nội dung câu hỏi.")
      .max(5_000),
    explanation: z.string().max(5_000).optional().nullable(),
    points: z.number().int().min(1).max(100),
    options: z.array(quizBuilderOptionSchema).min(2).max(6),
  })
  .superRefine((question, ctx) => {
    const correctCount = question.options.filter(
      (option) => option.isCorrect,
    ).length;
    if (correctCount !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "Mỗi câu hỏi phải có đúng một đáp án đúng.",
      });
    }
  });

const quizBuilderSchema = z.object({
  maxAttempts: z.number().int().min(1).max(100),
  passingScore: z.number().min(0).max(1),
  dueDate: z.date().optional(),
  questions: z.array(quizBuilderQuestionSchema).min(1),
});

type QuizFormValues = z.infer<typeof quizBuilderSchema>;
type QuestionField = FieldArrayWithId<QuizFormValues, "questions", "id">;
type OptionFieldArrayName = `questions.${number}.options`;

interface QuizBuilderProps {
  lessonId: string;
}

interface QuizResponse {
  id: string;
  lessonId: string;
  dueDate: string | Date | null;
  maxAttempts: number;
  passingScore: number;
  questions: Array<{
    id: string;
    questionText: string;
    explanation: string | null;
    points: number;
    options: Array<{
      id: string;
      optionText: string;
      isCorrect: boolean;
    }>;
  }>;
}

const emptyQuestion = (): QuizFormValues["questions"][number] => ({
  questionText: "",
  explanation: "",
  points: 1,
  options: [
    { optionText: "", isCorrect: true },
    { optionText: "", isCorrect: false },
  ],
});

const defaultValues: QuizFormValues = {
  maxAttempts: 1,
  passingScore: 0.5,
  dueDate: undefined,
  questions: [emptyQuestion()],
};

function toFormValues(quiz: QuizResponse): QuizFormValues {
  return {
    maxAttempts: quiz.maxAttempts,
    passingScore: quiz.passingScore,
    dueDate: quiz.dueDate ? new Date(quiz.dueDate) : undefined,
    questions: quiz.questions.map((question) => ({
      questionText: question.questionText,
      explanation: question.explanation ?? "",
      points: question.points,
      options: question.options.map((option) => ({
        optionText: option.optionText,
        isCorrect: option.isCorrect,
      })),
    })),
  };
}

function normalizePayload(values: QuizFormValues): QuizFormValues {
  return {
    ...values,
    dueDate: values.dueDate,
    questions: values.questions.map((question) => ({
      ...question,
      explanation: question.explanation?.trim() ? question.explanation : null,
      options: question.options.map((option) => ({
        optionText: option.optionText,
        isCorrect: option.isCorrect,
      })),
    })),
  };
}

function DatePicker({
  value,
  onChange,
}: {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-9 w-full justify-start gap-2 rounded-lg border-slate-200 text-left font-normal",
              !value && "text-muted-foreground",
            )}
          />
        }
      >
        <CalendarIcon size={15} />
        {value ? format(value, "PPP", { locale: vi }) : "Không đặt hạn nộp"}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          captionLayout="dropdown"
          locale={vi}
        />
        <div className="border-t border-slate-100 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(undefined)}
            className="w-full"
          >
            Xóa hạn nộp
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function QuestionOptions({
  questionIndex,
  control,
  register,
  setValue,
  watch,
  errors,
}: {
  questionIndex: number;
  control: Control<QuizFormValues>;
  register: UseFormRegister<QuizFormValues>;
  setValue: UseFormSetValue<QuizFormValues>;
  watch: UseFormWatch<QuizFormValues>;
  errors: FieldErrors<QuizFormValues>;
}) {
  const optionsName =
    `questions.${questionIndex}.options` as OptionFieldArrayName;
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: optionsName,
  });
  const options = watch(optionsName);
  const correctIndex = Math.max(
    0,
    options?.findIndex((option) => option.isCorrect) ?? 0,
  );
  const optionErrors = errors.questions?.[questionIndex]?.options;

  function setCorrectOption(nextIndex: number) {
    fields.forEach((_, optionIndex) => {
      setValue(
        `questions.${questionIndex}.options.${optionIndex}.isCorrect`,
        optionIndex === nextIndex,
        { shouldDirty: true, shouldValidate: true },
      );
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label>Lựa chọn trả lời</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={fields.length >= 6}
          onClick={() => append({ optionText: "", isCorrect: false })}
          className="h-8 gap-1.5 rounded-lg"
        >
          <Plus size={13} />
          Thêm lựa chọn
        </Button>
      </div>

      <RadioGroup
        value={String(correctIndex)}
        onValueChange={(value) => setCorrectOption(Number(value))}
        className="gap-2"
      >
        {fields.map((field, optionIndex) => (
          <div
            key={field.id}
            className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3"
          >
            <RadioGroupItem
              value={String(optionIndex)}
              className="mt-2"
              aria-label={`Đánh dấu lựa chọn ${optionIndex + 1} là đáp án đúng`}
            />
            <input
              type="hidden"
              {...register(
                `questions.${questionIndex}.options.${optionIndex}.isCorrect`,
              )}
            />
            <div className="min-w-0 flex-1 space-y-1">
              <Input
                placeholder={`Lựa chọn ${optionIndex + 1}`}
                {...register(
                  `questions.${questionIndex}.options.${optionIndex}.optionText`,
                )}
              />
              {optionErrors?.[optionIndex]?.optionText?.message && (
                <p className="text-xs text-red-500">
                  {optionErrors[optionIndex]?.optionText?.message}
                </p>
              )}
            </div>
            <div className="mt-1 flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={optionIndex === 0}
                onClick={() => move(optionIndex, optionIndex - 1)}
                className="text-slate-400 hover:bg-sky-50 hover:text-sky-600 disabled:opacity-30"
                aria-label={`Đưa lựa chọn ${optionIndex + 1} lên`}
              >
                <ChevronUp size={14} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={optionIndex === fields.length - 1}
                onClick={() => move(optionIndex, optionIndex + 1)}
                className="text-slate-400 hover:bg-sky-50 hover:text-sky-600 disabled:opacity-30"
                aria-label={`Đưa lựa chọn ${optionIndex + 1} xuống`}
              >
                <ChevronDown size={14} />
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={fields.length <= 2}
              onClick={() => {
                const removedCorrect = options?.[optionIndex]?.isCorrect;
                remove(optionIndex);
                if (removedCorrect) {
                  setValue(
                    `questions.${questionIndex}.options.0.isCorrect`,
                    true,
                    {
                      shouldDirty: true,
                      shouldValidate: true,
                    },
                  );
                }
              }}
              className="mt-1 shrink-0 text-slate-400 hover:bg-red-50 hover:text-red-600"
              aria-label="Xóa lựa chọn"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
      </RadioGroup>

      {typeof optionErrors?.message === "string" && (
        <p className="text-xs text-red-500">{optionErrors.message}</p>
      )}
    </div>
  );
}

function SortableQuestionCard({
  field,
  index,
  control,
  register,
  setValue,
  watch,
  errors,
  canRemove,
  onRemove,
}: {
  field: QuestionField;
  index: number;
  control: Control<QuizFormValues>;
  register: UseFormRegister<QuizFormValues>;
  setValue: UseFormSetValue<QuizFormValues>;
  watch: UseFormWatch<QuizFormValues>;
  errors: FieldErrors<QuizFormValues>;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });
  const questionErrors = errors.questions?.[index];

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <CardHeader className="grid grid-cols-[auto_1fr_auto] items-start gap-3 border-b border-slate-100 pb-4">
          <button
            type="button"
            className="mt-1 cursor-grab touch-none rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing"
            aria-label="Kéo để sắp xếp câu hỏi"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={18} />
          </button>
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-sm">
              Câu hỏi {index + 1}
              <Badge variant="outline" className="rounded-md">
                {watch(`questions.${index}.points`)} điểm
              </Badge>
            </CardTitle>
            <CardDescription>
              Nhập đề bài, điểm, giải thích tùy chọn và các lựa chọn trả lời.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!canRemove}
            onClick={onRemove}
            className="gap-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 size={14} />
            Xóa
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[1fr_7rem]">
            <div className="space-y-1.5">
              <Label htmlFor={`question-${field.id}`}>Nội dung câu hỏi</Label>
              <Textarea
                id={`question-${field.id}`}
                placeholder="Nhập câu hỏi sinh viên cần trả lời..."
                {...register(`questions.${index}.questionText`)}
              />
              {questionErrors?.questionText?.message && (
                <p className="text-xs text-red-500">
                  {questionErrors.questionText.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Điểm</Label>
              <Input
                type="number"
                min={1}
                max={100}
                {...register(`questions.${index}.points`, {
                  valueAsNumber: true,
                })}
              />
              {questionErrors?.points?.message && (
                <p className="text-xs text-red-500">
                  {questionErrors.points.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Giải thích</Label>
            <Textarea
              placeholder="Giải thích tùy chọn hiển thị khi xem lại..."
              {...register(`questions.${index}.explanation`)}
            />
            {questionErrors?.explanation?.message && (
              <p className="text-xs text-red-500">
                {questionErrors.explanation.message}
              </p>
            )}
          </div>

          <QuestionOptions
            questionIndex={index}
            control={control}
            register={register}
            setValue={setValue}
            watch={watch}
            errors={errors}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export function QuizBuilder({ lessonId }: QuizBuilderProps) {
  const api = useApi();
  const [quizId, setQuizId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [numberOfQuestions, setNumberOfQuestions] = useState(5);
  const [showPreview, setShowPreview] = useState(false);

  const form = useForm<QuizFormValues>({
    resolver: zodResolver(quizBuilderSchema),
    defaultValues,
  });
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = form;
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "questions",
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const loadQuiz = useCallback(async () => {
    setIsLoading(true);
    const res = await api.get<QuizResponse>(`/api/lessons/${lessonId}/quiz`);

    if (res.success && res.data) {
      setQuizId(res.data.id);
      reset(toFormValues(res.data));
    } else {
      setQuizId(null);
      reset(defaultValues);
    }

    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, reset]);

  useEffect(() => {
    void loadQuiz();
  }, [loadQuiz]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = fields.findIndex((field) => field.id === active.id);
    const newIndex = fields.findIndex((field) => field.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    move(oldIndex, newIndex);
  }

  async function onSubmit(values: QuizFormValues) {
    setIsSubmitting(true);
    const toastId = toast.loading(
      quizId ? "Đang cập nhật Quiz..." : "Đang tạo Quiz...",
    );
    const payload = normalizePayload(values);
    const res = quizId
      ? await api.patch<QuizResponse>(`/api/lessons/${lessonId}/quiz`, payload)
      : await api.post<QuizResponse>(`/api/lessons/${lessonId}/quiz`, payload);

    if (res.success && res.data) {
      setQuizId(res.data.id);
      reset(toFormValues(res.data));
      toast.success(quizId ? "Đã cập nhật Quiz." : "Đã tạo Quiz.", {
        id: toastId,
      });
    } else {
      toast.error(
        res.error ??
          res.message ??
          "Không thể lưu Quiz. Hãy đảm bảo loại bài học đã được lưu là Quiz.",
        { id: toastId },
      );
    }

    setIsSubmitting(false);
  }

  async function handleGenerateWithAI() {
    const requestedCount = Math.min(Math.max(numberOfQuestions, 1), 20);
    setIsGenerating(true);
    const toastId = toast.loading("Đang tạo câu hỏi bằng AI...");

    const res = await api.post<QuizCreateInput["questions"]>(
      `/api/lessons/${lessonId}/quiz/generate`,
      { numberOfQuestions: requestedCount },
    );

    if (res.success && res.data) {
      append(
        res.data.map((question) => ({
          questionText: question.questionText,
          points: question.points,
          explanation: question.explanation ?? "",
          options: question.options.map((option) => ({
            optionText: option.optionText,
            isCorrect: option.isCorrect,
          })),
        })),
      );
      toast.success(`Đã tạo ${res.data.length} câu hỏi.`, { id: toastId });
      setIsGenerateOpen(false);
    } else {
      toast.error(
        res.error ??
          res.message ??
          "Không thể tạo câu hỏi. Bạn vẫn có thể tạo thủ công.",
        { id: toastId },
      );
    }

    setIsGenerating(false);
  }

  if (isLoading) {
    return (
      <Card className="border-slate-200">
        <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin text-sky-500" />
          Đang tải trình tạo Quiz...
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <Card className="border-slate-200 bg-slate-50/50">
        <CardHeader>
          <CardTitle>Cài đặt Quiz</CardTitle>
          <CardDescription>
            Cấu hình số lượt làm, ngưỡng đạt và hạn nộp tùy chọn.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Số lượt làm tối đa</Label>
            <Input
              type="number"
              min={1}
              max={100}
              {...register("maxAttempts", { valueAsNumber: true })}
            />
            {errors.maxAttempts?.message && (
              <p className="text-xs text-red-500">
                {errors.maxAttempts.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Điểm đạt</Label>
            <Input
              type="number"
              min={0}
              max={1}
              step={0.01}
              {...register("passingScore", { valueAsNumber: true })}
            />
            <p className="text-xs text-slate-400">
              Dùng dạng thập phân, ví dụ 0.7 tương ứng 70%.
            </p>
            {errors.passingScore?.message && (
              <p className="text-xs text-red-500">
                {errors.passingScore.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Hạn nộp</Label>
            <Controller
              name="dueDate"
              control={control}
              render={({ field }) => (
                <DatePicker value={field.value} onChange={field.onChange} />
              )}
            />
            {errors.dueDate?.message && (
              <p className="text-xs text-red-500">{errors.dueDate.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Câu hỏi</h3>
          <p className="text-xs text-slate-500">
            Kéo câu hỏi để sắp xếp. Mỗi câu hỏi phải có đúng một đáp án đúng.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Popover open={isGenerateOpen} onOpenChange={setIsGenerateOpen}>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  size="sm"
                  disabled={isGenerating}
                  className="gap-1.5 rounded-lg bg-linear-to-r from-violet-600 via-indigo-500 to-sky-500 text-white shadow-sm shadow-indigo-200 hover:from-violet-700 hover:via-indigo-600 hover:to-sky-600"
                />
              }
            >
              {isGenerating ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} />
              )}
              {isGenerating ? "Đang tạo..." : "Tạo bằng AI"}
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">
                  Tạo câu hỏi bằng AI
                </h4>
                <p className="mt-1 text-xs text-slate-500">
                  Gemini sẽ dùng nội dung bài học và tài liệu khóa học đã đồng
                  bộ.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ai-question-count">Số lượng câu hỏi</Label>
                <Input
                  id="ai-question-count"
                  type="number"
                  min={1}
                  max={20}
                  value={numberOfQuestions}
                  disabled={isGenerating}
                  onChange={(event) =>
                    setNumberOfQuestions(Number(event.target.value) || 5)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleGenerateWithAI();
                    }
                  }}
                />
                <p className="text-xs text-slate-400">
                  Mặc định là 5. Bạn có thể chỉnh sửa từng câu hỏi trước khi
                  lưu.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isGenerating}
                  onClick={() => setIsGenerateOpen(false)}
                >
                  Hủy
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isGenerating}
                  onClick={() => void handleGenerateWithAI()}
                  className="gap-1.5 bg-violet-600 text-white hover:bg-violet-700"
                >
                  {isGenerating ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  Tạo
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append(emptyQuestion())}
            className="gap-1.5 rounded-lg"
          >
            <Plus size={14} />
            Thêm câu hỏi
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={fields.map((field) => field.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-4">
            {fields.map((field, index) => (
              <SortableQuestionCard
                key={field.id}
                field={field}
                index={index}
                control={control}
                register={register}
                setValue={setValue}
                watch={watch}
                errors={errors}
                canRemove={fields.length > 1}
                onRemove={() => remove(index)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {typeof errors.questions?.message === "string" && (
        <p className="text-xs text-red-500">{errors.questions.message}</p>
      )}

      <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
        {quizId && (
          <div className="mr-auto flex items-center gap-1.5 text-xs text-emerald-600">
            <CheckCircle2 size={14} />
            Đã lưu Quiz
          </div>
        )}
        {isDirty && (
          <span className="text-xs text-slate-400">Có thay đổi chưa lưu</span>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowPreview((value) => !value)}
          className="rounded-lg"
        >
          {showPreview ? "Ẩn xem trước" : "Xem trước Quiz"}
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="gap-2 bg-sky-500 text-white hover:bg-sky-600"
        >
          {isSubmitting ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Save size={15} />
          )}
          {quizId ? "Lưu Quiz" : "Tạo Quiz"}
        </Button>
      </div>

      {showPreview && (
        <Card className="border-sky-100 bg-sky-50/40">
          <CardHeader>
            <CardTitle>Xem trước cho sinh viên</CardTitle>
            <CardDescription>
              Bản xem trước dùng dữ liệu hiện tại và không hiển thị đáp án đúng.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {watch("questions").map((question, questionIndex) => (
              <div
                key={`${question.questionText}-${questionIndex}`}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h4 className="text-sm font-semibold text-slate-900">
                    {questionIndex + 1}.{" "}
                    {question.questionText || "Câu hỏi chưa đặt tên"}
                  </h4>
                  <Badge variant="outline" className="rounded-md">
                    {question.points || 0} điểm
                  </Badge>
                </div>
                <div className="space-y-2">
                  {question.options.map((option, optionIndex) => (
                    <label
                      key={`${option.optionText}-${optionIndex}`}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                    >
                      <span className="size-3.5 rounded-full border border-slate-300" />
                      {option.optionText || `Lựa chọn ${optionIndex + 1}`}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </form>
  );
}
