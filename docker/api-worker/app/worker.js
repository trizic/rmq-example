import pkg from './package.json';
import amqp from 'amqp';
import program from 'commander';

/**
 * Parse the command line arguments
 */
program.version('0.0.1')
  .option('-r, --rabbit [host]', 'RabbitMQ Address')
  .option('-a, --api [version]', 'Version #')
  .parse(process.argv);

/**
 * Docker only prints info from stderr.  Let's pipe stdout to stderr for
 * debugging.
 */
process.stdout.pipe(process.stderr)

/**
 * Setup queue information
 */
const VERSION = program.api || 0;
const RABBIT = program.rabbit || 'rabbitmq';
const QUEUE_NAME = `v${VERSION}.api.q`;

/**
 * Connect to RabbitMQ
 */
let connection = amqp.createConnection({
  host: program.rabbit
});

/**
 * When the rabbit connection is ready...
 */
connection.on('ready', function() {
  console.log(`RabbitMQ Connection ready at "${RABBIT}"`);

  /**
   * ...connect to the incoming queue
   */
  connection.queue(QUEUE_NAME, {
    autoDelete: false
  }, function(q) {
    console.log(`Connected to Queue: ${QUEUE_NAME}`);

    /**
     * Subscribe to the request queue
     */
    q.subscribe({
      ack: true
    }, (message, headers, deliveryInfo, messageInfo) => {
      console.log('request:', message);

      /**
       * Do work
       */
      setTimeout(() => {
        /**
         * Publish response to reply queue
         */
        connection.publish(deliveryInfo.replyTo, {
          // payload
          received: message
        }, {
          // options
          correlationId: deliveryInfo.correlationId
        });

        /**
         * Acknowledge the request message
         */
        q.shift();
      }, 750);

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
  console.log('Shutdown gracefully');
  // TODO: Clean up RMQ connections (Wed Feb 17 18:01:30 2016);
  process.exit();
})
