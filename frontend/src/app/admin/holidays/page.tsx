"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Trash2 } from "lucide-react";
import { z } from "zod";

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
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { mockHolidays, type MockHoliday } from "@/lib/mock-data";
import { cn, formatThaiDate, parseIsoDateLocal } from "@/lib/utils";

// Shared field/button sizing used across the admin shell (Employees/Schedules).
const FIELD_CLASS =
  "h-9 rounded-lg border-border bg-muted/40 px-4 text-sm focus-visible:border-brand-600 focus-visible:bg-card focus-visible:ring-brand-600/20";
const ACTION_BUTTON_CLASS = "h-9 rounded-lg px-5 text-sm focus-visible:ring-brand-600/20";

function toIsoDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const holidaySchema = z.object({
  date: z.string().min(1, "กรุณาระบุวันที่"),
  name: z.string().trim().min(1, "กรุณากรอกชื่อ"),
  localName: z.string().trim().optional(),
});

type HolidayForm = z.infer<typeof holidaySchema>;

function HolidayFormFields({
  defaultValues,
  onSubmit,
  onCancel,
}: {
  defaultValues: HolidayForm;
  onSubmit: (values: HolidayForm) => void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<HolidayForm>({
    resolver: zodResolver(holidaySchema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="date">วันที่</Label>
        <Input id="date" type="date" className={FIELD_CLASS} {...register("date")} />
        {errors.date && <p className="text-xs text-danger-foreground">{errors.date.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">ชื่อ</Label>
        <Input id="name" placeholder="เช่น New Year's Day" className={FIELD_CLASS} {...register("name")} />
        {errors.name && <p className="text-xs text-danger-foreground">{errors.name.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="localName">ชื่อท้องถิ่น (ถ้ามี)</Label>
        <Input
          id="localName"
          placeholder="เช่น วันขึ้นปีใหม่"
          className={FIELD_CLASS}
          {...register("localName")}
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" className={ACTION_BUTTON_CLASS} onClick={onCancel}>
          ยกเลิก
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className={cn(ACTION_BUTTON_CLASS, "bg-accent-600 text-white hover:bg-accent-700")}
        >
          {isSubmitting ? "กำลังบันทึก..." : "บันทึก"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function HolidayTable({
  holidays,
  onEdit,
  onRemove,
}: {
  holidays: MockHoliday[];
  onEdit: (holiday: MockHoliday) => void;
  onRemove: (holiday: MockHoliday) => void;
}) {
  // table-fixed + matching widths on every column, so the กำลังจะถึง and
  // ผ่านมาแล้ว tables (two separate <table> elements) line up column-for-
  // column instead of each auto-sizing to its own content.
  return (
    <Table className="table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[18%]">วันที่</TableHead>
          <TableHead className="w-[27%]">ชื่อ</TableHead>
          <TableHead className="w-[25%]">ชื่อท้องถิ่น</TableHead>
          <TableHead className="w-[15%]">ที่มา</TableHead>
          <TableHead className="w-[15%] text-center">จัดการ</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {holidays.map((holiday) => (
          <TableRow key={holiday.id}>
            <TableCell className="font-medium text-foreground">
              {formatThaiDate(parseIsoDateLocal(holiday.date))}
            </TableCell>
            <TableCell className="truncate">{holiday.name}</TableCell>
            <TableCell className="truncate">{holiday.localName ?? "—"}</TableCell>
            <TableCell>
              {/* Plain colored text, not Badge — Badge is rounded-4xl (a pill,
                  conflicts with the no-rounded-full rule) and its default
                  fill conflicts with the white-surface preference here. */}
              <span
                className={
                  holiday.source === "manual"
                    ? "font-medium text-brand-600"
                    : "font-medium text-muted-foreground"
                }
              >
                {holiday.source === "manual" ? "เพิ่มเอง" : "อัตโนมัติ"}
              </span>
            </TableCell>
            <TableCell className="text-center">
              <div className="flex justify-center gap-1">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Edit"
                  className="text-muted-foreground"
                  onClick={() => onEdit(holiday)}
                >
                  <Pencil />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Remove"
                  className="text-muted-foreground hover:bg-danger hover:text-danger-foreground"
                  onClick={() => onRemove(holiday)}
                >
                  <Trash2 />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<MockHoliday[]>(mockHolidays);
  const [formOpen, setFormOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<MockHoliday | null>(null);
  const [removeTarget, setRemoveTarget] = useState<MockHoliday | null>(null);

  const sortedHolidays = [...holidays].sort((a, b) => a.date.localeCompare(b.date));
  const todayIso = toIsoDateLocal(new Date());
  const upcomingHolidays = sortedHolidays.filter((h) => h.date >= todayIso);
  const pastHolidays = sortedHolidays.filter((h) => h.date < todayIso);

  const openCreateForm = () => {
    setEditingHoliday(null);
    setFormOpen(true);
  };

  const openEditForm = (holiday: MockHoliday) => {
    setEditingHoliday(holiday);
    setFormOpen(true);
  };

  const handleSubmit = (values: HolidayForm) => {
    if (editingHoliday) {
      setHolidays((prev) =>
        prev.map((h) =>
          h.id === editingHoliday.id
            ? { ...h, date: values.date, name: values.name, localName: values.localName || null }
            : h
        )
      );
    } else {
      const newHoliday: MockHoliday = {
        id: crypto.randomUUID(),
        date: values.date,
        name: values.name,
        localName: values.localName || null,
        source: "manual",
      };
      setHolidays((prev) => [...prev, newHoliday]);
    }
    setFormOpen(false);
  };

  const confirmRemove = () => {
    if (!removeTarget) return;
    setHolidays((prev) => prev.filter((h) => h.id !== removeTarget.id));
    setRemoveTarget(null);
  };

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 pb-6">
      <header className="relative shrink-0 overflow-hidden rounded-b-[20px] bg-brand-600 px-6 py-6 text-white">
        <div className="absolute top-0 right-0 size-40 -translate-y-1/3 translate-x-1/4 rounded-full bg-white/10" />
        <div className="relative">
          <h1 className="text-2xl font-bold">วันหยุด</h1>
          <p className="mt-1 text-sm text-white/80">ปฏิทินวันหยุดบริษัท</p>
        </div>
      </header>

      <Card className="rounded-2xl border border-slate-200 ring-0">
        <CardHeader>
          <CardTitle>รายการวันหยุด</CardTitle>
          <CardAction>
            <Button
              className={cn(ACTION_BUTTON_CLASS, "bg-accent-600 text-white hover:bg-accent-700")}
              onClick={openCreateForm}
            >
              เพิ่มวันหยุด
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {upcomingHolidays.length > 0 && (
            <>
              <p className="text-xs font-semibold text-muted-foreground">กำลังจะถึง</p>
              <div className="mt-2">
                <HolidayTable holidays={upcomingHolidays} onEdit={openEditForm} onRemove={setRemoveTarget} />
              </div>
            </>
          )}

          {pastHolidays.length > 0 && (
            <>
              <p
                className={cn(
                  "text-xs font-semibold text-muted-foreground",
                  upcomingHolidays.length > 0 && "mt-6"
                )}
              >
                ผ่านมาแล้ว
              </p>
              <div className="mt-2">
                <HolidayTable holidays={pastHolidays} onEdit={openEditForm} onRemove={setRemoveTarget} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingHoliday ? "แก้ไขวันหยุด" : "เพิ่มวันหยุด"}</DialogTitle>
          </DialogHeader>
          {formOpen && (
            <HolidayFormFields
              defaultValues={{
                date: editingHoliday?.date ?? "",
                name: editingHoliday?.name ?? "",
                localName: editingHoliday?.localName ?? "",
              }}
              onSubmit={handleSubmit}
              onCancel={() => setFormOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบ {removeTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              การดำเนินการนี้จะลบวันหยุดออกจากปฏิทินบริษัท และไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmRemove}>
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
