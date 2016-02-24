import amqp from 'amqp';
import faker from 'faker';
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
   * ...connect to the exchange
   */
  connection.exchange(EXCHANGE_NAME, {
    type: 'topic',
    confirm: true,
    autoDelete: false
  }, (exchange) => {
    console.log(` Connected to exchange '${EXCHANGE_NAME}'`);

    /**
     * Connect to the queue
     */
    connection.queue(QUEUE_NAME, {autoDelete: false}, function (q) {
      /**
       * Bind the queue to the exchange with a routing key
       */
      let bindExpr = `v${program.api}.example`;
      q.bind(exchange, bindExpr);
      console.log(` Queue '${QUEUE_NAME}' bound to Exchange ` +
        `'${EXCHANGE_NAME}' with '${bindExpr}'`);

      /**
       * Do something a bunch of times
       */
      setInterval(() => {
        let payload = { v: program.api, name: `${faker.name.findName()}` };

        /**
         * Publish a payload with the appropriate routing key
         */
        exchange.publish(ROUTING_KEY,
          payload,
          // Options
          { mandatory: true },
          (error) => {
            /**
             * Handle any publish errors
             */
            if (error) {
              return console.error(
                `Unable to publish to the exchange '${EXCHANGE_NAME}'`
              );
            }

            /**
             * Do stuff on successful publish
             */
            console.log( `Published '${util.inspect(payload)}' to ` +
              `exchange '${EXCHANGE_NAME}'`);
          }
        );
      }, 500);
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

