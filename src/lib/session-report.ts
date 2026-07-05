import { formatDurationLong } from "@/lib/format";

type ReportClick = {
  activeDurationSeconds: number;
  externalDurationSeconds: number;
  visibleDurationSeconds: number;
  manualInteractionCount: number;
  interactionCount: number;
  requiredDurationSeconds: number;
  completionStatus: string;
  completionPercent: number;
  endedAt: Date | null;
  clickedAt: Date;
  isValid?: boolean;
};

function engagedSeconds(click: ReportClick): number {
  return click.activeDurationSeconds + click.externalDurationSeconds;
}

function isGhostClick(click: ReportClick): boolean {
  if (click.isValid === false) return true;
  const engaged = engagedSeconds(click);
  if (engaged > 0) return false;
  if (click.completionStatus === "completed" || click.completionStatus === "partial") return false;
  if (click.completionStatus === "abandoned" && click.interactionCount > 1) return true;
  if (click.completionStatus === "abandoned" && click.visibleDurationSeconds <= 5 && engaged === 0) {
    return true;
  }
  return false;
}

function completionRank(status: string): number {
  if (status === "completed") return 4;
  if (status === "partial") return 3;
  if (status === "in_progress") return 2;
  if (status === "abandoned") return 1;
  return 0;
}

/** Pick the most meaningful session when duplicate clicks exist for one assignment. */
export function pickReportClick<T extends ReportClick>(clicks: T[]): T | null {
  if (!clicks.length) return null;

  const meaningful = clicks.filter((c) => !isGhostClick(c));
  const pool = meaningful.length ? meaningful : clicks;

  return [...pool].sort((a, b) => {
    const engagedA = engagedSeconds(a);
    const engagedB = engagedSeconds(b);
    if (engagedB !== engagedA) return engagedB - engagedA;

    const rankDiff = completionRank(b.completionStatus) - completionRank(a.completionStatus);
    if (rankDiff !== 0) return rankDiff;

    if (b.interactionCount !== a.interactionCount) {
      return b.interactionCount - a.interactionCount;
    }

    const endedA = a.endedAt?.getTime() ?? 0;
    const endedB = b.endedAt?.getTime() ?? 0;
    if (endedB !== endedA) return endedB - endedA;

    return b.clickedAt.getTime() - a.clickedAt.getTime();
  })[0];
}

export function buildSessionSummary(click: ReportClick): string {
  const total = click.activeDurationSeconds + click.externalDurationSeconds;
  const required = click.requiredDurationSeconds;

  if (!total && click.interactionCount <= 1) {
    return "لم يبدأ بعد";
  }

  const achieved = formatDurationLong(total || click.visibleDurationSeconds);
  const requiredLabel = formatDurationLong(required);
  const interactions = `${click.interactionCount} حدث`;

  if (click.completionStatus === "completed") {
    return `أنجز ${achieved} من ${requiredLabel} — ${interactions}`;
  }

  if (click.completionStatus === "partial") {
    return `حقق ${achieved} من ${requiredLabel} — ${interactions}`;
  }

  if (click.completionStatus === "in_progress") {
    return `جاري التنفيذ: ${achieved} من ${requiredLabel} — ${interactions}`;
  }

  return `حقق ${achieved} من ${requiredLabel} — ${interactions}`;
}

export function getTotalEngagedSeconds(
  click: Pick<ReportClick, "activeDurationSeconds" | "externalDurationSeconds">
): number {
  return click.activeDurationSeconds + click.externalDurationSeconds;
}
