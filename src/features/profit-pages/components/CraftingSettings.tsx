import { useEffect, useRef, useState } from "react";
import { Settings } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { craftingTimeReduction } from "@/lib/price-calculation/crafting-skill";

export function CraftingSettings({ level, onLevelChange, forced, note }: {
  level: number;
  forced: boolean;
  note?: string;
  onLevelChange: (level: number) => void;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="flex h-9 items-center justify-center gap-2 rounded border border-white/10 bg-[#0b0c0e] px-3 text-sm hover:border-tarkov-green/60">
          <Settings className="size-4" aria-hidden />
          Skills
        </button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined} className="grid gap-4 p-5 sm:max-w-md">
        <DialogHeader className="pr-5">
          <DialogTitle>Skills</DialogTitle>
        </DialogHeader>
        <CraftingSkillRow forced={forced} note={note} level={level} onLevelChange={onLevelChange} />
      </DialogContent>
    </Dialog>
  );
}

function CraftingSkillRow({ level, onLevelChange, forced, note }: {
  level: number;
  forced: boolean;
  note?: string;
  onLevelChange: (level: number) => void;
}) {
  const elite = level === 51;
  const [draft, setDraft] = useState(String(Math.min(level, 50)));
  const [savedLevel, setSavedLevel] = useState(level);
  if (savedLevel !== level) {
    setSavedLevel(level);
    setDraft(String(Math.min(level, 50)));
  }
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), [level]);

  function validate(value: string) {
    const parsed = Number(value);
    const next = value.trim() !== "" && Number.isFinite(parsed)
      ? Math.min(50, Math.max(0, Math.trunc(parsed))) : Math.min(level, 50);
    setDraft(String(next));
    if (next !== level) onLevelChange(next);
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-sm sm:gap-3">
        <label htmlFor="crafting-skill-level" className="mr-auto">Crafting</label>
        <input
          id="crafting-skill-level"
          aria-label="Crafting skill level"
          type="text"
          inputMode="numeric"
          value={draft}
          disabled={elite}
          onChange={(event) => {
            const value = event.target.value;
            setDraft(value);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => validate(value), 500);
          }}
          onBlur={() => {
            clearTimeout(timer.current);
            if (!elite) validate(draft);
          }}
          className="h-8 w-12 rounded border border-white/15 bg-[#0b0c0e] px-2 text-center outline-none focus:border-tarkov-green/60 disabled:opacity-50"
        />
        <span className="whitespace-nowrap text-xs text-tarkov-green" aria-label={`${Number((craftingTimeReduction(level) * 100).toFixed(2))}% craft time reduction`}>
          -{Number((craftingTimeReduction(level) * 100).toFixed(2))}% time
        </span>
        <button
          type="button"
          disabled={forced}
          aria-pressed={elite}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => {
            clearTimeout(timer.current);
            onLevelChange(elite ? 50 : 51);
          }}
          className={`h-8 rounded border px-2.5 text-xs transition ${elite ? "border-tarkov-green/60 bg-tarkov-green/10 text-tarkov-green" : "border-white/15 text-muted-foreground hover:border-white/30"}`}
        >
          Elite
        </button>
      </div>
      {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
      {elite && <p className="mt-2 text-xs text-muted-foreground">2 crafts possible at once.</p>}
    </div>
  );
}
