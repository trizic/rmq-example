import amqp from 'amqp';
import faker from 'faker';
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
   * Create or get the exchange
   */
  connection.exchange(EXCHANGE_NAME, {
    type: 'topic',
    confirm: true,
    autoDelete: false
  }, (exchange) => {
    console.log(` Connected to exchange '${EXCHANGE_NAME}'`);

    /**
     * Create or get the queue
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
       * Publish a bunch of random stuff to the exchange
       */
      setInterval(() => {
        let payload = { v: program.api, name: `${faker.name.findName()}` };

        /**
         * Publish the payload with the appropriate routing key
         */
        exchange.publish(
          ROUTING_KEY,
          payload,
          { mandatory: true },
          (error) => {
            if (error) {
              return console.error(
                `Unable to publish to the exchange '${EXCHANGE_NAME}'`
              );
            }

            // Success
            console.log( `Published '${util.inspect(payload)}' to ` +
              `exchange '${EXCHANGE_NAME}'`);
          }
        );
      }, 500);
    });
  });
});

process.on('uncaughtexception', (e) => {
  console.error(`ERR: ${e}`);
  process.exit(70);
})

process.on('SIGINT', () => {
  console.error('\nGracefully shutting down');
  process.exit();
});

