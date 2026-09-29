import { useServerFn } from "@tanstack/react-start";
import { strFromU8, unzipSync } from "fflate";
import { FileSearch, Loader2, Lock } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { BACKUP_TABLES } from "@/lib/backup.functions";
import { faDigits } from "@/lib/fa";
import { previewRestore } from "@/lib/restore.functions";

type Preview = Awaited<ReturnType<typeof previewRestore>>;

const STATUS_LABEL: Record<string, { text: string; tone: string }> = {
  SAFE_TO_APPLY: { text: "SAFE_TO_APPLY — فایل سالم است و تداخلی ندارد", tone: "text-success" },
  BLOCKED_BY_CONFLICTS: { text: "BLOCKED_BY_CONFLICTS — فایل سالم است ولی با داده فعلی تداخل دارد", tone: "text-warning" },
  INVALID_BACKUP: { text: "INVALID_BACKUP — فایل پشتیبان معتبر نیست", tone: "text-destructive" },
};

async function sha256(data: Uint8Array) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer,
  );
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

type LocalCheck = { errors: string[]; mismatches: string[]; fileCount: number; photoBytes: number };

/** Read-only: validates a backup ZIP and previews what a restore would do. Never writes anything. */
export function RestoreCheckSection() {
  const runPreview = useServerFn(previewRestore);
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState<LocalCheck | null>(null);
  const [result, setResult] = useState<Preview | null>(null);
  const [fileName, setFileName] = useState("");

  async function check(file: File) {
    setBusy(true);
    setLocal(null);
    setResult(null);
    setFileName(file.name);
    const errors: string[] = [];
    const mismatches: string[] = [];
    try {
      let files: Record<string, Uint8Array>;
      try {
        files = unzipSync(new Uint8Array(await file.arrayBuffer()));
      } catch {
        setLocal({ errors: ["فایل ZIP خراب است یا باز نمی‌شود"], mismatches, fileCount: 0, photoBytes: 0 });
        return;
      }
      const names = Object.keys(files).filter((n) => !n.endsWith("/"));
      const manifestBytes = files["manifest.json"];
      const checksumBytes = files["checksums.txt"];
      if (!manifestBytes) errors.push("manifest.json وجود ندارد");
      if (!checksumBytes) errors.push("checksums.txt وجود ندارد");
      if (!manifestBytes || !checksumBytes) {
        setLocal({ errors, mismatches, fileCount: names.length, photoBytes: 0 });
        return;
      }
      const checksumsText = strFromU8(checksumBytes);
      const sums = new Map<string, string>();
      for (const line of checksumsText.split("\n")) {
        const m = line.trim().match(/^([0-9a-f]{64})\s+(.+)$/);
        if (m) sums.set(m[2]!, m[1]!);
      }
      for (const [path, expected] of sums) {
        const bytes = files[path];
        if (!bytes) errors.push(`فایل ${path} در ZIP نیست`);
        else if ((await sha256(bytes)) !== expected) mismatches.push(path);
      }
      for (const n of names) {
        if (n !== "checksums.txt" && !sums.has(n)) errors.push(`فایل بدون checksum: ${n}`);
      }
      for (const t of BACKUP_TABLES) {
        if (!files[`database/${t}.jsonl`]) errors.push(`جدول ${t} در ZIP نیست`);
      }
      const manifestText = strFromU8(manifestBytes);
      type Obj = { bucket: string; path: string; file: string };
      let objects: Obj[] = [];
      try {
        objects = (JSON.parse(manifestText) as { storage?: { objects?: Obj[] } }).storage?.objects ?? [];
      } catch {
        errors.push("manifest.json خراب است");
      }
      const photos: Array<{ bucket: string; path: string; sha256: string; size: number }> = [];
      let photoBytes = 0;
      for (const o of objects) {
        const bytes = files[o.file];
        if (!bytes) {
          errors.push(`عکس ${o.path} در ZIP نیست`);
          continue;
        }
        photoBytes += bytes.byteLength;
        photos.push({ bucket: o.bucket, path: o.path, sha256: await sha256(bytes), size: bytes.byteLength });
      }
      for (const n of names) {
        if (n.startsWith("photos/") && !objects.some((o) => o.file === n)) errors.push(`عکس خارج از manifest: ${n}`);
      }
      if (mismatches.length) errors.push(`${faDigits(mismatches.length)} فایل checksum نادرست دارند`);
      setLocal({ errors, mismatches, fileCount: names.length, photoBytes });

      const tables: Record<string, { jsonl: string }> = {};
      for (const t of BACKUP_TABLES) {
        const b = files[`database/${t}.jsonl`];
        if (b) tables[t] = { jsonl: strFromU8(b) };
      }
      setResult(
        await runPreview({
          data: { manifest_text: manifestText, checksums_text: checksumsText, tables, photos },
        }),
      );
    } catch (error) {
      setLocal({
        errors: [...errors, `بررسی متوقف شد: ${(error as Error).message}`],
        mismatches,
        fileCount: 0,
        photoBytes: 0,
      });
    } finally {
      setBusy(false);
    }
  }

  const status = local?.errors.length ? "INVALID_BACKUP" : result?.status;
  const allErrors = [...(local?.errors ?? []), ...(result?.errors ?? [])];
  const tables = result?.tables ?? [];
  const photos = result?.photos ?? [];
  const sum = (f: (t: (typeof tables)[number]) => number) => tables.reduce((s, t) => s + f(t), 0);
  const schemaErrors = sum((t) => t.unknown_columns.length + t.missing_columns.length);
  const shares = tables.find((t) => t.table === "property_shares");

  return (
    <section className="surface-card space-y-3 p-4">
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <FileSearch className="size-4 text-primary" />
        بررسی فایل پشتیبان (بدون تغییر داده)
      </h2>
      <p className="text-[11px] leading-6 text-muted-foreground">
        فایل ZIP پشتیبان را انتخاب کنید تا سلامت آن و نتیجهٔ احتمالی بازگردانی نمایش داده شود. در این مرحله هیچ
        چیزی در سامانه نوشته یا تغییر داده نمی‌شود.
      </p>
      <label className="block">
        <input
          type="file"
          accept=".zip,application/zip"
          disabled={busy}
          aria-label="انتخاب فایل پشتیبان"
          className="block w-full text-xs file:ml-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-foreground"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void check(f);
            e.target.value = "";
          }}
        />
      </label>
      {busy ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" /> در حال بررسی {fileName}…
        </div>
      ) : null}

      {!busy && status ? (
        <div className="space-y-3 text-[11px]" data-testid="restore-result">
          <p className={`font-bold ${STATUS_LABEL[status]?.tone ?? ""}`} data-testid="restore-status">
            {STATUS_LABEL[status]?.text ?? status}
          </p>
          {result ? (
            <div className="grid grid-cols-3 gap-2">
              {[
                ["افزودنی", sum((t) => t.insert)],
                ["یکسان", sum((t) => t.identical)],
                ["تداخل", result.conflict_count],
                ["ارتباط نامعتبر", sum((t) => t.fk_errors.length)],
                ["خطای ساختار", schemaErrors],
                ["checksum نادرست", local?.mismatches.length ?? 0],
              ].map(([label, n]) => (
                <div key={label as string} className="rounded-lg bg-secondary/60 px-2 py-1.5 text-center">
                  <div className="text-muted-foreground">{label}</div>
                  <div className="font-semibold">{faDigits(n as number)}</div>
                </div>
              ))}
            </div>
          ) : null}

          {allErrors.length ? (
            <ul className="list-disc space-y-1 pr-4 text-destructive">
              {allErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}

          {tables.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="py-1">جدول</th>
                    <th>ردیف</th>
                    <th>افزودنی</th>
                    <th>یکسان</th>
                    <th>تداخل</th>
                    <th>غیرقابل</th>
                  </tr>
                </thead>
                <tbody>
                  {tables.map((t) => (
                    <tr key={t.table} className="border-t border-border/50">
                      <td className="py-1" dir="ltr">{t.table}</td>
                      <td>{faDigits(t.backup_rows)}</td>
                      <td>{faDigits(t.insert)}</td>
                      <td>{faDigits(t.identical)}</td>
                      <td className={t.conflicts.length ? "text-warning" : ""}>{faDigits(t.conflicts.length)}</td>
                      <td>{faDigits(t.not_restorable)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {tables.some((t) => t.conflicts.length) ? (
            <details>
              <summary className="cursor-pointer font-semibold">جزئیات تداخل‌ها</summary>
              <ul className="mt-1 max-h-48 space-y-1 overflow-y-auto">
                {tables.flatMap((t) =>
                  t.conflicts.map((c) => (
                    <li key={`${t.table}-${c.id}-${c.reason}`} className="break-all">
                      <span dir="ltr">{t.table}/{c.id}</span>: {c.reason}
                    </li>
                  )),
                )}
              </ul>
            </details>
          ) : null}

          {result ? (
            <details>
              <summary className="cursor-pointer font-semibold">
                عکس‌ها: {faDigits(photos.length)} فایل — {faDigits(local?.photoBytes ?? 0)} بایت — بدون اتصال به ملک:{" "}
                {faDigits(photos.filter((p) => !p.linked).length)}
              </summary>
              <ul className="mt-1 max-h-60 space-y-1 overflow-y-auto">
                {photos.map((p) => (
                  <li key={p.path} className="flex justify-between gap-2">
                    <span className="truncate" dir="ltr">{p.path}</span>
                    <span className={p.action === "conflict" ? "text-warning" : "text-muted-foreground"}>
                      {p.action === "upload" ? "افزودنی" : p.action === "identical" ? "یکسان" : "تداخل"}
                      {p.linked ? "" : " · بدون اتصال"}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {tables.some((t) => t.fk_errors.length || t.unknown_columns.length || t.missing_columns.length) ? (
            <details>
              <summary className="cursor-pointer font-semibold">جزئیات ارتباط‌ها و ستون‌ها</summary>
              <ul className="mt-1 max-h-48 space-y-1 overflow-y-auto break-all" dir="ltr">
                {tables.flatMap((t) => [
                  ...t.unknown_columns.map((c) => <li key={`${t.table}-u-${c}`}>{t.table}: unknown column {c}</li>),
                  ...t.missing_columns.map((c) => <li key={`${t.table}-m-${c}`}>{t.table}: missing column {c}</li>),
                  ...t.fk_errors.map((e) => <li key={`${t.table}-f-${e}`}>{t.table}: {e}</li>),
                ])}
              </ul>
            </details>
          ) : null}

          <p className="rounded-lg bg-secondary/60 p-2 leading-6 text-muted-foreground">
            حساب‌های ورود (رمز عبور) در پشتیبان نیستند؛ پروفایل و نقش کاربران فقط برای حساب‌هایی قابل بازگردانی است که
            هنوز در سامانه وجود دارند (کد فایل تکراری و حساب‌های مفقود در بالا به‌عنوان تداخل/ارتباط نامعتبر نمایش
            داده می‌شوند).
          </p>
          <p className="rounded-lg bg-secondary/60 p-2 leading-6 text-muted-foreground">

            محدودیت: کد امنیتی لینک‌های اشتراک عمداً در پشتیبان ذخیره نمی‌شود؛ بنابراین{" "}
            {faDigits(shares?.not_restorable ?? 0)} لینک اشتراکِ حذف‌شده قابل بازگردانی نیست و باید دوباره ساخته شود.
          </p>
        </div>
      ) : null}

      <Button className="h-11 w-full" disabled variant="secondary">
        <Lock className="size-4" /> اجرای بازگردانی (قفل)
      </Button>
      <p className="text-[11px] leading-6 text-muted-foreground">
        برای اجرای Restore واقعی ابتدا مسیر توقف امن Scheduler و سیاست Restore باید جداگانه تأیید شود.
      </p>
    </section>
  );
}
