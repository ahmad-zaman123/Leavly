"use client";

import { useState } from "react";
import Avatar from "./Avatar";
import { AutoSubmitInput, AutoSubmitSelect } from "./AutoSubmit";
import { setActive, setAllowance, setRole, setUserPassword } from "@/backend/lib/actions";
import { typeColorVar } from "@/frontend/lib/colors";

export type Person = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "member";
  active: boolean;
  allowances: Record<string, number> | null;
  usage: Record<string, number>;
  allowance: Record<string, number>;
};
export type TypeCol = { key: string; label: string; days: number; colorIndex: number };

export default function TeamTable({ people, types, meId }: { people: Person[]; types: TypeCol[]; meId: number }) {
  const [open, setOpen] = useState<number | null>(null);
  const [pwFor, setPwFor] = useState<number | null>(null);
  const [confirmFor, setConfirmFor] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"name" | "left" | "used">("name");
  const left = (p: Person) => types.reduce((n, t) => n + p.allowance[t.key] - (p.usage[t.key] ?? 0), 0);
  const usedOf = (p: Person) => types.reduce((n, t) => n + (p.usage[t.key] ?? 0), 0);
  const shown = people
    .filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.email.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : sort === "left" ? left(a) - left(b) : usedOf(b) - usedOf(a)));
  return (
    <div className="team">
      {people.length > 5 ? (
        <div className="teamtools">
          <input type="search" placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search people" />
          <div className="seg" role="group" aria-label="Sort">
            <button type="button" className={sort === "name" ? "on" : ""} onClick={() => setSort("name")}>
              Name
            </button>
            <button type="button" className={sort === "left" ? "on" : ""} onClick={() => setSort("left")}>
              Fewest left
            </button>
            <button type="button" className={sort === "used" ? "on" : ""} onClick={() => setSort("used")}>
              Most used
            </button>
          </div>
        </div>
      ) : null}
      {shown.length === 0 ? <div className="empty">Nobody matches "{q}".</div> : null}
      {shown.map((p) => {
        const total = types.reduce((n, t) => n + p.allowance[t.key], 0);
        const used = types.reduce((n, t) => n + (p.usage[t.key] ?? 0), 0);
        const isMe = p.id === meId;
        const isOpen = open === p.id;
        return (
          <div key={p.id} className={`person${p.active ? "" : " inactive"}${isOpen ? " open" : ""}`}>
            <button type="button" className="prow" onClick={() => setOpen(isOpen ? null : p.id)} aria-expanded={isOpen}>
              <Avatar id={p.id} name={p.name} />
              <div className="t">
                <div className="l1">
                  {p.name}
                  {isMe ? " (you)" : ""} {p.role === "admin" ? <span className="chip admin">Admin</span> : null}
                  {!p.active ? <span className="chip">deactivated</span> : null}
                </div>
                <div className="l2">{p.email}</div>
              </div>
              <div className="pstats">
                <span className="num big">
                  {total - used}
                  <small> / {total}</small>
                </span>
                <span className="hint">days left</span>
              </div>
              <span className="caret" aria-hidden>
                {isOpen ? "▴" : "▾"}
              </span>
            </button>
            {isOpen ? (
              <div className="pdetail">
                <div className="pgrid">
                  <div className="pcard">
                    <h3>Allowances</h3>
                    <div className="hint">Blank means the default for that type.</div>
                    {types.map((t) => {
                      const ov = typeof p.allowances?.[t.key] === "number";
                      return (
                        <form action={setAllowance} className="arow" key={t.key} style={{ ["--c" as string]: typeColorVar(t.colorIndex) }}>
                          <input type="hidden" name="userId" value={p.id} />
                          <input type="hidden" name="type" value={t.key} />
                          <span className="tname">
                            <i className="dot" />
                            {t.label}
                          </span>
                          <span className="num hint">{p.usage[t.key] ?? 0} used</span>
                          <AutoSubmitInput
                            type="number"
                            name="value"
                            min={0}
                            step={0.5}
                            defaultValue={ov ? p.allowances![t.key] : ""}
                            placeholder={String(t.days)}
                            aria-label={`${t.label} allowance for ${p.name}`}
                          />
                          <span className="hint">of {p.allowance[t.key]}</span>
                        </form>
                      );
                    })}
                  </div>
                  <div className="pcard">
                    <h3>Access</h3>
                    {isMe ? (
                      <div className="hint">You cannot change your own role or deactivate yourself.</div>
                    ) : (
                      <>
                        <form action={setRole} className="inline">
                          <input type="hidden" name="userId" value={p.id} />
                          <label className="hint" htmlFor={`role-${p.id}`}>
                            Role
                          </label>
                          <AutoSubmitSelect id={`role-${p.id}`} name="role" defaultValue={p.role}>
                            <option value="member">member</option>
                            <option value="admin">admin</option>
                          </AutoSubmitSelect>
                        </form>
                        <div className="inline">
                          {pwFor === p.id ? (
                            <form action={setUserPassword} className="inline" onSubmit={() => setPwFor(null)}>
                              <input type="hidden" name="userId" value={p.id} />
                              <input
                                type="text"
                                name="password"
                                minLength={8}
                                required
                                placeholder="new password"
                                autoComplete="off"
                                aria-label={`New password for ${p.name}`}
                              />
                              <button className="btn sm primary" type="submit">
                                Set
                              </button>
                              <button className="btn sm" type="button" onClick={() => setPwFor(null)}>
                                Cancel
                              </button>
                            </form>
                          ) : (
                            <button className="btn sm" type="button" onClick={() => setPwFor(p.id)}>
                              Reset password
                            </button>
                          )}
                          {p.active && confirmFor !== p.id ? (
                            <button className="btn sm bad" type="button" onClick={() => setConfirmFor(p.id)}>
                              Deactivate
                            </button>
                          ) : p.active ? (
                            <form action={setActive} className="inline confirm">
                              <input type="hidden" name="userId" value={p.id} />
                              <input type="hidden" name="active" value="0" />
                              <span>Deactivate {p.name.split(" ")[0]}? They will not be able to sign in.</span>
                              <button className="btn sm bad" type="submit">
                                Yes, deactivate
                              </button>
                              <button className="btn sm" type="button" onClick={() => setConfirmFor(null)}>
                                No
                              </button>
                            </form>
                          ) : (
                            <form action={setActive}>
                              <input type="hidden" name="userId" value={p.id} />
                              <input type="hidden" name="active" value="1" />
                              <button className="btn sm good" type="submit">
                                Reactivate
                              </button>
                            </form>
                          )}
                        </div>
                        <div className="hint">Deactivated people keep their history but cannot sign in.</div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
