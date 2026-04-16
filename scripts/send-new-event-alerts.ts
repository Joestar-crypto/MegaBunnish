import { sendNewEventAlerts } from '../server/event-alerts/service';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const result = await sendNewEventAlerts({ dryRun });

  if (result.skippedReason) {
    console.log(result.skippedReason);
    return;
  }

  console.log(`Segment: ${result.segmentId}`);
  console.log(`Pending events: ${result.pendingEvents.length}`);

  if (dryRun) {
    result.sentEvents.forEach((entry) => {
      console.log(`Would send: ${entry.eventId}`);
    });
    return;
  }

  result.sentEvents.forEach((entry) => {
    console.log(`Sent: ${entry.eventId} -> ${entry.broadcastId}`);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});