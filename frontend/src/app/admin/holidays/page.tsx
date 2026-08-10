"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Badge } from "@/components/ui/badge";
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

const holidaySchema = z.object({
  date: z.string().min(1, "Date is required"),
  name: z.string().trim().min(1, "Name is required"),
  localName: z.string().trim().optional(),
});

type HolidayForm = z.infer<typeof holidaySchema>;

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

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
        <Label htmlFor="date">Date</Label>
        <Input id="date" type="date" {...register("date")} />
        {errors.date && <p className="text-xs text-danger-foreground">{errors.date.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" placeholder="e.g. CAMT Foundation Day" {...register("name")} />
        {errors.name && <p className="text-xs text-danger-foreground">{errors.name.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="localName">Local name (optional)</Label>
        <Input id="localName" placeholder="e.g. วันคล้ายวันก่อตั้ง CAMT" {...register("localName")} />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<MockHoliday[]>(mockHolidays);
  const [formOpen, setFormOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<MockHoliday | null>(null);
  const [removeTarget, setRemoveTarget] = useState<MockHoliday | null>(null);

  const sortedHolidays = [...holidays].sort((a, b) => a.date.localeCompare(b.date));

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
    <main className="flex flex-1 flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold text-foreground">Holidays</h1>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Company calendar</CardTitle>
          <CardAction>
            <Button size="sm" onClick={openCreateForm}>
              Add holiday
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Local name</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedHolidays.map((holiday) => (
                <TableRow key={holiday.id}>
                  <TableCell className="font-medium text-foreground">
                    {formatDate(holiday.date)}
                  </TableCell>
                  <TableCell>{holiday.name}</TableCell>
                  <TableCell>{holiday.localName ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={holiday.source === "manual" ? "secondary" : "outline"}>
                      {holiday.source === "manual" ? "Manual" : "Nager.Date"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEditForm(holiday)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setRemoveTarget(holiday)}
                      >
                        Remove
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingHoliday ? "Edit holiday" : "Add holiday"}</DialogTitle>
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
            <AlertDialogTitle>Remove {removeTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the holiday from the company calendar. This can&apos;t be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmRemove}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
