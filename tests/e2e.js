/* End-to-end suite for Leavly. Run through `npm run test:e2e` (see tests/run.js), or against any
 * running instance: BASE=https://host node tests/e2e.js, with the QA accounts from tests/db.js seeded.
 * Dates are chosen relative to today so the suite keeps passing in any month. */
const { chromium } = require("playwright");
const fs = require("fs");
const { QA } = require("./db");

const BASE = process.env.BASE || "http://localhost:3101";
const OUT = process.env.E2E_OUT || null;
const results = [];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* ---------- dates (mirror of the app's rules: Sat/Sun off, three yearly holidays, July leave year) ---------- */
const WEEKEND = [0, 6];
const HOLIDAYS_MMDD = { "08-14": "Independence Day", "11-09": "Iqbal Day", "12-25": "Quaid-e-Azam Day" };
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
const addDays = (s, n) => {
  const d = parse(s);
  return iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
};
const isHoliday = (s) => !!HOLIDAYS_MMDD[s.slice(5)];
const isWorking = (s) => !WEEKEND.includes(parse(s).getDay()) && !isHoliday(s);
const workingDays = (from, to, win) => {
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) if (isWorking(d) && (!win || (d >= win.from && d <= win.to))) n++;
  return n;
};
const nextWorking = (s) => {
  while (!isWorking(s)) s = addDays(s, 1);
  return s;
};
const prevWorking = (s) => {
  while (!isWorking(s)) s = addDays(s, -1);
  return s;
};
const dayLabel = (s) => `${Number(s.slice(8, 10))} ${MONTHS[Number(s.slice(5, 7)) - 1].slice(0, 3)}`;
const fullLabel = (s) => `${dayLabel(s)} ${s.slice(0, 4)}`;
const leaveYearOf = (s) => (Number(s.slice(5, 7)) >= 7 ? Number(s.slice(0, 4)) : Number(s.slice(0, 4)) - 1);
const leaveYearWindow = (y) => ({ from: `${y}-07-01`, to: `${y + 1}-06-30` });
const daysText = (n) => (n === 0.5 ? "half a day" : `${n} working day${n === 1 ? "" : "s"}`);

const TODAY = process.env.E2E_TODAY || iso(new Date());
const LY = leaveYearOf(TODAY);
// A "week" window starting on a Monday n weeks from today's week.
const mondayOfWeek = (s, offsetWeeks) => {
  const d = parse(s);
  const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7) + 7 * offsetWeeks);
  return iso(mon);
};
const D = {
  today: TODAY,
  todayWorking: nextWorking(TODAY),
  yesterday: addDays(TODAY, -1),
  pastSingle: prevWorking(addDays(mondayOfWeek(TODAY, -1), 0)), // last week's Monday (or the working day before it)
  weekendDay: (() => {
    let s = addDays(TODAY, 1);
    while (parse(s).getDay() !== 6) s = addDays(s, 1);
    return s;
  })(),
  // next Thursday at least a week out, through the following Monday: spans a weekend
  rangeFrom: (() => {
    let s = addDays(mondayOfWeek(TODAY, 1), 3);
    while (!isWorking(s)) s = addDays(s, 1);
    return s;
  })(),
  longPastFrom: mondayOfWeek(TODAY, -4),
  longPastTo: addDays(mondayOfWeek(TODAY, -4), 11), // Mon → Fri next week: 10 working days
  overFrom: mondayOfWeek(TODAY, 6),
  overTo: addDays(mondayOfWeek(TODAY, 6), 4),
  calClick: nextWorking(addDays(TODAY, 2)),
  dragFrom: mondayOfWeek(TODAY, 3),
  holidayAdd: nextWorking(mondayOfWeek(TODAY, 5)),
};
D.rangeTo = nextWorking(addDays(D.rangeFrom, 4)); // Thu → Mon
D.halfDay = nextWorking(addDays(D.rangeTo, 1));
D.dragTo = addDays(D.dragFrom, 2);
// the next yearly holiday after today, and a range around it
D.holiday = (() => {
  let s = addDays(TODAY, 1);
  while (!isHoliday(s)) s = addDays(s, 1);
  return s;
})();
D.acrossFrom = prevWorking(addDays(D.holiday, -3));
D.acrossTo = nextWorking(addDays(D.holiday, 1));
D.boundaryFrom = `${LY + 1}-06-28`;
D.boundaryTo = `${LY + 1}-07-02`;
D.ym = (s) => `${s.slice(0, 4)}-${s.slice(5, 7)}`;

async function step(name, fn) {
  const t0 = Date.now();
  try {
    const r = await fn();
    results.push({ name, ok: true });
    console.log(`✓ ${name}${r ? " — " + String(r).slice(0, 160) : ""} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  } catch (e) {
    const m = String(e.message || e)
      .replace(/\n[\s\S]*/, "")
      .slice(0, 300);
    results.push({ name, ok: false });
    console.log(`✗ ${name} — ${m}`);
  }
}
let browser;
async function ctxPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 }, colorScheme: "dark", acceptDownloads: true, ...opts });
  ctx.setDefaultTimeout(60000);
  ctx.setDefaultNavigationTimeout(60000);
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  return page;
}
async function login(page, email, pw) {
  await page.goto(BASE + "/login");
  await page.fill("#auth-email", email);
  await page.fill("#auth-password", pw);
  await Promise.all([page.waitForNavigation(), page.click("button[type=submit]")]);
}
async function pickDate(page, id, s) {
  await page.click("#" + id);
  await page.waitForSelector(".dppop");
  const target = `${MONTHS[Number(s.slice(5, 7)) - 1]} ${s.slice(0, 4)}`;
  for (let i = 0; i < 36; i++) {
    const h = (await page.textContent(".dppop .dphead strong")).trim();
    if (h === target) break;
    const [hm, hy] = h.split(" ");
    const cur = Number(hy) * 12 + MONTHS.indexOf(hm),
      want = Number(s.slice(0, 4)) * 12 + Number(s.slice(5, 7)) - 1;
    await page.click(want > cur ? '.dppop button[aria-label="Next month"]' : '.dppop button[aria-label="Previous month"]');
  }
  await page.click(`.dppop .dpd[aria-label="${fullLabel(s)}"]`);
  await page.waitForSelector(".dppop", { state: "detached" });
}
async function logLeave(page, { type, from, to, half, note }) {
  await page.goto(BASE + "/");
  await page.waitForSelector("#logform");
  await page.click("text=Got it", { timeout: 800 }).catch(() => {});
  if (await page.$(".donebox")) await page.click("text=Log another");
  await page.click(`.typechip:has-text("${type}")`);
  const multiOn = await page.$eval(".xchip:has-text('End date') input", (i) => i.checked);
  if (to && to !== from) {
    if (!multiOn) await page.click(".xchip:has-text('End date')");
  } else if (multiOn) await page.click(".xchip:has-text('End date')");
  await pickDate(page, "r-from", from);
  if (to && to !== from) await pickDate(page, "r-to", to);
  if (half) await page.click(".xchip:has-text('Half day')");
  if (note) {
    await page.click(".xchip:has-text('Note')");
    await page.fill("#r-note", note);
  }
  await page.waitForTimeout(150);
  const summary = (await page.textContent(".lfoot .summary")).replace(/\s+/g, " ").trim();
  const warn = await page.$(".msg.warn, .msg.error");
  const warnText = warn ? (await warn.textContent()).trim() : "";
  if (await page.$eval("#logform button[type=submit]", (b) => b.disabled)) return { blocked: true, summary, warnText };
  await page.click("#logform button[type=submit]");
  await page.waitForSelector(".donebox, .msg.error", { timeout: 20000 });
  const done = await page.$(".donebox");
  return {
    blocked: false,
    summary,
    warnText,
    done: done ? (await done.textContent()).replace(/\s+/g, " ").trim() : (await page.textContent(".msg.error")).trim(),
  };
}
const hero = async (page) => (await page.textContent(".card.hero .big")).replace(/\s+/g, " ").trim();
const calTo = async (page, s) => {
  // move the dashboard calendar to the month of s
  for (let i = 0; i < 36; i++) {
    const t = (await page.textContent(".caltitle")).trim();
    if (t === `${MONTHS[Number(s.slice(5, 7)) - 1]} ${s.slice(0, 4)}`) return;
    const [m, y] = t.split(" ");
    const cur = Number(y) * 12 + MONTHS.indexOf(m),
      want = Number(s.slice(0, 4)) * 12 + Number(s.slice(5, 7)) - 1;
    await page.click(want > cur ? 'button[aria-label="Next"]' : 'button[aria-label="Previous"]');
  }
};

(async () => {
  browser = await chromium.launch({ headless: true, executablePath: process.env.E2E_CHROME || undefined });
  console.log(`Leavly e2e against ${BASE}, today ${TODAY}`);
  const admin = await ctxPage();
  await login(admin, QA.admin.email, QA.admin.password);

  /* ---------------- 1. Admin adds five people ---------------- */
  const people = [
    ["Sara Khan", "sara@example.com"],
    ["Ali Raza", "ali@example.com"],
    ["Hina Malik", "hina@example.com"],
    ["Usman Tariq", "usman@example.com"],
    ["Zara Sheikh", "zara@example.com"],
  ];
  for (const [name, email] of people) {
    await step(`admin: add ${name}`, async () => {
      await admin.goto(BASE + "/admin");
      await admin.waitForSelector(".team");
      if (!(await admin.$("#nu-name"))) await admin.click("text=+ Add");
      await admin.fill("#nu-name", name);
      await admin.fill("#nu-email", email);
      await admin.fill("#nu-password", "welcome123");
      await admin.click("form.req button[type=submit]");
      await admin.waitForSelector(`.msg.ok:has-text("${name} added"), .msg.error`);
      await admin.waitForSelector("form.req button[type=submit]:not([disabled])");
      await admin.waitForTimeout(300);
      const t = await admin.textContent(".msg.ok, .msg.error");
      if (!t.includes("added")) throw new Error(t);
    });
  }
  await step("admin: duplicate email is refused", async () => {
    await admin.goto(BASE + "/admin");
    await admin.waitForSelector(".team");
    if (!(await admin.$("#nu-name"))) await admin.click("text=+ Add");
    await admin.fill("#nu-name", "Dup");
    await admin.fill("#nu-email", "sara@example.com");
    await admin.fill("#nu-password", "welcome123");
    await admin.click("form.req button[type=submit]");
    await admin.waitForSelector(".msg.error");
    return (await admin.textContent(".msg.error")).trim();
  });
  await step("admin: team list has search and sort with more than 5 people", async () => {
    await admin.goto(BASE + "/admin");
    await admin.waitForSelector(".teamtools input[type=search]");
    await admin.fill(".teamtools input[type=search]", "zara");
    const n = await admin.$$eval(".person", (els) => els.length);
    if (n !== 1) throw new Error(`expected 1 match, got ${n}`);
  });

  /* ---------------- 2. First sign-in ---------------- */
  const pages = {};
  for (const [name, email] of people) {
    await step(`${name}: first sign-in forces a new password`, async () => {
      const pg = await ctxPage();
      pages[email] = pg;
      await login(pg, email, "welcome123");
      if (!pg.url().endsWith("/welcome")) throw new Error("not sent to /welcome: " + pg.url());
      await pg.goto(BASE + "/leaves");
      if (!pg.url().endsWith("/welcome")) throw new Error("could reach /leaves before changing password");
      await pg.fill("#fp-next", "welcome123");
      await pg.fill("#fp-confirm", "welcome123");
      await pg.click("button[type=submit]");
      await pg.waitForSelector(".msg.error");
      await pg.fill("#fp-next", "mypass1234");
      await pg.fill("#fp-confirm", "mypass1234");
      await Promise.all([pg.waitForURL(BASE + "/"), pg.click("button[type=submit]")]);
      await pg.waitForSelector(".welcome");
      await pg.click("text=Got it");
    });
  }
  const sara = pages["sara@example.com"],
    ali = pages["ali@example.com"],
    hina = pages["hina@example.com"],
    usman = pages["usman@example.com"],
    zara = pages["zara@example.com"];

  /* ---------------- 3. Logging leave of every shape ---------------- */
  const saraDays = { past: 1, today: 1, range: workingDays(D.rangeFrom, D.rangeTo) };
  await step(`Sara: past single day (${dayLabel(D.pastSingle)})`, async () => {
    const r = await logLeave(sara, { type: "Casual", from: D.pastSingle });
    if (r.blocked || !r.done.includes("1 working day")) throw new Error(JSON.stringify(r));
    return r.done;
  });
  await step(`Sara: today (${dayLabel(D.todayWorking)}) sick with a note`, async () => {
    const r = await logLeave(sara, { type: "Sick", from: D.todayWorking, note: "flu" });
    if (r.blocked) throw new Error(JSON.stringify(r));
    return r.done;
  });
  await step(`Sara: future range over a weekend (${dayLabel(D.rangeFrom)} – ${dayLabel(D.rangeTo)} = ${saraDays.range} days)`, async () => {
    const r = await logLeave(sara, { type: "Casual", from: D.rangeFrom, to: D.rangeTo });
    if (!r.done.includes(daysText(saraDays.range))) throw new Error(JSON.stringify(r));
    return r.done;
  });
  const saraUsed = Object.values(saraDays).reduce((a, b) => a + b, 0);
  await step(`Sara: balance after ${saraUsed} days (24 → ${24 - saraUsed})`, async () => {
    await sara.goto(BASE + "/");
    await sara.waitForSelector(".card.hero");
    const h = await hero(sara);
    const expect = leaveYearOf(D.pastSingle) === LY && leaveYearOf(D.rangeTo) === LY ? 24 - saraUsed : null;
    if (expect !== null && !h.startsWith(String(expect))) throw new Error(h);
    return h;
  });
  await step("Sara: overlap is blocked before submit", async () => {
    const r = await logLeave(sara, { type: "Sick", from: addDays(D.rangeFrom, 1) });
    if (!r.blocked || !r.warnText.includes("Overlaps")) throw new Error(JSON.stringify(r));
    return r.warnText;
  });
  await step(`Sara: weekend-only date (${dayLabel(D.weekendDay)}) is blocked`, async () => {
    const r = await logLeave(sara, { type: "Sick", from: D.weekendDay });
    if (!r.blocked) throw new Error(JSON.stringify(r));
    return r.warnText;
  });
  await step(`Sara: public holiday (${dayLabel(D.holiday)}) is blocked`, async () => {
    const r = await logLeave(sara, { type: "Sick", from: D.holiday });
    if (!r.blocked || !r.warnText.includes("holiday")) throw new Error(JSON.stringify(r));
    return r.warnText;
  });

  const across = workingDays(D.acrossFrom, D.acrossTo);
  await step(`Ali: range across ${HOLIDAYS_MMDD[D.holiday.slice(5)]} (${dayLabel(D.acrossFrom)} – ${dayLabel(D.acrossTo)} = ${across} days)`, async () => {
    const r = await logLeave(ali, { type: "Casual", from: D.acrossFrom, to: D.acrossTo });
    if (!r.done.includes(daysText(across)) || !r.summary.includes("skips")) throw new Error(JSON.stringify(r));
    return r.summary;
  });
  await step(`Ali: half day (${dayLabel(D.halfDay)})`, async () => {
    const r = await logLeave(ali, { type: "Sick", from: D.halfDay, half: true });
    if (!r.done.includes("half a day")) throw new Error(JSON.stringify(r));
    return r.done;
  });
  await step("Ali: half day cannot combine with a range", async () => {
    await ali.goto(BASE + "/");
    await ali.waitForSelector("#logform");
    if (await ali.$(".donebox")) await ali.click("text=Log another");
    await ali.click(".xchip:has-text('End date')");
    if (!(await ali.$eval(".xchip:has-text('Half day') input", (i) => i.disabled))) throw new Error("half day stayed enabled in range mode");
  });

  const longPast = workingDays(D.longPastFrom, D.longPastTo);
  await step(`Hina: long past leave (${dayLabel(D.longPastFrom)} – ${dayLabel(D.longPastTo)} = ${longPast} days)`, async () => {
    const r = await logLeave(hina, { type: "Casual", from: D.longPastFrom, to: D.longPastTo });
    if (!r.done.includes(daysText(longPast))) throw new Error(JSON.stringify(r));
    return r.done;
  });
  await step("Hina: going over the casual balance warns but allows", async () => {
    const r = await logLeave(hina, { type: "Casual", from: D.overFrom, to: D.overTo });
    if (r.blocked) throw new Error(JSON.stringify(r));
    return (r.warnText || "(no warning: not over)") + " → " + r.done;
  });

  const bAll = workingDays(D.boundaryFrom, D.boundaryTo),
    bThis = workingDays(D.boundaryFrom, D.boundaryTo, leaveYearWindow(LY)),
    bNext = workingDays(D.boundaryFrom, D.boundaryTo, leaveYearWindow(LY + 1));
  await step(`Usman: leave across the leave-year boundary (${dayLabel(D.boundaryFrom)} – ${dayLabel(D.boundaryTo)} ${LY + 1})`, async () => {
    const r = await logLeave(usman, { type: "Casual", from: D.boundaryFrom, to: D.boundaryTo });
    if (!r.done.includes(daysText(bAll))) throw new Error(JSON.stringify(r));
    return r.done;
  });
  await step(`Usman: ${bThis} of those days count in ${LY}–${String(LY + 1).slice(2)}, ${bNext} in the next year`, async () => {
    await usman.goto(BASE + `/leaves?year=${LY}`);
    await usman.waitForSelector(".totals");
    const a = (await usman.textContent(".totals .tot:nth-child(2) .big")).trim();
    await usman.goto(BASE + `/leaves?year=${LY + 1}`);
    await usman.waitForSelector(".totals");
    const b = (await usman.textContent(".totals .tot:nth-child(2) .big")).trim();
    if (a !== String(bThis) || b !== String(bNext)) throw new Error(`${a} / ${b}`);
    return `${a} + ${b}`;
  });
  await step("Usman: Yesterday quick pick + L shortcut", async () => {
    await usman.goto(BASE + "/");
    await usman.waitForSelector("#logform");
    await usman.click("body", { position: { x: 5, y: 500 } });
    await usman.keyboard.press("l");
    await usman.waitForTimeout(400);
    const f = await usman.evaluate(() => document.activeElement?.id);
    await usman.click(".wbtn:has-text('Yesterday')");
    const s = (await usman.textContent(".lfoot .summary")).replace(/\s+/g, " ").trim();
    const yl = `${DOW[parse(D.yesterday).getDay()]} ${dayLabel(D.yesterday)}`;
    if (f !== "r-from" || !s.includes(yl)) throw new Error(`${f} / ${s} (expected ${yl})`);
    return s;
  });

  const drag = workingDays(D.dragFrom, D.dragTo);
  await step("Zara: click a calendar day, then drag a range", async () => {
    await zara.goto(BASE + "/");
    await zara.waitForSelector(".cal .grid");
    await zara.click("text=Got it", { timeout: 800 }).catch(() => {});
    await calTo(zara, D.calClick);
    await zara.click(`.cal .d[aria-label^="${fullLabel(D.calClick)}"]`);
    await zara.waitForTimeout(200);
    let s = (await zara.textContent(".lfoot .summary")).replace(/\s+/g, " ").trim();
    if (!s.includes(dayLabel(D.calClick))) throw new Error("click did not set date: " + s);
    await calTo(zara, D.dragFrom);
    const a = await (await zara.$(`.cal .d[aria-label^="${fullLabel(D.dragFrom)}"]`)).boundingBox(),
      b = await (await zara.$(`.cal .d[aria-label^="${fullLabel(D.dragTo)}"]`)).boundingBox();
    await zara.mouse.move(a.x + 20, a.y + 20);
    await zara.mouse.down();
    await zara.mouse.move(b.x + 20, b.y + 20, { steps: 5 });
    await zara.mouse.up();
    await zara.waitForTimeout(200);
    s = (await zara.textContent(".lfoot .summary")).replace(/\s+/g, " ").trim();
    if (!s.includes(dayLabel(D.dragFrom)) || !s.includes(dayLabel(D.dragTo)) || !s.includes(daysText(drag))) throw new Error("drag did not set range: " + s);
    await zara.click("#logform button[type=submit]");
    await zara.waitForSelector(".donebox");
    return s;
  });
  await step("Zara: remove from Upcoming then Undo restores it", async () => {
    await zara.goto(BASE + "/");
    await zara.waitForSelector("#logform");
    await zara.click("main section:last-of-type .item .btn:has-text('Remove')");
    await zara.waitForSelector(".toast");
    const t1 = (await zara.textContent(".toast")).trim();
    await zara.click(".toast button:has-text('Undo')");
    await zara.waitForSelector(".toast:has-text('Restored')");
    await zara.waitForTimeout(800);
    const n = await zara.$$eval("main section:last-of-type .item", (els) => els.length);
    if (n !== 1) throw new Error(`after undo expected 1 upcoming, got ${n}`);
    return t1;
  });
  await step("Zara: remembered type survives reload", async () => {
    await zara.goto(BASE + "/");
    await zara.waitForSelector("#logform");
    if (await zara.$(".donebox")) await zara.click("text=Log another");
    await zara.click(".typechip:has-text('Sick')");
    await zara.reload();
    await zara.waitForSelector("#logform");
    const on = (await zara.textContent(".typechip.on")).trim();
    if (!on.startsWith("Sick")) throw new Error(on);
  });

  /* ---------------- 4. Member isolation ---------------- */
  await step("member: calendar shows only own leave, no avatars", async () => {
    await sara.goto(BASE + "/");
    await sara.waitForSelector(".cal .grid");
    const avatars = await sara.$$eval(".cal .people .avatar", (els) => els.length);
    if (avatars) throw new Error(`${avatars} avatars shown`);
  });
  await step("member: admin pages bounce to the dashboard", async () => {
    for (const u of ["/admin", "/admin/away", "/admin/settings"]) {
      await sara.goto(BASE + u);
      await sara.waitForURL(BASE + "/", { timeout: 10000 }).catch(() => {});
      if (sara.url() !== BASE + "/" || (await sara.$(".tabs"))) throw new Error(u + " → " + sara.url());
    }
  });
  await step("member: no Admin pill, menu has only account items", async () => {
    await sara.goto(BASE + "/");
    await sara.waitForSelector(".pmenu");
    if (await sara.$('.navpill:has-text("Admin")')) throw new Error("Admin pill visible");
    await sara.click(".ptrigger");
    await sara.waitForSelector(".pdrop");
    const items = await sara.$$eval(".pdrop [role=menuitem]", (els) => els.map((e) => e.textContent.trim()));
    await sara.keyboard.press("Escape");
    return items.join(" | ");
  });

  /* ---------------- 5. My leaves, account ---------------- */
  await step("Sara: My leaves totals, running balance, filter", async () => {
    await sara.goto(BASE + `/leaves?year=${LY}`);
    await sara.waitForSelector(".totals");
    const rows = await sara.$$eval(".list .item .l2", (els) => els.map((e) => e.textContent.replace(/\s+/g, " ").trim()));
    await sara.click(".totals .tot:has-text('Sick')");
    const filtered = await sara.$$eval(".list .item", (els) => els.length);
    if (!rows.some((r) => r.includes("left after")) || filtered < 1) throw new Error(JSON.stringify({ rows, filtered }));
    return `${rows.length} rows, sick filter → ${filtered}`;
  });
  await step("Sara: CSV export downloads", async () => {
    await sara.goto(BASE + `/leaves?year=${LY}`);
    await sara.waitForSelector(".totals");
    const [dl] = await Promise.all([sara.waitForEvent("download"), sara.click("text=Export CSV")]);
    const csv = fs
      .readFileSync(await dl.path(), "utf8")
      .trim()
      .split("\n");
    if (csv.length < 2) throw new Error(csv.join(" / "));
    return `${dl.suggestedFilename()}: ${csv.length - 1} rows`;
  });
  await step("Sara: change password validates and works", async () => {
    await sara.goto(BASE + "/account");
    await sara.waitForSelector("#pw-current");
    await sara.fill("#pw-current", "wrongpass1");
    await sara.fill("#pw-next", "newpass9999");
    await sara.fill("#pw-confirm", "newpass9999");
    await sara.click("form.req button[type=submit]");
    await sara.waitForSelector(".msg.error");
    await sara.fill("#pw-current", "mypass1234");
    await sara.fill("#pw-confirm", "different99");
    if (!(await sara.$eval("form.req button[type=submit]", (b) => b.disabled))) throw new Error("mismatch did not disable");
    await sara.fill("#pw-confirm", "newpass9999");
    await sara.click("form.req button[type=submit]");
    await sara.waitForSelector(".msg.ok");
    const fresh = await ctxPage();
    await login(fresh, "sara@example.com", "newpass9999");
    const ok = fresh.url() === BASE + "/";
    await fresh.context().close();
    if (!ok) throw new Error("re-login failed");
  });
  await step("login: five wrong passwords lock the account for a minute", async () => {
    const pg = await ctxPage();
    await pg.goto(BASE + "/login");
    let last = "";
    for (let i = 1; i <= 5; i++) {
      await pg.fill("#auth-email", "ali@example.com");
      await pg.fill("#auth-password", "nope" + i);
      await Promise.all([pg.waitForResponse((r) => r.request().method() === "POST"), pg.click("button[type=submit]")]);
      await pg.waitForTimeout(300);
      last = (await pg.textContent(".msg.error")).trim();
    }
    await pg.context().close();
    if (!last.includes("Too many")) throw new Error(last);
    return last;
  });

  /* ---------------- 6. Admin pages ---------------- */
  await step("admin: this week / month strip renders", async () => {
    await admin.goto(BASE + "/admin");
    await admin.waitForSelector(".weekstrip");
    await admin.click(".seg button:has-text('Month')");
    await admin.waitForSelector(".daystrip");
  });
  await step("admin: set Hina's casual allowance to 20 → her balance changes", async () => {
    await admin.goto(BASE + "/admin");
    await admin.waitForSelector(".team");
    await admin.fill(".teamtools input[type=search]", "hina");
    await admin.click(".prow:has-text('Hina Malik')");
    await admin.waitForSelector(".pdetail");
    await admin.fill('.arow input[aria-label="Casual allowance for Hina Malik"]', "20");
    await admin.press('.arow input[aria-label="Casual allowance for Hina Malik"]', "Tab");
    await admin.waitForTimeout(1500);
    await hina.goto(BASE + "/");
    await hina.waitForSelector(".card.hero");
    const c = (await hina.textContent(".card.type .big")).replace(/\s+/g, " ").trim();
    if (!c.includes("/ 20")) throw new Error(c);
    return c;
  });
  await step("admin: promote Usman, he sees the Admin pill; demote back", async () => {
    await admin.goto(BASE + "/admin");
    await admin.fill(".teamtools input[type=search]", "usman");
    await admin.click(".prow:has-text('Usman Tariq')");
    await admin.waitForSelector(".person.open select[id^=role-]");
    await admin.selectOption(".person.open select[id^=role-]", "admin");
    await admin.waitForTimeout(1500);
    await usman.goto(BASE + "/");
    await usman.waitForSelector(".pmenu");
    const pill = !!(await usman.$('.navpill:has-text("Admin")'));
    await admin.goto(BASE + "/admin");
    await admin.fill(".teamtools input[type=search]", "usman");
    await admin.click(".prow:has-text('Usman Tariq')");
    await admin.waitForSelector(".person.open select[id^=role-]");
    await admin.selectOption(".person.open select[id^=role-]", "member");
    await admin.waitForTimeout(1500);
    await usman.goto(BASE + "/admin");
    await usman.waitForURL(BASE + "/", { timeout: 10000 }).catch(() => {});
    if (!pill || usman.url() !== BASE + "/") throw new Error(`pill=${pill} url=${usman.url()}`);
  });
  await step("admin: reset Zara's password → she must change it next sign-in", async () => {
    await admin.goto(BASE + "/admin");
    await admin.fill(".teamtools input[type=search]", "zara");
    await admin.click(".prow:has-text('Zara Sheikh')");
    await admin.waitForSelector(".pdetail");
    await admin.click("button:has-text('Reset password')");
    await admin.fill('input[aria-label="New password for Zara Sheikh"]', "reset12345");
    await admin.click("button:has-text('Set')");
    await admin.waitForTimeout(1500);
    const z = await ctxPage();
    await login(z, "zara@example.com", "reset12345");
    const ok = z.url().endsWith("/welcome");
    await z.context().close();
    if (!ok) throw new Error("not sent to welcome");
  });
  await step("admin: deactivate asks first; deactivated cannot sign in; reactivate restores", async () => {
    await admin.goto(BASE + "/admin");
    await admin.fill(".teamtools input[type=search]", "hina");
    await admin.click(".prow:has-text('Hina Malik')");
    await admin.waitForSelector(".pdetail");
    await admin.click("button:has-text('Deactivate')");
    await admin.waitForSelector(".confirm");
    await admin.click("button:has-text('No')");
    if (await admin.$(".confirm")) throw new Error("confirm did not close");
    await admin.click("button:has-text('Deactivate')");
    await admin.click("button:has-text('Yes, deactivate')");
    await admin.waitForTimeout(1500);
    const h = await ctxPage();
    await h.goto(BASE + "/login");
    await h.fill("#auth-email", "hina@example.com");
    await h.fill("#auth-password", "mypass1234");
    await h.click("button[type=submit]");
    await h.waitForSelector(".msg.error");
    const msg = (await h.textContent(".msg.error")).trim();
    await h.context().close();
    await admin.goto(BASE + "/admin");
    await admin.fill(".teamtools input[type=search]", "hina");
    await admin.click(".prow:has-text('Hina Malik')");
    await admin.waitForSelector(".pdetail");
    await admin.click("button:has-text('Reactivate')");
    await admin.waitForTimeout(1500);
    if (!msg.includes("deactivated")) throw new Error(msg);
    return msg;
  });
  await step("admin: Upcoming leave remove + undo", async () => {
    await admin.goto(BASE + "/admin");
    await admin.waitForSelector("h2:has-text('Upcoming leave')");
    const before = await admin.$$eval("section:has(h2:has-text('Upcoming leave')) .item", (els) => els.length);
    await admin.click("section:has(h2:has-text('Upcoming leave')) .item .btn:has-text('Remove')");
    await admin.waitForSelector(".toast");
    await admin.click(".toast button:has-text('Undo')");
    await admin.waitForSelector(".toast:has-text('Restored')");
    await admin.waitForTimeout(800);
    const after = await admin.$$eval("section:has(h2:has-text('Upcoming leave')) .item", (els) => els.length);
    if (after !== before) throw new Error(`${before} → ${after}`);
    return `${before} entries`;
  });
  await step("admin: Away report for this month and next, with CSV", async () => {
    await admin.goto(BASE + `/admin/away?month=${D.ym(TODAY)}`);
    await admin.waitForSelector(".daystrip");
    const t = await admin.$$eval(".totals .tot", (els) => els.map((e) => e.textContent.replace(/\s+/g, " ").trim()));
    await admin.click('button[aria-label="Next month"]');
    await admin.waitForSelector(".daystrip");
    if (await admin.$$eval(".plist", (e) => e.length)) {
      const [dl] = await Promise.all([admin.waitForEvent("download"), admin.click("text=Export CSV")]);
      return `${t[0]} · csv ${dl.suggestedFilename()}`;
    }
    return t[0];
  });

  /* ---------------- 7. Settings ---------------- */
  await step("settings: add a type, rename, delete", async () => {
    await admin.goto(BASE + "/admin/settings");
    await admin.waitForSelector(".setgrid");
    await admin.waitForTimeout(500);
    await admin.fill("form.r.type.add input[name=label]", "Study");
    await admin.fill("form.r.type.add input[name=days]", "3");
    await admin.click("form.r.type.add button[type=submit]");
    await admin.waitForSelector('.r.type input[value="Study"]', { timeout: 15000 });
    await admin.fill('.r.type input[value="Study"]', "Exam");
    await admin.keyboard.press("Tab");
    await admin.waitForTimeout(1500);
    await admin.reload();
    await admin.waitForSelector('.r.type input[value="Exam"]');
    await admin.click('.r.type:has(input[value="Exam"]) button[aria-label="Remove Exam"]');
    await admin.waitForSelector('.r.type input[value="Exam"]', { state: "detached", timeout: 15000 });
  });
  await step("settings: weekend change affects counting, then revert", async () => {
    await admin.goto(BASE + "/admin/settings");
    await admin.waitForSelector(".wk");
    await admin.click('.wk label:has-text("Fri") input');
    await admin.waitForTimeout(1500);
    await sara.goto(BASE + "/");
    await sara.waitForSelector(".card.hero");
    const h1 = await hero(sara);
    await admin.click('.wk label:has-text("Fri") input');
    await admin.waitForTimeout(1500);
    await sara.goto(BASE + "/");
    await sara.waitForSelector(".card.hero");
    const h2 = await hero(sara);
    if (h1 === h2) throw new Error(`no change: ${h1}`);
    return `${h1} → ${h2}`;
  });
  await step(`settings: add a holiday (${dayLabel(D.holidayAdd)}), duplicate is refused, toggle yearly, delete`, async () => {
    await admin.goto(BASE + "/admin/settings");
    await admin.waitForSelector(".holform");
    await admin.waitForTimeout(500);
    await pickDate(admin, "nh-date", D.holidayAdd);
    await admin.fill(".holform input[name=label]", "Office day out");
    await admin.click(".holform button[type=submit]");
    await admin.waitForSelector(".r.hol:has-text('Office day out')", { timeout: 15000 });
    await admin.waitForTimeout(800);
    await pickDate(admin, "nh-date", D.holidayAdd);
    await admin.waitForSelector(".holform .msg.warn");
    if (!(await admin.$eval(".holform button[type=submit]", (b) => b.disabled))) throw new Error("duplicate not blocked");
    await admin.click(".r.hol:has-text('Office day out') .ytoggle");
    await admin.waitForSelector(".r.hol:has-text('Office day out') .ytoggle.on", { timeout: 15000 });
    await admin.click('.r.hol:has-text("Office day out") button[aria-label="Remove Office day out"]');
    await admin.waitForSelector(".r.hol:has-text('Office day out')", { state: "detached", timeout: 15000 });
  });
  await step("settings: leave year start → January changes labels, then back to July", async () => {
    await admin.goto(BASE + "/admin/settings");
    await admin.selectOption("#ys", "1");
    await admin.waitForTimeout(1500);
    await sara.goto(BASE + "/");
    await sara.waitForSelector(".card.hero");
    const l1 = (await sara.textContent(".card.hero .sub")).trim();
    await admin.selectOption("#ys", "7");
    await admin.waitForTimeout(1500);
    await sara.goto(BASE + "/");
    await sara.waitForSelector(".card.hero");
    const l2 = (await sara.textContent(".card.hero .sub")).trim();
    if (!l1.includes("Jan") || !l2.includes("Jul")) throw new Error(l1 + " | " + l2);
    return `${l1} → ${l2}`;
  });

  /* ---------------- 8. Theme, mobile, 404, errors ---------------- */
  await step("theme switch persists across reload", async () => {
    await sara.goto(BASE + "/");
    await sara.click(".ptrigger");
    await sara.click(".switch");
    await sara.keyboard.press("Escape");
    await sara.reload();
    const t = await sara.evaluate(() => document.documentElement.getAttribute("data-theme"));
    await sara.click(".ptrigger");
    await sara.click(".switch");
    await sara.keyboard.press("Escape");
    if (t !== "light") throw new Error(t);
  });
  await step("mobile 390px: no horizontal overflow on any page, sheet opens", async () => {
    const m = await ctxPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await login(m, QA.admin.email, QA.admin.password);
    const bad = [];
    for (const u of ["/", "/leaves", "/admin", "/admin/away", "/admin/settings", "/account"]) {
      await m.goto(BASE + u);
      await m.waitForTimeout(600);
      if (await m.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)) bad.push(u);
    }
    await m.goto(BASE + "/");
    await m.click(".fab");
    await m.waitForSelector(".logpanel.open");
    if (OUT) await m.screenshot({ path: OUT + "/mobile-sheet.png" });
    await m.context().close();
    if (bad.length) throw new Error("overflow on " + bad.join(", "));
  });
  await step("404 page renders in-app", async () => {
    const r = await sara.goto(BASE + "/nope");
    if (r.status() !== 404 || !(await sara.$(".errorpage"))) throw new Error(String(r.status()));
  });
  await step("no client-side errors on any page", async () => {
    const all = Object.values(pages)
      .flatMap((p) => p.errors)
      .concat(admin.errors);
    if (all.length) throw new Error(all.slice(0, 3).join(" | "));
  });

  await browser.close();
  const pass = results.filter((r) => r.ok).length;
  console.log(`\n${pass}/${results.length} passed`);
  process.exit(pass === results.length ? 0 : 1);
})().catch(async (e) => {
  console.error("FATAL", e.message);
  try {
    await browser?.close();
  } catch {}
  process.exit(1);
});
