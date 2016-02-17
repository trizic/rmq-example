import amqp from 'amqp';
import util from 'util';
import program from 'commander';

program.version('0.0.1')
  .option('-r, --rabbit [host]', 'RabbitMQ Address')
  .option('-a, --api [version]', 'Version #')
  .parse(process.argv);

const EXCHANGE_NAME = 'example';
const ROUTING_KEY = `v${program.api}.example`;
const QUEUE_NAME = `v${program.api}.example.q`;

/**
 * Docker only prints info from stderr.  Let's pipe stdout to stderr for
 * debugging.
 */
process.stdout.pipe(process.stderr)

/**
 * Connect to RabbitMQ
 */
let connection = amqp.createConnection({ host: program.rabbit });

/**
 * When the connection is ready...
 */
connection.on('ready', function () {
  console.log(`RabbitMQ Connection ready at "${program.rabbit}"`);
  /**
   * Create or get the queue
   */
  connection.queue(QUEUE_NAME, {autoDelete: false}, function (q) {
    console.log(`Connected to queue "${QUEUE_NAME}"`);

    /**
     * Subscribe to messages on the queue
     */
    q.subscribe({
      ack: true,
      prefetchCount: 1
    }, (msg, headers, deliveryInfo) => {
      console.log(`Processing: ${util.inspect(msg)}`);

      // simulate processing time
      setTimeout(() => {
        q.shift();
      }, 1000)
    });
  });
});

connection.on('error', (err) => {
  console.error('ERR:', err);
})

process.on('uncaughtexception', (e) => {
  console.error(`ERR: ${e}`);
  process.exit(70);
})
