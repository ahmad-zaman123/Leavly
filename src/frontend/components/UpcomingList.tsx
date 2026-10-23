"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import Avatar from "./Avatar";
import { removeLeave, restoreLeave, type LeaveDTO } from "@/backend/lib/actions";
import { fmtDays, fmtRange, leaveDays, type WorkCalendar } from "@/backend/lib/dates";
import { typeColorVar } from "@/frontend/lib/colors";

type T = { key: string; label: string; colorIndex: number };

export default function UpcomingList({ leaves, types, weekend, holidays }: { leaves: LeaveDTO[]; types: T[]; weekend: number[]; holidays: string[] }) {
  const router = useRouter();
  const cal: WorkCalendar = { weekend, holidays: new Set(holidays) };
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<{ msg: string; undo?: () => void } | null>(null);
  const timer = useRef<number | null>(null);
  const show = (t: { msg: string; undo?: () => void }) => {
    setToast(t);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 6000);
  };
  const remove = async (l: LeaveDTO) => {
    setHidden((s) => new Set(s).add(l.id));
    const r = await removeLeave(l.id);
    if (r.error) {
      setHidden((s) => {
        const n = new Set(s);
        n.delete(l.id);
        return n;
      });
      show({ msg: r.error });
      return;
    }
    show({
      msg: `Removed ${l.userName}'s ${fmtRange(l.fromDate, l.toDate)}.`,
      undo: async () => {
        setToast(null);
        const back = await restoreLeave(r.removed!);
        show({ msg: back.leave ? "Restored." : (back.error ?? "Could not restore.") });
        router.refresh();
      },
    });
    router.refresh();
  };
  const visible = leaves.filter((l) => !hidden.has(l.id));
  return (
    <>
      <div className="list">
        {visible.length ? (
          visible.map((l) => {
            const t = types.find((x) => x.key === l.typeKey);
            const n = leaveDays(l, cal);
            return (
              <div className="item" key={l.id} style={{ ["--c" as string]: typeColorVar(t?.colorIndex ?? 0) }}>
                <Avatar id={l.userId} name={l.userName} />
                <div className="t">
                  <div className="l1">
                    {l.userName} · <span className="tname">{t?.label ?? l.typeKey}</span>
                  </div>
                  <div className="l2">
                    <span className="num">{fmtRange(l.fromDate, l.toDate)}</span> · {fmtDays(n)}
                    {l.note ? ` · ${l.note}` : ""}
                  </div>
                </div>
                <div className="act">
                  <button className="btn sm" type="button" onClick={() => remove(l)}>
                    Remove
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="empty">No upcoming leave logged.</div>
        )}
      </div>
      {toast ? (
        <div className="toast" role="status">
          <span>{toast.msg}</span>
          {toast.undo ? (
            <button type="button" onClick={toast.undo}>
              Undo
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
