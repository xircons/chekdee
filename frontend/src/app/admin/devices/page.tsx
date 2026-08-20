"use client";

import { useEffect, useState } from "react";
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
import { ACTION_BUTTON_CLASS, FIELD_CLASS } from "@/lib/admin-ui";
import {
  createKioskDevice,
  listKioskDevices,
  revokeKioskDevice,
  rotateKioskDevice,
  type KioskDevice,
} from "@/lib/api-devices";
import { cn, formatThaiDate } from "@/lib/utils";

function buildKioskUrl(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/kiosk/lobby-tv?token=${token}`;
}

const deviceSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่ออุปกรณ์"),
});

type DeviceForm = z.infer<typeof deviceSchema>;

function DeviceFormFields({
  onSubmit,
  onCancel,
}: {
  onSubmit: (values: DeviceForm) => Promise<void>;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DeviceForm>({
    resolver: zodResolver(deviceSchema),
    defaultValues: { name: "" },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">ชื่ออุปกรณ์</Label>
        <Input id="name" placeholder="เช่น จอ Lobby ชั้น 1" className={FIELD_CLASS} {...register("name")} />
        {errors.name && <p className="text-xs text-danger-foreground">{errors.name.message}</p>}
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
  const [devices, setDevices] = useState<KioskDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [revealDevice, setRevealDevice] = useState<{ device: KioskDevice; token: string } | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<KioskDevice | null>(null);
  const [rotateTarget, setRotateTarget] = useState<KioskDevice | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Tokens the backend has actually shown us this session (right after
  // create/rotate) — the only ones a "copy link" click can work for, since
  // the backend never re-exposes a raw token past that first response.
  const [knownTokens, setKnownTokens] = useState<Record<string, string>>({});

  useEffect(() => {
    listKioskDevices()
      .then((rows) => setDevices(rows))
      .catch((err: Error) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const copyLink = (device: KioskDevice) => {
    const token = knownTokens[device.id];
    if (!token) return;
    void navigator.clipboard.writeText(buildKioskUrl(token));
    setCopiedId(device.id);
    setTimeout(() => setCopiedId((id) => (id === device.id ? null : id)), 1500);
  };

  const handleCreate = async (values: DeviceForm) => {
    setActionError(null);
    try {
      const { device, token } = await createKioskDevice(values.name);
      setDevices((prev) => [device, ...prev]);
      setKnownTokens((prev) => ({ ...prev, [device.id]: token }));
      setFormOpen(false);
      setRevealDevice({ device, token });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "สร้างอุปกรณ์ไม่สำเร็จ");
    }
  };

  const confirmRevoke = async () => {
    if (!revokeTarget) return;
    setActionError(null);
    try {
      await revokeKioskDevice(revokeTarget.deviceId);
      setDevices((prev) =>
        prev.map((d) =>
          d.id === revokeTarget.id ? { ...d, revokedAt: new Date().toISOString() } : d
        )
      );
      setRevokeTarget(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "เพิกถอนอุปกรณ์ไม่สำเร็จ");
    }
  };

  // Rotate replaces the device's active row server-side (new id, same
  // device_id) — swap it in place in the list rather than re-fetching.
  const confirmRotate = async () => {
    if (!rotateTarget) return;
    setActionError(null);
    try {
      const { device, token } = await rotateKioskDevice(rotateTarget.deviceId);
      setDevices((prev) => prev.map((d) => (d.id === rotateTarget.id ? device : d)));
      setKnownTokens((prev) => ({ ...prev, [device.id]: token }));
      setRotateTarget(null);
      setRevealDevice({ device, token });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "หมุนคีย์อุปกรณ์ไม่สำเร็จ");
    }
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
          {actionError && (
            <p className="mb-4 rounded-md border border-danger bg-danger px-3 py-2 text-sm text-danger-foreground">
              {actionError}
            </p>
          )}

          {loading && <p className="text-sm text-muted-foreground">กำลังโหลด…</p>}
          {!loading && loadError && (
            <p className="text-sm text-danger-foreground">โหลดข้อมูลไม่สำเร็จ: {loadError}</p>
          )}
          {!loading && !loadError && devices.length === 0 && (
            <p className="text-sm text-muted-foreground">ยังไม่มีอุปกรณ์</p>
          )}

          {!loading && !loadError && devices.length > 0 && (
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[24%]">ชื่ออุปกรณ์</TableHead>
                  <TableHead className="w-[23%]">ลิงก์อุปกรณ์</TableHead>
                  <TableHead className="w-[18%]">สร้างเมื่อ</TableHead>
                  <TableHead className="w-[15%]">สถานะ</TableHead>
                  <TableHead className="w-[20%] text-center">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((device) => {
                  const isRevoked = !!device.revokedAt;
                  const hasKnownToken = !!knownTokens[device.id];
                  return (
                    <TableRow key={device.id}>
                      <TableCell className="truncate font-medium text-foreground">{device.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <code className="truncate text-xs text-muted-foreground">{device.maskedToken}</code>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label="คัดลอกลิงก์"
                            className="text-muted-foreground"
                            disabled={isRevoked || !hasKnownToken}
                            title={
                              !hasKnownToken
                                ? "ต้องหมุนคีย์เพื่อรับลิงก์ใหม่ที่คัดลอกได้ — ระบบไม่แสดงลิงก์เต็มซ้ำ"
                                : undefined
                            }
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
                        {isRevoked ? (
                          <span className="font-medium text-danger-foreground">ถูกเพิกถอน</span>
                        ) : (
                          <span className="font-medium text-success-foreground">ใช้งานอยู่</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {isRevoked ? (
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
                  );
                })}
              </TableBody>
            </Table>
          )}
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
          matching how API keys are typically shown once. Dialog is widened
          well past the default sm max-width so the URL fits on one line in
          the common case; break-all (not truncate) stays as a fallback so
          an unusually long origin still wraps instead of ever clipping. */}
      <Dialog open={!!revealDevice} onOpenChange={(open) => !open && setRevealDevice(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>ลิงก์อุปกรณ์ &quot;{revealDevice?.device.name}&quot;</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            คัดลอกลิงก์นี้ไปเปิดที่จอทีวี — ระบบจะไม่แสดงลิงก์แบบเต็มอีกหลังจากปิดหน้าต่างนี้
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
            <code className="flex-1 break-all font-mono text-xs text-foreground">
              {revealDevice ? buildKioskUrl(revealDevice.token) : ""}
            </code>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="คัดลอกลิงก์"
              className="shrink-0"
              onClick={() => revealDevice && copyLink(revealDevice.device)}
            >
              {revealDevice && copiedId === revealDevice.device.id ? (
                <Check className="text-success-foreground" />
              ) : (
                <Copy />
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
            <AlertDialogAction variant="destructive" onClick={() => void confirmRevoke()}>
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
              ต้องเปิดลิงก์ใหม่แทน ชื่ออุปกรณ์จะไม่เปลี่ยนแปลง
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void confirmRotate()}>
              หมุนคีย์
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
