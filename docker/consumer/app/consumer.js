import amqp from 'amqp';
import util from 'util';
import program from 'commander';

/**
 * Parse the command line arguments
 */
program.version('0.0.1')
  .option('-r, --rabbit [host]', 'RabbitMQ Address')
  .option('-a, --api [version]', 'Version #')
  .parse(process.argv);

/**
 * Setup queue information
 */
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
   * ...connect to the queue
   */
  connection.queue(QUEUE_NAME, {autoDelete: false}, function (q) {
    console.log(`Connected to queue "${QUEUE_NAME}"`);

    /**
     * Subscribe to messages on the queue
     */
    q.subscribe({
      ack: true,
      prefetchCount: 1
    }, (msg) => {
      console.log(`Processing: ${util.inspect(msg)}`);

      /**
       * This is where you would do stuff to the message.  For this example,
       * simulate processing time.
       */
      setTimeout(() => {
        /**
         * We're all done with the message so acknowledge and move on to the
         * next one
         */
        q.shift();
      }, 1000)
    });
  });
});

/**
 * Report RabbitMQ connection errors, but don't exit.  This will keep trying to
 * connect.
 */
connection.on('error', (err) => {
  console.error('ERR:', err);
});

/**
 * Catch all unhandled exceptions.  Report and bail out.
 */
process.on('uncaughtexception', (e) => {
  console.error(`ERR: ${e}`);
  process.exit(70);
});

/**
 * Do anything necessary to shutdown gracefully
 */
process.on('SIGINT', () => {
  console.error('\nGracefully shutting down');
  process.exit();
});
