import { getEventAlertsStatus } from '../server/event-alerts/service';

async function main() {
  const args = process.argv.slice(2);
  const showAll = args.includes('--all');
  const result = await getEventAlertsStatus();
  const subscribers = showAll
    ? result.subscribers
    : result.subscribers.filter((subscriber) => subscriber.status === 'subscribed');

  console.log(`Storage: ${result.storageDriver}`);
  console.log(`Active subscribers: ${result.activeSubscriberCount}`);
  console.log(`Total records: ${result.subscribers.length}`);
  console.log(`Tracked deliveries: ${result.deliveries.length}`);

  if (!subscribers.length) {
    console.log('No subscriber records found.');
    return;
  }

  subscribers.forEach((subscriber) => {
    console.log(`${subscriber.status.padEnd(12)} ${subscriber.email}`);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});