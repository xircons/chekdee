"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

const registrationSchema = z.object({
  first_name: z.string().trim().min(1, "กรุณาระบุชื่อ"),
  last_name: z.string().trim().min(1, "กรุณาระบุนามสกุล"),
  student_gen: z.string().trim().min(1, "กรุณาระบุรุ่นนักศึกษา"),
});

type RegistrationForm = z.infer<typeof registrationSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
    }
  }, [router]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegistrationForm>({
    resolver: zodResolver(registrationSchema),
  });

  const onSubmit = async (values: RegistrationForm) => {
    setSubmitError(null);

    const res = await apiFetch("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      setSubmitError("ไม่สามารถลงทะเบียนได้ กรุณาลองใหม่อีกครั้ง");
      return;
    }

    router.replace("/");
  };

  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm rounded-2xl border border-slate-200 shadow-md ring-0">
        <CardHeader>
          <CardTitle className="text-xl">กรอกข้อมูลโปรไฟล์ให้ครบถ้วน</CardTitle>
          <p className="text-sm text-muted-foreground">
            จำเป็นต้องกรอกก่อนจึงจะบันทึกเวลาเข้างานได้
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="first_name">ชื่อ</Label>
              <Input id="first_name" {...register("first_name")} />
              {errors.first_name && (
                <p className="text-xs text-danger-foreground">{errors.first_name.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="last_name">นามสกุล</Label>
              <Input id="last_name" {...register("last_name")} />
              {errors.last_name && (
                <p className="text-xs text-danger-foreground">{errors.last_name.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="student_gen">รุ่นนักศึกษา</Label>
              <Input id="student_gen" placeholder="เช่น 2026" {...register("student_gen")} />
              {errors.student_gen && (
                <p className="text-xs text-danger-foreground">{errors.student_gen.message}</p>
              )}
            </div>

            {submitError && <p className="text-xs text-danger-foreground">{submitError}</p>}

            <Button type="submit" disabled={isSubmitting} className="mt-2 w-full">
              {isSubmitting ? "กำลังบันทึก…" : "ดำเนินการต่อ"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
