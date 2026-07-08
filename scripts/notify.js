'use strict';
/* Clive's scheduled nudges.
   Reads fitness-data.json, works out which reminders apply for "today"
   (Europe/London), and posts them to Slack in Clive's voice.
   Run by .github/workflows/clive-notify.yml on a daily schedule.
   Set DRY_RUN=1 to print instead of posting. */

const fs = require('fs');
const path = require('path');

const WEBHOOK = process.env.SLACK_WEBHOOK_URL || '';
const DRY = process.env.DRY_RUN === '1' || !WEBHOOK;
const ICON = 'https://jbutcher24.github.io/fitness-os/assets/icon-192.png';

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fitness-data.json'), 'utf8'));

const DAY = 86400000;
const parseD = (iso) => { const [y, m, d] = String(iso).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const daysBetween = (a, b) => Math.round((b - a) / DAY);
const fmtDate = (iso) => parseD(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

// "today" and weekday in Europe/London, regardless of the runner's timezone
const todayISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const today = parseD(todayISO);
const weekday = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'long' }).format(new Date());

// ---- data ----
const wis = (data.weighIns || []).filter((w) => w && w.date && w.weightLb != null).sort((a, b) => parseD(a.date) - parseD(b.date));
const latest = wis[wis.length - 1];
const prev = wis[wis.length - 2];
const todayWeigh = wis.find((w) => w.date === todayISO);

const sessions = (data.sessions || []).slice().sort((a, b) => parseD(a.date) - parseD(b.date) || (a.id || 0) - (b.id || 0));
const completed = sessions.filter((s) => s.status !== 'in-progress');
const lastC = completed[completed.length - 1];
const maxGap = (data.planned && data.planned.maxDaysBetweenSessions) || 3;
const gapDays = lastC ? daysBetween(parseD(lastC.date), today) : null;

const goalW = data.goal && data.goal.targetWeightLb;
const milestones = data.milestones || [];

const lines = [];

// 1) Morning weigh-in
if (!todayWeigh) {
  const since = latest ? daysBetween(parseD(latest.date), today) : null;
  if (since != null && since > 1) {
    lines.push(`No weigh-in today — and it's been ${since} days since the last (${fmtDate(latest.date)}). Stand on the scale. The trend can't read your mind.`);
  } else {
    lines.push(`Morning. No weigh-in logged yet — two minutes on the scale and we're square.`);
  }
}

// 2) Training-gap nag
if (gapDays != null && gapDays > maxGap) {
  lines.push(`${gapDays} days since session #${lastC.id}. Your rule is ${maxGap}. Book the next one today — before life books it for you.`);
}

// 3) Milestone crossed (fires the day it happens: latest weigh-in is today and it broke a milestone)
if (todayWeigh && prev) {
  milestones
    .filter((m) => m.weightLb != null && latest.weightLb < m.weightLb && prev.weightLb >= m.weightLb)
    .forEach((m) => {
      const next = milestones
        .filter((x) => x.weightLb != null && latest.weightLb >= x.weightLb)
        .sort((a, b) => b.weightLb - a.weightLb)[0];
      lines.push(`That's you past *${m.label}* — logged and done. Enjoy it for a second.${next ? ` Next target: ${next.label}.` : ''}`);
    });
}

// 4) Weekly summary (Mondays)
if (weekday === 'Monday' && wis.length) {
  const first = wis[0];
  const span = Math.max(1, daysBetween(parseD(first.date), parseD(latest.date)));
  const ratePerWeek = ((first.weightLb - latest.weightLb) / span) * 7;
  const wkAgo = new Date(today.getTime() - 7 * DAY);
  const sessThisWeek = sessions.filter((s) => parseD(s.date) >= wkAgo).length;
  const rateTxt = wis.length >= 2 ? `${ratePerWeek >= 0 ? '−' : '+'}${Math.abs(ratePerWeek).toFixed(1)} lb/wk` : 'not enough data yet';
  const toGoal = goalW != null ? `${(latest.weightLb - goalW).toFixed(1)} lb to ${goalW}` : '';
  lines.push(`*Week in review.* Currently ${latest.weightLb.toFixed(1)} lb${toGoal ? ` (${toGoal})` : ''}. 7-day trend: ${rateTxt}. Sessions this week: ${sessThisWeek}. New week — same plan: weigh every morning, don't let the gap hit three.`);
}

async function main() {
  if (!lines.length) { console.log('No nudges for ' + todayISO + ' (' + weekday + ').'); return; }
  const text = lines.join('\n\n') + '\n\n— Clive';
  if (DRY) {
    console.log('[DRY RUN] ' + (WEBHOOK ? '' : '(no SLACK_WEBHOOK_URL set) ') + 'would post to Slack:\n\n' + text);
    return;
  }
  const res = await fetch(WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'Clive', icon_url: ICON, text }),
  });
  if (!res.ok) { console.error('Slack post failed:', res.status, await res.text()); process.exit(1); }
  console.log('Sent ' + lines.length + ' nudge(s) for ' + todayISO + '.');
}

main().catch((e) => { console.error(e); process.exit(1); });
