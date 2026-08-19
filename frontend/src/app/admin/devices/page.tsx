"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy, RefreshCw, Trash2 } from "lucide-react";
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
import { mockKioskDevices, type MockKioskDevice } from "@/lib/mock-data";
import { cn, formatThaiDate } from "@/lib/utils";

const FIELD_CLASS =
  "h-9 rounded-lg border-border bg-muted/40 px-4 text-sm focus-visible:border-brand-600 focus-visible:bg-card focus-visible:ring-brand-600/20";
const ACTION_BUTTON_CLASS = "h-9 rounded-lg px-5 text-sm focus-visible:ring-brand-600/20";

// Only the last 4 characters ever render — the full token/URL is shown
// once, right after creation, and never again after that dialog closes.
function maskToken(token: string): string {
  return token.length <= 4 ? "••••" : `••••••••${token.slice(-4)}`;
}

function buildKioskUrl(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/kiosk/lobby-tv?token=${token}`;
}

const deviceSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่ออุปกรณ์"),
  location: z.string().trim().min(1, "กรุณากรอกสถานที่"),
});

type DeviceForm = z.infer<typeof deviceSchema>;

function DeviceFormFields({
  onSubmit,
  onCancel,
}: {
  onSubmit: (values: DeviceForm) => void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DeviceForm>({
    resolver: zodResolver(deviceSchema),
    defaultValues: { name: "", location: "" },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">ชื่ออุปกรณ์</Label>
        <Input id="name" placeholder="เช่น จอ Lobby ชั้น 1" className={FIELD_CLASS} {...register("name")} />
        {errors.name && <p className="text-xs text-danger-foreground">{errors.name.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="location">สถานที่</Label>
        <Input
          id="location"
          placeholder="เช่น อาคาร CAMT ชั้น 1"
          className={FIELD_CLASS}
          {...register("location")}
        />
        {errors.location && <p className="text-xs text-danger-foreground">{errors.location.message}</p>}
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
          {isSubmitting ? "กำลังสร้าง..." : "สร้างอุปกรณ์"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<MockKioskDevice[]>(mockKioskDevices);
  const [formOpen, setFormOpen] = useState(false);
  const [revealDevice, setRevealDevice] = useState<MockKioskDevice | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<MockKioskDevice | null>(null);
  const [rotateTarget, setRotateTarget] = useState<MockKioskDevice | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyLink = (device: MockKioskDevice) => {
    void navigator.clipboard.writeText(buildKioskUrl(device.tokenHash));
    setCopiedId(device.id);
    setTimeout(() => setCopiedId((id) => (id === device.id ? null : id)), 1500);
  };

  const handleCreate = (values: DeviceForm) => {
    const newDevice: MockKioskDevice = {
      id: crypto.randomUUID(),
      name: values.name,
      location: values.location,
      tokenHash: crypto.randomUUID().replace(/-/g, ""),
      createdAt: new Date().toISOString(),
      revokedAt: null,
    };
    setDevices((prev) => [newDevice, ...prev]);
    setFormOpen(false);
    setRevealDevice(newDevice);
  };

  const confirmRevoke = () => {
    if (!revokeTarget) return;
    setDevices((prev) =>
      prev.map((d) => (d.id === revokeTarget.id ? { ...d, revokedAt: new Date().toISOString() } : d))
    );
    setRevokeTarget(null);
  };

  // Invalidates the current token and issues a new one — name/location/
  // createdAt are untouched, only tokenHash changes. Cheaper than
  // revoke-and-recreate for a leaked-token scenario.
  const confirmRotate = () => {
    if (!rotateTarget) return;
    const rotated: MockKioskDevice = { ...rotateTarget, tokenHash: crypto.randomUUID().replace(/-/g, "") };
    setDevices((prev) => prev.map((d) => (d.id === rotateTarget.id ? rotated : d)));
    setRotateTarget(null);
    setRevealDevice(rotated);
  };

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 pb-6">
      <header className="rounded-b-[20px] bg-brand-600 px-6 py-6 text-white">
        <h1 className="text-2xl font-bold">อุปกรณ์</h1>
        <p className="mt-1 text-sm text-white/80">จัดการอุปกรณ์คีออสก์สำหรับสแกน QR</p>
      </header>

      <Card className="rounded-2xl border border-slate-200 ring-0">
        <CardHeader>
          <CardTitle>รายการอุปกรณ์</CardTitle>
          <CardAction>
            <Button
              className={cn(ACTION_BUTTON_CLASS, "bg-accent-600 text-white hover:bg-accent-700")}
              onClick={() => setFormOpen(true)}
            >
              เพิ่มอุปกรณ์
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[19%]">ชื่ออุปกรณ์</TableHead>
                <TableHead className="w-[18%]">สถานที่</TableHead>
                <TableHead className="w-[19%]">ลิงก์อุปกรณ์</TableHead>
                <TableHead className="w-[14%]">สร้างเมื่อ</TableHead>
                <TableHead className="w-[12%]">สถานะ</TableHead>
                <TableHead className="w-[18%] text-center">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.map((device) => (
                <TableRow key={device.id}>
                  <TableCell className="truncate font-medium text-foreground">{device.name}</TableCell>
                  <TableCell className="truncate text-muted-foreground">{device.location}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <code className="truncate text-xs text-muted-foreground">
                        {maskToken(device.tokenHash)}
                      </code>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="คัดลอกลิงก์"
                        className="text-muted-foreground"
                        disabled={!!device.revokedAt}
                        onClick={() => copyLink(device)}
                      >
                        {copiedId === device.id ? (
                          <Check className="text-success-foreground" />
                        ) : (
                          <Copy />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatThaiDate(new Date(device.createdAt))}
                  </TableCell>
                  <TableCell>
                    {device.revokedAt ? (
                      <span className="font-medium text-danger-foreground">ถูกเพิกถอน</span>
                    ) : (
                      <span className="font-medium text-success-foreground">ใช้งานอยู่</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {device.revokedAt ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="flex justify-center gap-1">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="หมุนคีย์"
                          className="text-muted-foreground hover:bg-warning hover:text-warning-foreground"
                          onClick={() => setRotateTarget(device)}
                        >
                          <RefreshCw />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="เพิกถอน"
                          className="text-muted-foreground hover:bg-danger hover:text-danger-foreground"
                          onClick={() => setRevokeTarget(device)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    )}
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
            <DialogTitle>เพิ่มอุปกรณ์</DialogTitle>
          </DialogHeader>
          {formOpen && <DeviceFormFields onSubmit={handleCreate} onCancel={() => setFormOpen(false)} />}
        </DialogContent>
      </Dialog>

      {/* One-time reveal — used for both a fresh device and a rotated key.
          The token is never rendered in full again after this closes,
          matching how API keys are typically shown once. Full URL wraps
          across lines instead of truncating — it has to stay fully
          visible, not just copyable blind. */}
      <Dialog open={!!revealDevice} onOpenChange={(open) => !open && setRevealDevice(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ลิงก์อุปกรณ์ &quot;{revealDevice?.name}&quot;</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            คัดลอกลิงก์นี้ไปเปิดที่จอทีวี — ระบบจะไม่แสดงลิงก์แบบเต็มอีกหลังจากปิดหน้าต่างนี้
          </p>
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3">
            <code className="font-mono text-xs break-all text-foreground">
              {revealDevice ? buildKioskUrl(revealDevice.tokenHash) : ""}
            </code>
            <Button
              variant="outline"
              className={cn(ACTION_BUTTON_CLASS, "w-fit border-slate-200")}
              onClick={() => revealDevice && copyLink(revealDevice)}
            >
              {revealDevice && copiedId === revealDevice.id ? (
                <>
                  <Check className="text-success-foreground" />
                  คัดลอกแล้ว
                </>
              ) : (
                <>
                  <Copy />
                  คัดลอกลิงก์
                </>
              )}
            </Button>
          </div>
          <DialogFooter>
            <Button
              className={cn(ACTION_BUTTON_CLASS, "bg-accent-600 text-white hover:bg-accent-700")}
              onClick={() => setRevealDevice(null)}
            >
              เสร็จสิ้น
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>เพิกถอนอุปกรณ์ {revokeTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              จอนี้จะไม่สามารถแสดง QR เช็คอินได้ทันที และไม่สามารถย้อนกลับได้ — ต้องสร้างอุปกรณ์ใหม่หากต้องการใช้งานอีกครั้ง
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmRevoke}>
              เพิกถอน
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!rotateTarget} onOpenChange={(open) => !open && setRotateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>หมุนคีย์อุปกรณ์ {rotateTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              ลิงก์เดิมจะใช้งานไม่ได้ทันทีและไม่สามารถย้อนกลับได้ — จอทีวีที่เปิดลิงก์เดิมค้างอยู่จะหลุดจากระบบ
              ต้องเปิดลิงก์ใหม่แทน ชื่อและสถานที่ของอุปกรณ์จะไม่เปลี่ยนแปลง
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmRotate}>
              หมุนคีย์
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
