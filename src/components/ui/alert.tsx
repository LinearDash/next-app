import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

function Alert({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div role="alert" data-slot="alert" className={cn("alert-block", className)} {...props} />;
}

function AlertTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 data-slot="alert-title" className={cn("alert-block-title", className)} {...props} />;
}

function AlertDescription({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="alert-description"
      className={cn("alert-block-description", className)}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription };
