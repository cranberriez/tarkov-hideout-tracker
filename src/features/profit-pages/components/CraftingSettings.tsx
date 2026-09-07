import { useEffect, useRef, useState } from "react";
import { Settings } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { craftingTimeReduction } from "@/lib/price-calculation/crafting-skill";
import { hideoutManagementConsumptionReduction } from "@/lib/price-calculation/craft-rules";

export function CraftingSettings({
  craftingLevel,
  onCraftingLevelChange,
  hideoutManagementLevel,
  onHideoutManagementLevelChange,
  forced,
  note,
}: {
  craftingLevel: number;
  hideoutManagementLevel: number;
  forced: boolean;
  note?: string;
  onCraftingLevelChange: (level: number) => void;
  onHideoutManagementLevelChange: (level: number) => void;
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
        <SkillRow
          id="crafting-skill-level"
          label="Crafting"
          level={craftingLevel}
          onLevelChange={onCraftingLevelChange}
          forced={forced}
          note={note}
          reduction={craftingTimeReduction}
          reductionLabel="time"
          eliteNote="2 crafts possible at once."
        />
        <SkillRow
          id="hideout-management-skill-level"
          label="Hideout Management"
          level={hideoutManagementLevel}
          onLevelChange={onHideoutManagementLevelChange}
          reduction={hideoutManagementConsumptionReduction}
          reductionLabel="filter use"
          note="Applied to Water filters consumed by Superwater."
        />
      </DialogContent>
    </Dialog>
  );
}

function SkillRow({ id, label, level, onLevelChange, forced = false, note, reduction, reductionLabel, eliteNote }: {
  id: string;
  label: string;
  level: number;
  forced?: boolean;
  note?: string;
  onLevelChange: (level: number) => void;
  reduction: (level: number) => number;
  reductionLabel: string;
  eliteNote?: string;
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
        <label htmlFor={id} className="mr-auto">{label}</label>
        <input
          id={id}
          aria-label={`${label} skill level`}
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
        <span className="whitespace-nowrap text-xs text-tarkov-green" aria-label={`${Number((reduction(level) * 100).toFixed(2))}% ${reductionLabel} reduction`}>
          -{Number((reduction(level) * 100).toFixed(2))}% {reductionLabel}
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
      {elite && eliteNote && <p className="mt-2 text-xs text-muted-foreground">{eliteNote}</p>}
    </div>
  );
}
