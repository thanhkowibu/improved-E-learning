"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Lock, UserRound } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const NONE_VALUE = "Không công khai";

const profileSchema = z.object({
  avatarUrl: z
    .string()
    .optional()
    .refine((value) => {
      if (!value) return true;
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    }, "URL ảnh đại diện không hợp lệ."),
  fullName: z
    .string()
    .min(2, "Họ và tên phải có ít nhất 2 ký tự.")
    .max(150, "Họ và tên tối đa 150 ký tự."),
  phoneNumber: z.string().max(30, "Số điện thoại tối đa 30 ký tự.").optional(),
  gender: z.enum(["Nam", "Nữ", "Khác", NONE_VALUE]).optional(),
  birthYear: z
    .string()
    .optional()
    .refine((value) => {
      if (!value) return true;
      const year = Number(value);
      return (
        Number.isInteger(year) &&
        year >= 1900 &&
        year <= new Date().getFullYear()
      );
    }, "Năm sinh không hợp lệ."),
  highestEducation: z
    .enum(["Cử nhân", "Thạc sĩ", "Tiến sĩ", "Khác", NONE_VALUE])
    .optional(),
  bio: z.string().max(1000, "Giới thiệu tối đa 1000 ký tự.").optional(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Vui lòng nhập mật khẩu hiện tại."),
    newPassword: z.string().min(8, "Mật khẩu mới phải có ít nhất 8 ký tự."),
    confirmPassword: z.string().min(1, "Vui lòng xác nhận mật khẩu mới."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Mật khẩu xác nhận không khớp.",
  });

type ProfileFormValues = z.infer<typeof profileSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

interface UserProfile {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  phoneNumber: string | null;
  gender: string | null;
  birthYear: number | null;
  highestEducation: string | null;
  bio: string | null;
}

interface FieldRowProps {
  label: string;
  description: string;
  error?: string;
  children: React.ReactNode;
}

function getAuthHeaders(): HeadersInit {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("lms_auth_token")
      : null;

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parseApiResponse<T>(res: Response): Promise<{
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}> {
  const text = await res.text();
  return text ? JSON.parse(text) : { success: res.ok };
}

function FieldRow({ label, description, error, children }: FieldRowProps) {
  return (
    <div className="grid gap-3 border-b border-slate-100 py-5 lg:grid-cols-[220px_minmax(0,1fr)_minmax(260px,0.9fr)] lg:items-start lg:gap-10">
      <label className="pt-2 text-sm font-bold text-slate-900">{label}</label>
      <div className="min-w-0 space-y-1.5">
        {children}
        {error && <p className="text-xs font-medium text-red-500">{error}</p>}
      </div>
      <p className="pt-2 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="container mx-auto max-w-7xl px-6 py-8 md:px-24">
      <div className="mb-10 space-y-3">
        <Skeleton className="h-9 w-72 rounded-lg" />
        <Skeleton className="h-5 w-full max-w-lg rounded-lg" />
      </div>
      <div className="mb-8 flex gap-8 border-b border-slate-200 pb-3">
        <Skeleton className="h-6 w-36 rounded-lg" />
        <Skeleton className="h-6 w-24 rounded-lg" />
      </div>
      <div className="mb-8 space-y-3">
        <Skeleton className="h-8 w-72 rounded-lg" />
        <Skeleton className="h-5 w-full max-w-md rounded-lg" />
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="grid gap-3 py-5 lg:grid-cols-[220px_minmax(0,1fr)_minmax(260px,0.9fr)] lg:gap-10"
          >
            <Skeleton className="h-5 w-32 rounded-lg" />
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-5 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading, refreshUser } = useAuth();
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      avatarUrl: "",
      fullName: "",
      phoneNumber: "",
      gender: NONE_VALUE,
      birthYear: "",
      highestEducation: NONE_VALUE,
      bio: "",
    },
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const profileEndpoint = useMemo(
    () => (user ? `/api/users/${user.id}` : null),
    [user],
  );

  useEffect(() => {
    if (isAuthLoading) return;
    if (!user || !profileEndpoint) {
      setIsLoadingProfile(false);
      return;
    }

    let isCancelled = false;

    async function loadProfile() {
      setIsLoadingProfile(true);
      try {
        const res = await fetch(profileEndpoint as string, {
          headers: getAuthHeaders(),
        });
        const json = await parseApiResponse<UserProfile>(res);

        if (!res.ok || !json.success || !json.data) {
          throw new Error(json.message ?? "Không thể tải hồ sơ.");
        }

        if (isCancelled) return;

        profileForm.reset({
          avatarUrl: json.data.avatarUrl ?? "",
          fullName: json.data.fullName,
          phoneNumber: json.data.phoneNumber ?? "",
          gender:
            (json.data.gender as ProfileFormValues["gender"]) ?? NONE_VALUE,
          birthYear: json.data.birthYear ? String(json.data.birthYear) : "",
          highestEducation:
            (json.data
              .highestEducation as ProfileFormValues["highestEducation"]) ??
            NONE_VALUE,
          bio: json.data.bio ?? "",
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Không thể tải hồ sơ.",
        );
      } finally {
        if (!isCancelled) setIsLoadingProfile(false);
      }
    }

    void loadProfile();

    return () => {
      isCancelled = true;
    };
  }, [isAuthLoading, user, profileEndpoint, profileForm]);

  async function onProfileSubmit(values: ProfileFormValues) {
    if (!profileEndpoint) return;

    setIsSavingProfile(true);
    const toastId = toast.loading("Đang cập nhật hồ sơ...");

    const payload = {
      avatarUrl: values.avatarUrl?.trim() || null,
      fullName: values.fullName,
      phoneNumber: values.phoneNumber?.trim() || null,
      gender: values.gender === NONE_VALUE ? null : values.gender,
      birthYear: values.birthYear ? Number(values.birthYear) : null,
      highestEducation:
        values.highestEducation === NONE_VALUE ? null : values.highestEducation,
      bio: values.bio?.trim() || null,
    };

    try {
      const res = await fetch(profileEndpoint, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const json = await parseApiResponse<UserProfile>(res);

      if (!res.ok || !json.success) {
        throw new Error(json.message ?? "Không thể cập nhật hồ sơ.");
      }

      await refreshUser();
      toast.success("Cập nhật hồ sơ thành công!", { id: toastId });
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không thể cập nhật hồ sơ.",
        { id: toastId },
      );
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function onPasswordSubmit(values: PasswordFormValues) {
    if (!profileEndpoint) return;

    setIsSavingPassword(true);
    const toastId = toast.loading("Đang đổi mật khẩu...");

    try {
      const res = await fetch(profileEndpoint, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      });
      const json = await parseApiResponse<UserProfile>(res);

      if (!res.ok || !json.success) {
        throw new Error(json.message ?? "Không thể đổi mật khẩu.");
      }

      passwordForm.reset();
      toast.success("Đổi mật khẩu thành công!", { id: toastId });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không thể đổi mật khẩu.",
        { id: toastId },
      );
    } finally {
      setIsSavingPassword(false);
    }
  }

  if (isAuthLoading || isLoadingProfile) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="container mx-auto max-w-7xl px-6 py-8 md:px-24">
      <div className="mb-16">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Thiết lập tài khoản
        </h1>
        <p className="mt-1 text-base text-slate-500">
          Quản lý hồ sơ công khai, thông tin liên hệ và bảo mật tài khoản của
          bạn.
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-8">
        <TabsList
          variant="line"
          className="w-full justify-start gap-8 rounded-none font-semibold"
        >
          <TabsTrigger
            value="profile"
            className="gap-2 px-0 text-base after:bg-sky-500 data-active:text-sky-600"
          >
            <UserRound size={16} />
            Thông tin cá nhân
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="gap-2 px-0 text-base after:bg-sky-500 data-active:text-sky-600"
          >
            <Lock size={16} />
            Bảo mật
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <form onSubmit={profileForm.handleSubmit(onProfileSubmit)}>
            <div className="mb-8">
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
                Thông tin tài khoản cơ bản
              </h2>
              <p className="mt-2 text-base text-slate-500">
                Những thông tin này giúp hồ sơ và chứng chỉ của bạn hiển thị
                chính xác hơn.
              </p>
            </div>

            <div>
              <FieldRow
                label="Ảnh đại diện"
                description="Dán URL ảnh đại diện công khai. Ảnh này sẽ xuất hiện trên hồ sơ của bạn."
                error={profileForm.formState.errors.avatarUrl?.message}
              >
                <Input
                  type="url"
                  placeholder="https://example.com/avatar.jpg"
                  {...profileForm.register("avatarUrl")}
                />
              </FieldRow>

              <FieldRow
                label="Họ và tên"
                description="Tên được hiển thị trên hồ sơ, lớp học và chứng chỉ của bạn."
                error={profileForm.formState.errors.fullName?.message}
              >
                <Input {...profileForm.register("fullName")} />
              </FieldRow>

              <FieldRow
                label="Số điện thoại"
                description="Số điện thoại chỉ dùng để hỗ trợ liên hệ khi cần thiết."
                error={profileForm.formState.errors.phoneNumber?.message}
              >
                <Input {...profileForm.register("phoneNumber")} />
              </FieldRow>

              <FieldRow
                label="Giới tính"
                description="Bạn có thể chọn không công khai nếu không muốn hiển thị thông tin này."
              >
                <Controller
                  control={profileForm.control}
                  name="gender"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? NONE_VALUE}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>
                          Không công khai
                        </SelectItem>
                        <SelectItem value="Nam">Nam</SelectItem>
                        <SelectItem value="Nữ">Nữ</SelectItem>
                        <SelectItem value="Khác">Khác</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </FieldRow>

              <FieldRow
                label="Năm sinh"
                description="Năm sinh giúp cá nhân hóa trải nghiệm học tập nhưng không bắt buộc."
                error={profileForm.formState.errors.birthYear?.message}
              >
                <Input
                  inputMode="numeric"
                  placeholder="Ví dụ: 2002"
                  {...profileForm.register("birthYear")}
                />
              </FieldRow>

              <FieldRow
                label="Học vấn cao nhất"
                description="Thông tin này sẽ xuất hiện trên hồ sơ công khai nếu bạn chọn cung cấp."
              >
                <Controller
                  control={profileForm.control}
                  name="highestEducation"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? NONE_VALUE}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>
                          Không công khai
                        </SelectItem>
                        <SelectItem value="Cử nhân">Cử nhân</SelectItem>
                        <SelectItem value="Thạc sĩ">Thạc sĩ</SelectItem>
                        <SelectItem value="Tiến sĩ">Tiến sĩ</SelectItem>
                        <SelectItem value="Khác">Khác</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </FieldRow>

              <FieldRow
                label="Giới thiệu"
                description="Viết ngắn gọn về kinh nghiệm, mục tiêu học tập hoặc lĩnh vực bạn quan tâm."
                error={profileForm.formState.errors.bio?.message}
              >
                <Textarea
                  rows={6}
                  placeholder="Chia sẻ vài dòng về bạn..."
                  {...profileForm.register("bio")}
                />
              </FieldRow>
            </div>

            <div className="flex justify-end pt-6">
              <Button
                type="submit"
                disabled={isSavingProfile}
                className="gap-2 rounded-xl bg-sky-500 px-6 font-semibold text-white hover:bg-sky-600"
              >
                {isSavingProfile && (
                  <Loader2 size={15} className="animate-spin" />
                )}
                Lưu thay đổi
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="security">
          <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}>
            <div className="mb-8">
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
                Bảo mật tài khoản
              </h2>
              <p className="mt-2 text-base text-slate-500">
                Cập nhật mật khẩu định kỳ để bảo vệ tài khoản học tập của bạn.
              </p>
            </div>

            <div>
              <FieldRow
                label="Mật khẩu hiện tại"
                description="Nhập mật khẩu bạn đang sử dụng để xác minh quyền thay đổi."
                error={passwordForm.formState.errors.currentPassword?.message}
              >
                <Input
                  type="password"
                  autoComplete="current-password"
                  {...passwordForm.register("currentPassword")}
                />
              </FieldRow>

              <FieldRow
                label="Mật khẩu mới"
                description="Mật khẩu mới nên có ít nhất 8 ký tự và không trùng với mật khẩu cũ."
                error={passwordForm.formState.errors.newPassword?.message}
              >
                <Input
                  type="password"
                  autoComplete="new-password"
                  {...passwordForm.register("newPassword")}
                />
              </FieldRow>

              <FieldRow
                label="Xác nhận mật khẩu"
                description="Nhập lại mật khẩu mới để tránh sai sót khi cập nhật."
                error={passwordForm.formState.errors.confirmPassword?.message}
              >
                <Input
                  type="password"
                  autoComplete="new-password"
                  {...passwordForm.register("confirmPassword")}
                />
              </FieldRow>
            </div>

            <div className="flex justify-end pt-6">
              <Button
                type="submit"
                disabled={isSavingPassword}
                className="gap-2 rounded-xl bg-sky-500 px-6 font-semibold text-white hover:bg-sky-600"
              >
                {isSavingPassword && (
                  <Loader2 size={15} className="animate-spin" />
                )}
                Cập nhật mật khẩu
              </Button>
            </div>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
