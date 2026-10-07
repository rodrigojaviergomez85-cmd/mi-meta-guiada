import type { ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Centered dialog on desktop; on phones it is pinned to the top of the screen so the
 * keyboard never covers the text boxes (bottom drawers fight the phone keyboard).
 */
export function ResponsivePanel({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: ReactNode;
  children: ReactNode;
}) {
  const mobile = useIsMobile();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={mobile ? (e) => e.preventDefault() : undefined}
        className={cn(
          "flex flex-col rounded-2xl",
          mobile ? "top-3 w-[calc(100vw-1.5rem)] max-w-none translate-y-0 max-h-[70dvh] p-4" : "max-h-[85vh]",
        )}
      >
        <DialogHeader className="text-left">
          <DialogTitle className="line-clamp-2 pr-6">{title}</DialogTitle>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
