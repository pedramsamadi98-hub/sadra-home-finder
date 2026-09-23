import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { zipSync, strToU8 } from "fflate";
import { DatabaseBackup, Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { faDigits } from "@/lib/fa";
import {
  BACKUP_FORMAT_VERSION,
  BACKUP_TABLES,
  getBackupCounts,
  getBackupTable,
} from "@/lib/backup.functions";

const TABLE_LABELS: Record<string, string> = {
  properties: "املاک",
  brokers: "دلال‌ها",
  customers: "مشتری‌ها",
  customer_requirements: "نیازمندی مشتری",
  property_price_events: "سابقه قیمت",
  follow_ups: "یادآورها",
  photo_visibility: "نوع تصویرها",
  property_shares: "اشتراک‌ها",
  profiles: "کاربران",
  user_roles: "نقش‌ها",
  app_settings: "تنظیمات",
  file_code_pool: "کدهای آزاد",
  bulk_import_batches: "دسته‌های ورود گروهی",
  bulk_import_items: "موارد ورود گروهی",
};

function faBytes(bytes: number) {
  if (bytes < 1024) return `${faDigits(bytes)} بایت`;
  if (bytes < 1024 * 1024) return `${faDigits((bytes / 1024).toFixed(1))} کیلوبایت`;
  return `${faDigits((bytes / (1024 * 1024)).toFixed(2))} مگابایت`;
}

async function sha256(data: Uint8Array) {
  const buffer = await crypto.subtle.digest(
    "SHA-256",
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer,
  );
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function BackupSection() {
  const fetchCounts = useServerFn(getBackupCounts);
  const fetchTable = useServerFn(getBackupTable);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["backup-counts"],
    queryFn: () => fetchCounts(),
    staleTime: 60_000,
  });

  const counts = data?.counts ?? {};
  const listed = BACKUP_TABLES.filter((table) => (counts[table] ?? 0) > 0);

  async function createBackup() {
    setBusy(true);
    setProgress(0);
    try {
      const files: Record<string, Uint8Array> = {};
      const checksumLines: string[] = [];
      const perTable: Record<string, number> = {};

      for (let index = 0; index < BACKUP_TABLES.length; index += 1) {
        const table = BACKUP_TABLES[index]!;
        const result = await fetchTable({ data: { table } });
        const path = `database/${table}.jsonl`;
        const bytes = strToU8(result.jsonl);
        files[path] = bytes;
        perTable[table] = result.count;
        checksumLines.push(`${await sha256(bytes)}  ${path}`);
        setProgress(Math.round(((index + 1) / (BACKUP_TABLES.length + 1)) * 100));
      }

      const total = Object.values(perTable).reduce((sum, n) => sum + n, 0);
      const approxBytes = Object.values(files).reduce((sum, file) => sum + file.byteLength, 0);
      const manifest = {
        backup_format_version: BACKUP_FORMAT_VERSION,
        backup_type: "data",
        created_at: new Date().toISOString(),
        project_identifier: "sadra-melk",
        application: "Sadra Melk / Sadra Property Hub",
        schema_reference: "supabase/migrations (latest applied)",
        tables: BACKUP_TABLES.map((table) => ({
          name: table,
          file: `database/${table}.jsonl`,
          row_count: perTable[table] ?? 0,
        })),
        total_rows: total,
        approximate_data_bytes: approxBytes,
        files: [...Object.keys(files), "manifest.json", "checksums.txt"],
        excluded: [
          "auth users and credentials",
          "storage objects (photos)",
          "secrets and API keys",
          "property_shares.token_hash",
        ],
        status: "complete",
      };

      const manifestBytes = strToU8(JSON.stringify(manifest, null, 2));
      files["manifest.json"] = manifestBytes;
      checksumLines.push(`${await sha256(manifestBytes)}  manifest.json`);
      files["checksums.txt"] = strToU8(checksumLines.join("\n") + "\n");

      const zipped = zipSync(files, { level: 6 });
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const blob = new Blob([zipped.slice() as unknown as BlobPart], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `SadraMelk_DATA_BACKUP_${stamp}.zip`;
      link.click();
      URL.revokeObjectURL(url);
      setProgress(100);
      toast.success(`پشتیبان ساخته شد (${faDigits(total)} رکورد)`);
    } catch (error) {
      toast.error(
        `ساخت پشتیبان ناقص ماند: ${(error as Error).message || "خطای نامشخص"} — فایلی ساخته نشد`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface-card space-y-3 p-4">
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <DatabaseBackup className="size-4 text-primary" />
        پشتیبان‌گیری
      </h2>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {listed.map((table) => (
              <div
                key={table}
                className="flex items-center justify-between rounded-lg bg-secondary/60 px-2 py-1.5"
              >
                <span className="truncate text-muted-foreground">
                  {TABLE_LABELS[table] ?? table}
                </span>
                <span className="font-semibold">{faDigits(counts[table] ?? 0)}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            مجموع {faDigits(data?.total ?? 0)} رکورد — حجم تقریبی{" "}
            {faBytes((data?.total ?? 0) * 700)}. عکس‌ها در این پشتیبان نیستند.
          </p>
          <Button className="h-11 w-full" disabled={busy} onClick={createBackup}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            ساخت پشتیبان اطلاعات
          </Button>
          {busy ? (
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          ) : null}
          <p className="text-[11px] leading-6 text-muted-foreground">
            فایل ZIP شامل داده‌های کاری، فهرست محتوا و کد بررسی سالم‌بودن است. رمز عبور، کلید و
            عکس‌ها ذخیره نمی‌شوند.
          </p>
        </>
      )}
    </section>
  );
}
