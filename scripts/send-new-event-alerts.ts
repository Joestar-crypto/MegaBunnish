import { sendNewEventAlerts } from '../server/event-alerts/service';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const result = await sendNewEventAlerts({ dryRun });

  console.log(`Storage: ${result.storageDriver}`);
  console.log(`Subscribers: ${result.subscriberCount}`);

  if (result.skippedReason) {
    console.log(result.skippedReason);
    return;
  }

  console.log(`Pending events: ${result.pendingEvents.length}`);

  if (dryRun) {
    result.pendingEvents.forEach((entry) => {
      console.log(`Would send: ${entry.eventId} -> ${entry.recipientCount} recipients`);
    });
    return;
  }

  result.sentEvents.forEach((entry) => {
    console.log(`Sent: ${entry.eventId} -> ${entry.sentCount}/${entry.attemptedCount} recipients`);
  });

  result.failures.forEach((entry) => {
    console.log(`Failed: ${entry.eventId} -> ${entry.email} (${entry.error})`);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});