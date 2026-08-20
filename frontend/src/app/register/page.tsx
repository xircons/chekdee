"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { FIELD_CLASS } from "@/lib/admin-ui";

// student_gen is a generation ordinal (which admission cohort), not a
// calendar year — these are the only valid values, per the backend.
const STUDENT_GENERATIONS = ["6", "7", "8", "9"] as const;

const registrationSchema = z.object({
  first_name: z.string().trim().min(1, "กรุณาระบุชื่อ"),
  last_name: z.string().trim().min(1, "กรุณาระบุนามสกุล"),
  student_gen: z.enum(STUDENT_GENERATIONS, { message: "กรุณาเลือกรุ่นนักศึกษา" }),
  // Optional, matching the backend keeping them optional — first_name/
  // last_name/student_gen stay the only required trio (see
  // completeRegistrationRequest on the backend).
  student_id: z.string().trim().optional(),
  phone_number: z.string().trim().optional(),
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
    control,
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
              <Input id="first_name" className={FIELD_CLASS} {...register("first_name")} />
              {errors.first_name && (
                <p className="text-xs text-danger-foreground">{errors.first_name.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="last_name">นามสกุล</Label>
              <Input id="last_name" className={FIELD_CLASS} {...register("last_name")} />
              {errors.last_name && (
                <p className="text-xs text-danger-foreground">{errors.last_name.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              {/* No htmlFor — SelectTrigger isn't a native input, and a
                  native label->id click gets forwarded to it as a real
                  click (same reasoning as admin/employees/page.tsx's role
                  select). */}
              <Label>รุ่นนักศึกษา</Label>
              <Controller
                name="student_gen"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="student_gen" className={`w-full ${FIELD_CLASS} data-[size=default]:h-9`}>
                      <SelectValue placeholder="เลือกรุ่นนักศึกษา">
                        {(value: string | null) => value ?? "เลือกรุ่นนักศึกษา"}
                      </SelectValue>
                    </SelectTrigger>
                    {/* alignItemWithTrigger off + sideOffset: same
                        positioning fix as admin/employees/page.tsx's role
                        select — anchors the list under the trigger instead
                        of centering on the selected item and drifting. */}
                    <SelectContent alignItemWithTrigger={false} sideOffset={4}>
                      {STUDENT_GENERATIONS.map((gen) => (
                        <SelectItem key={gen} value={gen}>
                          {gen}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.student_gen && (
                <p className="text-xs text-danger-foreground">{errors.student_gen.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="student_id">รหัสนักศึกษา</Label>
              <Input id="student_id" className={FIELD_CLASS} {...register("student_id")} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone_number">เบอร์โทร</Label>
              <Input id="phone_number" className={FIELD_CLASS} {...register("phone_number")} />
            </div>

            {submitError && <p className="text-xs text-danger-foreground">{submitError}</p>}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 w-full bg-accent-600 text-white hover:bg-accent-700"
            >
              {isSubmitting ? "กำลังบันทึก…" : "ดำเนินการต่อ"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
