/**
 * Send an ecosystem event notification email via Resend.
 * This file is a Node.js sender script, not a Resend dashboard template.
 * Do not paste this TypeScript file into the Resend template editor.
 * For a single reusable Resend dashboard template, use emails/resend-news-template.html.
 *
 * Usage:
 *   npx tsx scripts/send-event-email.ts <event-id> [--to email1,email2]
 *   npx tsx scripts/send-event-email.ts <event-id> --write
 *   npx tsx scripts/send-event-email.ts --write-all
 *
 * Examples:
 *   npx tsx scripts/send-event-email.ts megacorp-drone-minting
 *   npx tsx scripts/send-event-email.ts megacorp-drone-minting --to alice@example.com,bob@example.com
 *   npx tsx scripts/send-event-email.ts --list            # list all event ids
 *   npx tsx scripts/send-event-email.ts <event-id> --preview   # write HTML to stdout, no send
 *   npx tsx scripts/send-event-email.ts <event-id> --write     # save a paste-ready HTML file
 *   npx tsx scripts/send-event-email.ts --write-all            # save paste-ready HTML for every event
 *
 * Environment:
 *   RESEND_API_KEY  – your Resend API key
 *   RESEND_FROM_ADDRESS – optional sender override for Resend (defaults to onboarding sender)
 *   EVENT_RECIPIENTS – comma-separated fallback recipient list
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import rawProjects from '../src/data/projects.json';
import { APP_EVENTS, type AppEvent } from '../src/data/appEvents';
import { Resend } from 'resend';

// ── Configuration ─────────────────────────────────────────────
const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';
const FROM_ADDRESS   = process.env.RESEND_FROM_ADDRESS ?? 'Megabunnish <onboarding@resend.dev>';
const BASE_URL       = (process.env.EVENTS_BASE_URL ?? '').replace(/\/$/, '');
const UNSUBSCRIBE_URL = process.env.EVENTS_UNSUBSCRIBE_URL ?? '';
const MEGABUNNISH_SYMBOL_URL = BASE_URL ? `${BASE_URL}/logos/Megabunnish.webp` : '';
const ECOSYSTEM_MAP_URL = BASE_URL ? `${BASE_URL}/Twittercard.png` : '';
const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));
const DEFAULT_EXPORT_DIR = 'emails/paste-ready';

// ── Load project data ─────────────────────────────────────────
type Project = { id: string; name: string; links?: { site?: string; twitter?: string }; logo?: string };
type Phase = AppEvent['phases'][number];
type RenderMode = 'preview' | 'send';
type IsoParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  offsetLabel: string;
};
type Attachment = {
  filename: string;
  content: Buffer;
  contentType: string;
  contentId: string;
};
type HtmlAssetSources = {
  ecosystemMapSrc: string;
  megabunnishSymbolSrc: string;
  projectLogoSrc: string;
};
type PreparedAssets = {
  attachments: Attachment[];
  sources: HtmlAssetSources;
};

const projects = rawProjects as Project[];
const projectById = new Map(projects.map((p) => [p.id, p]));
const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC'
});

// ── Helpers ───────────────────────────────────────────────────
function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function extractHandle(url: string): string {
  const match = url.match(/(?:x|twitter)\.com\/([^/?#]+)/i);
  return match?.[1] ?? url;
}

function publicAssetPath(assetPath: string): string {
  const normalized = assetPath.startsWith('/') ? assetPath : `/${assetPath}`;
  return fileURLToPath(new URL(`../public${normalized}`, import.meta.url));
}

function resolveCliPath(target: string): string {
  return isAbsolute(target) ? target : resolve(PROJECT_ROOT, target);
}

function getContentType(assetPath: string): string {
  switch (extname(assetPath).toLowerCase()) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.svg':
      return 'image/svg+xml';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    default:
      return 'application/octet-stream';
  }
}

function buildDataUri(contentType: string, content: Buffer): string {
  return `data:${contentType};base64,${content.toString('base64')}`;
}

function parseIsoParts(iso: string): IsoParts {
  const match = iso.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:\d{2})?$/
  );

  if (!match) {
    throw new Error(`Unsupported ISO datetime: ${iso}`);
  }

  const [, year, month, day, hour, minute, second = '00', offset = ''] = match;
  const offsetLabel = offset === 'Z' ? 'UTC' : offset ? `UTC${offset}` : '';

  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
    offsetLabel
  };
}

function sameLocalDate(a: string, b: string): boolean {
  const first = parseIsoParts(a);
  const second = parseIsoParts(b);
  return first.year === second.year && first.month === second.month && first.day === second.day;
}

function formatDateFromParts(parts: IsoParts): string {
  return DATE_FORMATTER.format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day)));
}

function formatClock(parts: IsoParts): string {
  const normalizedHour = parts.hour % 12 || 12;
  const meridiem = parts.hour >= 12 ? 'PM' : 'AM';
  return `${String(normalizedHour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')} ${meridiem}`;
}

function formatTimeRange(startIso: string, endIso: string): string {
  const start = parseIsoParts(startIso);
  const end = parseIsoParts(endIso);
  const base = `${formatClock(start)} - ${formatClock(end)}`;

  if (start.offsetLabel && start.offsetLabel === end.offsetLabel) {
    return `${base} ${start.offsetLabel}`;
  }

  if (!start.offsetLabel && !end.offsetLabel) {
    return base;
  }

  return `${formatTime(startIso)} - ${formatTime(endIso)}`;
}

function formatCalendarDateTime(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function formatCalendarDateValue(iso: string): string {
  const parts = parseIsoParts(iso);
  return `${parts.year}${String(parts.month).padStart(2, '0')}${String(parts.day).padStart(2, '0')}`;
}

function addDaysToCalendarDate(iso: string, days: number): string {
  const parts = parseIsoParts(iso);
  const nextDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return nextDate.toISOString().slice(0, 10).replace(/-/g, '');
}

function readFlagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1 || index === args.length - 1) {
    return undefined;
  }

  const value = args[index + 1];
  return value.startsWith('--') ? undefined : value;
}

function getPositionalArgs(args: string[]): string[] {
  const flagsWithValues = new Set(['--to', '--output', '--output-dir']);
  const positional: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (flagsWithValues.has(arg)) {
      index += 1;
      continue;
    }

    if (!arg.startsWith('--')) {
      positional.push(arg);
    }
  }

  return positional;
}

function resolveExportDir(outputDir?: string): string {
  return resolveCliPath(outputDir ?? DEFAULT_EXPORT_DIR);
}

function resolveExportPath(eventId: string, outputPath?: string, outputDir?: string): string {
  if (outputPath) {
    return resolveCliPath(outputPath);
  }

  return resolve(resolveExportDir(outputDir), `${eventId}.html`);
}

function writePasteReadyHtml(outputPath: string, html: string): string {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, html, 'utf8');
  return outputPath;
}

function loadEmailImageAsset(
  assetPath: string,
  fallbackUrl: string,
  contentId: string,
  mode: RenderMode
): { attachment: Attachment | null; src: string } {
  const localPath = publicAssetPath(assetPath);

  if (!existsSync(localPath)) {
    return {
      attachment: null,
      src: fallbackUrl
    };
  }

  const content = readFileSync(localPath);
  const contentType = getContentType(localPath);

  return {
    attachment: {
      filename: basename(localPath),
      content,
      contentType,
      contentId
    },
    src: mode === 'send' ? `cid:${contentId}` : buildDataUri(contentType, content)
  };
}

function prepareAssets(project: Project, mode: RenderMode): PreparedAssets {
  const projectLogoPath = project.logo ?? '/logos/MegaETH.webp';

  const ecosystemMap = loadEmailImageAsset('/Twittercard.png', ECOSYSTEM_MAP_URL, 'ecosystem-map', mode);
  const megabunnishSymbol = loadEmailImageAsset('/logos/Megabunnish.webp', MEGABUNNISH_SYMBOL_URL, 'megabunnish-symbol', mode);
  const projectLogo = loadEmailImageAsset(
    projectLogoPath,
    BASE_URL ? (project.logo ? `${BASE_URL}${project.logo}` : `${BASE_URL}/logos/MegaETH.webp`) : '',
    'project-logo',
    mode
  );

  return {
    attachments: [ecosystemMap.attachment, megabunnishSymbol.attachment, projectLogo.attachment].filter(
      (attachment): attachment is Attachment => attachment !== null
    ),
    sources: {
      ecosystemMapSrc: ecosystemMap.src,
      megabunnishSymbolSrc: megabunnishSymbol.src,
      projectLogoSrc: projectLogo.src
    }
  };
}

function formatDate(iso: string): string {
  return formatDateFromParts(parseIsoParts(iso));
}

function formatTime(iso: string): string {
  const parts = parseIsoParts(iso);
  const time = formatClock(parts);
  return parts.offsetLabel ? `${time} ${parts.offsetLabel}` : time;
}

function formatDateRange(start: string, end?: string): string {
  if (!end || sameLocalDate(start, end)) {
    return formatDate(start);
  }

  return `${formatDate(start)} -> ${formatDate(end)}`;
}

function isAllDay(phases: Phase[]): boolean {
  return phases.length === 1 && phases[0].label.toLowerCase() === 'all day';
}

function formatPrimaryTimeLabel(event: AppEvent): string {
  if (isAllDay(event.phases)) {
    return 'All day';
  }

  if (!event.end) {
    return formatTime(event.start);
  }

  if (sameLocalDate(event.start, event.end)) {
    return formatTimeRange(event.start, event.end);
  }

  return `${formatTime(event.start)} -> ${formatTime(event.end)}`;
}

function buildCalendarUrl(event: AppEvent, projectName: string): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${projectName} - ${event.title}`,
    details: `Event on the MegaETH ecosystem. ${event.detailsUrl ?? event.tweetUrl}`,
  });

  if (isAllDay(event.phases)) {
    params.set('dates', `${formatCalendarDateValue(event.start)}/${addDaysToCalendarDate(event.end ?? event.start, 1)}`);
  } else {
    params.set('dates', `${formatCalendarDateTime(event.start)}/${formatCalendarDateTime(event.end ?? event.start)}`);
  }

  return `https://calendar.google.com/calendar/render?${params}`;
}

// ── HTML template (generic) ───────────────────────────────────
function buildHtml(event: AppEvent, project: Project, assetSources: HtmlAssetSources) {
  const projectName = escapeHtml(project.name);
  const twitterUrl = project.links?.twitter ?? event.tweetUrl;
  const twitterHandle = extractHandle(twitterUrl);
  const projectUrl = project.links?.site ?? '';
  const hasProjectSite = Boolean(project.links?.site);
  const detailsUrl = event.detailsUrl ?? event.tweetUrl;
  const calendarUrl = buildCalendarUrl(event, project.name);
  const dateLabel = formatDateRange(event.start, event.end);
  const timeLabel = formatPrimaryTimeLabel(event);
  const allDay = isAllDay(event.phases);
  const unsubscribeHtml = UNSUBSCRIBE_URL
    ? `<br/><a href="${UNSUBSCRIBE_URL}" style="color:rgba(255,244,214,0.68);text-decoration:underline;">Unsubscribe</a>`
    : '';

  const phasesHtml = event.phases
    .filter((p) => p.label.toLowerCase() !== 'all day')
    .map(
      (p) => `
        <tr>
          <td style="padding:10px 14px;font-weight:700;color:#fff7df;border-bottom:1px solid rgba(255,255,255,0.08);">${escapeHtml(p.label)}</td>
          <td style="padding:10px 14px;color:rgba(255,244,214,0.72);border-bottom:1px solid rgba(255,255,255,0.08);">${formatTimeRange(p.start, p.end)}</td>
        </tr>`
    )
    .join('');

  const phaseCount = event.phases.filter((phase) => phase.label.toLowerCase() !== 'all day').length;
  const eventSummary = `${projectName} just lit up on the MegaETH ecosystem map. Save the date, review the timing, and jump into the official announcement below.`;

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0d0907;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d0907;">
    <tr><td align="center" style="padding:0 8px 12px;">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0"
             style="max-width:600px;width:100%;border-radius:24px;overflow:hidden;
                    background:#110d0c;
                    border:1px solid #3a2f29;">

        <tr>
          <td style="padding:0;background:#080808;line-height:0;">
            <img
              src="${assetSources.ecosystemMapSrc}"
              alt="MegaETH ecosystem map"
              width="600"
              style="display:block;width:100%;height:auto;border:0;outline:none;text-decoration:none;"
            />
          </td>
        </tr>

        <tr>
          <td style="padding:14px 18px 6px;background:linear-gradient(180deg,#15100d 0%,#100c0a 100%);">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:0;vertical-align:top;">
                  <span style="display:inline-block;background:#ffd84d;color:#24150f;border-radius:999px;padding:7px 12px;font-size:11px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;">MegaETH Ecosystem Map</span>
                </td>
                <td align="right" style="padding:0;vertical-align:top;">
                  <img src="${assetSources.megabunnishSymbolSrc}" alt="Megabunnish" width="38" height="38" style="display:block;width:38px;height:38px;border-radius:12px;border:1px solid rgba(255,255,255,0.16);background:#ffd84d;" />
                </td>
              </tr>
              <tr>
                <td colspan="2" style="padding:12px 0 0;">
                  <div style="font-size:26px;line-height:1.06;font-weight:800;color:#fff7df;max-width:360px;">New Event Announced</div>
                  <div style="font-size:14px;line-height:1.65;color:rgba(255,244,214,0.84);max-width:430px;margin-top:10px;">
                    ${eventSummary}
                  </div>
                  <div style="font-size:11px;line-height:1.5;letter-spacing:1.2px;text-transform:uppercase;color:rgba(255,244,214,0.72);font-weight:700;margin-top:10px;">
                    Source: Megabunnish snapshot
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:18px 18px 0;background:linear-gradient(180deg,#16110e 0%,#0f0c0a 100%);">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,216,77,0.06);border:1px solid rgba(255,216,77,0.14);border-radius:18px;">
              <tr>
                <td width="72" style="vertical-align:middle;padding:16px 0 16px 16px;">
                  <img src="${assetSources.projectLogoSrc}" alt="${projectName}"
                       width="52" height="52"
                       style="border-radius:16px;border:1px solid rgba(255,255,255,0.12);display:block;background:#1d1714;" />
                </td>
                <td style="vertical-align:middle;padding:16px 18px 16px 14px;">
                  <div style="font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:#d2bb77;font-weight:700;">Project</div>
                  <div style="font-size:21px;line-height:1.15;font-weight:800;color:#fff7df;margin-top:4px;">${projectName}</div>
                  <div style="font-size:13px;color:#d9ccff;margin-top:4px;">
                    <a href="${twitterUrl}" style="color:#d9ccff;text-decoration:none;">@${escapeHtml(twitterHandle)}</a>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:18px 18px 0;background:linear-gradient(180deg,#16110e 0%,#0f0c0a 100%);">
            <div style="font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:#d2bb77;font-weight:700;">Event</div>
            <div style="font-size:30px;line-height:1.06;font-weight:800;color:#fff7df;margin-top:8px;">
              ${escapeHtml(event.title)}
            </div>
            <div style="font-size:14px;line-height:1.65;color:rgba(255,244,214,0.78);margin-top:12px;">
              Track the latest move from ${projectName} on MegaETH. The key timing and useful links are right below.
            </div>
          </td>
        </tr>

        <tr>
          <td style="padding:18px 18px 0;background:linear-gradient(180deg,#16110e 0%,#0f0c0a 100%);">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:50%;padding:0 8px 0 0;vertical-align:top;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1a1511;border:1px solid rgba(255,216,77,0.12);border-radius:16px;">
                    <tr>
                      <td style="padding:14px 16px;">
                        <div style="font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#d2bb77;font-weight:700;">Date</div>
                        <div style="font-size:16px;line-height:1.45;font-weight:700;color:#fff7df;margin-top:6px;">${escapeHtml(dateLabel)}</div>
                      </td>
                    </tr>
                  </table>
                </td>
                <td style="width:50%;padding:0 0 0 8px;vertical-align:top;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1a1511;border:1px solid rgba(217,204,255,0.12);border-radius:16px;">
                    <tr>
                      <td style="padding:14px 16px;">
                        <div style="font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#d9ccff;font-weight:700;">Time</div>
                        <div style="font-size:16px;line-height:1.45;font-weight:700;color:#fff7df;margin-top:6px;">${escapeHtml(timeLabel)}</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        ${
          phasesHtml
            ? `
        <tr>
          <td style="padding:18px 18px 0;background:linear-gradient(180deg,#16110e 0%,#0f0c0a 100%);">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:#d2bb77;margin-bottom:10px;font-weight:700;">
              Schedule${phaseCount ? ` (${phaseCount} phases)` : ''}
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                   style="background:#1a1511;border-radius:16px;border:1px solid rgba(255,216,77,0.12);font-size:13px;overflow:hidden;">
              ${phasesHtml}
            </table>
          </td>
        </tr>`
            : ''
        }

        <tr>
          <td style="padding:20px 18px 0;background:linear-gradient(180deg,#16110e 0%,#0f0c0a 100%);">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:0 10px 10px 0;">
                  <a href="${detailsUrl}"
                     style="display:inline-block;background:#ffd84d;
                            color:#24150f;font-weight:800;font-size:14px;text-decoration:none;
                            padding:13px 20px;border-radius:999px;">
                    View Details
                  </a>
                </td>
                <td>
                  <a href="${calendarUrl}"
                     style="display:inline-block;border:1px solid rgba(255,255,255,0.18);
                            background:#1a1511;color:#fff7df;font-weight:700;
                            font-size:14px;text-decoration:none;padding:13px 20px;border-radius:999px;">
                    Add to Calendar
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        ${
          hasProjectSite
            ? `
        <tr>
          <td style="padding:16px 18px 0;background:linear-gradient(180deg,#16110e 0%,#0f0c0a 100%);">
            <a href="${projectUrl}"
               style="font-size:13px;color:#d9ccff;text-decoration:none;font-weight:700;">
              Visit ${projectName} &#8594;
            </a>
          </td>
        </tr>`
            : ''
        }

        <tr>
          <td style="padding:20px 18px 18px;background:linear-gradient(180deg,#110d0c 0%,#0d0907 100%);">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,216,77,0.05);border:1px solid rgba(255,216,77,0.12);border-radius:16px;">
              <tr>
                <td style="padding:16px 18px;font-size:11px;color:rgba(255,244,214,0.52);text-align:center;line-height:1.7;">
                  You received this because you subscribed to Megabunnish event alerts.<br/>
                  ${allDay ? 'This event is scheduled as an all-day window.' : 'Watch the schedule closely in case additional phases get announced.'}<br/>
                  ${unsubscribeHtml}
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>

    </td></tr>
  </table>

</body>
</html>`;
}

// ── CLI ───────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const previewMode = args.includes('--preview');
  const writeMode = args.includes('--write');
  const writeAllMode = args.includes('--write-all');
  const outputPath = readFlagValue(args, '--output');
  const outputDir = readFlagValue(args, '--output-dir');

  // --list: print all event ids
  if (args.includes('--list')) {
    console.log('Available events:\n');
    for (const ev of APP_EVENTS) {
      const proj = projectById.get(ev.projectId);
      console.log(`  ${ev.id.padEnd(40)} ${(proj?.name ?? ev.projectId).padEnd(20)} ${ev.start.slice(0, 10)}`);
    }
    process.exit(0);
  }

  if (writeAllMode) {
    const exportDir = resolveExportDir(outputDir);
    let writeCount = 0;

    for (const event of APP_EVENTS) {
      const project = projectById.get(event.projectId);
      if (!project) {
        console.error(`Project "${event.projectId}" not found in projects.json.`);
        process.exit(1);
      }

      const assets = prepareAssets(project, 'preview');
      const html = buildHtml(event, project, assets.sources);
      const filePath = writePasteReadyHtml(resolveExportPath(event.id, undefined, outputDir), html);
      console.log(`Wrote ${relative(PROJECT_ROOT, filePath)}`);
      writeCount += 1;
    }

    console.log(`Generated ${writeCount} paste-ready HTML files in ${relative(PROJECT_ROOT, exportDir)}`);
    process.exit(0);
  }

  const eventId = getPositionalArgs(args)[0];
  if (!eventId) {
    console.error('Usage: npx tsx scripts/send-event-email.ts <event-id> [--to a@b.com,c@d.com] [--preview] [--write] [--output path]');
    console.error('       npx tsx scripts/send-event-email.ts --write-all [--output-dir dir]');
    console.error('       npx tsx scripts/send-event-email.ts --list');
    process.exit(1);
  }

  const event = APP_EVENTS.find((e) => e.id === eventId);
  if (!event) {
    console.error(`Event "${eventId}" not found. Use --list to see available events.`);
    process.exit(1);
  }

  const project = projectById.get(event.projectId);
  if (!project) {
    console.error(`Project "${event.projectId}" not found in projects.json.`);
    process.exit(1);
  }

  const previewAssets = prepareAssets(project, 'preview');
  const html = buildHtml(event, project, previewAssets.sources);

  if (writeMode) {
    const filePath = writePasteReadyHtml(resolveExportPath(event.id, outputPath, outputDir), html);
    if (!previewMode) {
      console.log(`Wrote ${relative(PROJECT_ROOT, filePath)}`);
      process.exit(0);
    }
  }

  // --preview: output HTML, no send
  if (previewMode) {
    process.stdout.write(html);
    process.exit(0);
  }

  // Recipients: --to flag > EVENT_RECIPIENTS env > error
  const toIdx = args.indexOf('--to');
  const recipientStr = toIdx !== -1 ? args[toIdx + 1] : process.env.EVENT_RECIPIENTS;
  if (!recipientStr) {
    console.error('No recipients. Use --to email1,email2 or set EVENT_RECIPIENTS env.');
    process.exit(1);
  }
  const recipients = recipientStr.split(',').map((s) => s.trim()).filter(Boolean);

  if (!RESEND_API_KEY) {
    console.error('Missing RESEND_API_KEY env variable.');
    process.exit(1);
  }

  const resend = new Resend(RESEND_API_KEY);
  const sendAssets = prepareAssets(project, 'send');
  const sendHtml = buildHtml(event, project, sendAssets.sources);

  const { data, error } = await resend.emails.send({
    from:    FROM_ADDRESS,
    to:      recipients,
    subject: `NEW EVENT ON MEGAETH | ${project.name} | ${event.title}`,
    html: sendHtml,
    attachments: sendAssets.attachments,
  });

  if (error) {
    console.error('Resend error:', error);
    process.exit(1);
  }

  console.log(`Email sent ✓  id: ${data?.id}`);
  console.log(`  Event:  ${event.title} (${event.id})`);
  console.log(`  Project: ${project.name}`);
  console.log(`  To:     ${recipients.join(', ')}`);
}

main();
