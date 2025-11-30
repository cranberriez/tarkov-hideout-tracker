import Image from "next/image";
import { cn } from "@/lib/utils";

export function PostImage({ label, src, contain }: { label: string, src?: string, contain?: boolean }) {
    return (
        <div className="relative w-full aspect-video bg-secondary/30 border-2 border-dashed border-secondary rounded-lg flex items-center justify-center my-4 overflow-hidden">
            {!src && <span className="text-muted-foreground text-sm font-medium flex items-center gap-2">
                {label}
            </span>}
            
            {src && (
                <Image
                    src={src}
                    alt={label}
                    fill
                    className={cn("left-0", contain ? "object-contain" : "object-cover")}
                    loading="eager"
                />
            )}
        </div>
    );
}