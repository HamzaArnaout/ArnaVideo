import Image from "next/image";
import { cn } from "@/lib/cn";

type Props = {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
};

export function BrandLogo({ className, markClassName, wordmarkClassName }: Props) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Image
        src="/arnavideo-mark.svg"
        alt=""
        width={28}
        height={28}
        priority
        className={cn("h-7 w-7 object-contain", markClassName)}
      />
      <span
        className={cn(
          "text-[18px] font-semibold tracking-tight text-fg",
          wordmarkClassName,
        )}
      >
        ArnaVideo
      </span>
    </div>
  );
}
