import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * Safe destructive confirmation. Always shows the name of the record that is
 * about to be removed so the user can never delete the wrong row by mistake.
 */
export function ConfirmDialog({
  trigger,
  title = "حذف مورد",
  name,
  description,
  confirmLabel = "حذف کن",
  pending = false,
  onConfirm,
}: {
  trigger: ReactNode;
  title?: string;
  name: string;
  description?: string;
  confirmLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent dir="rtl" className="max-w-[calc(100%-2rem)] rounded-2xl text-start">
        <AlertDialogHeader className="text-start">
          <AlertDialogTitle className="text-base">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-xs leading-6">
            <span className="block font-bold text-foreground">{name}</span>
            {description ?? "این عملیات قابل بازگشت نیست."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-2 sm:justify-start">
          <AlertDialogAction
            disabled={pending}
            onClick={onConfirm}
            className="h-11 flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {confirmLabel}
          </AlertDialogAction>
          <AlertDialogCancel className="mt-0 h-11 flex-1">انصراف</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
