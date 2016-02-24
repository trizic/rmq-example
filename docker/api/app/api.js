import restify from 'restify';
import pkg from './package.json';
import amqp from 'amqp';
import program from 'commander';
import uuid from 'uuid';

/**
 * Parse the command line arguments
 */
program.version('0.0.1')
  .option('-r, --rabbit [host]', 'RabbitMQ Address')
  .option('-a, --api [version]', 'Version #')
  .option('-p, --port [port number]', 'Port', parseInt)
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
const EXCHANGE_NAME = 'api';
const ROUTING_KEY = `v${VERSION}.api`;
const QUEUE_NAME = `v${VERSION}.api.q`;
const RESPONSE_QUEUE = `response.api.q`;
const TIMEOUT = 5;
let reqExchange;

/**
 * Cache for response handles by correlation id
 */
let cache = {};

/**
 * Create a REST server
 */
let server = restify.createServer();
server.use(restify.bodyParser());

/**
 * Handle POST /echo
 */
server.post('/echo', (req, res, next) => {

  /**
   * Get a unique correlation id so the response message can find it's way back
   * here
   */
  let correlationId = uuid.v4();

  /**
   * Start a timeout event, so we don't spin indefinitely
   */
  let timeoutId = setTimeout(() => {
    /**
     * Remove the response handle from the cache
     */
    delete cache[correlationId];

    return next(new Error(`Response timed out after ${TIMEOUT}s.`));
  }, TIMEOUT * 1000);

  /**
   * Store the response object
   */
  cache[correlationId] = {
    response: res,
    next: next,
    timeoutId: timeoutId
  };

  /**
   * Send the REQUEST with the reply to queue
   */
  reqExchange.publish(ROUTING_KEY,
    // Payload
    req.body, {
    // Options
    replyTo: RESPONSE_QUEUE,
    correlationId: correlationId,
  }, () => {
    console.log('Published message:', req.body);
  });
});

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
   * ..connect to the REQUEST exchange
   */
  connection.exchange(EXCHANGE_NAME, {
    type: 'topic',
    confirm: true,
    autoDelete: false
  }, (exchange) => {
    console.log(` Connected to exchange '${EXCHANGE_NAME}'`);

    /**
     * Expose the request exchange for use in the routes
     */
    reqExchange = exchange;

    /**
     * Connect to the REQUEST queue
     */
    connection.queue(QUEUE_NAME, {
      autoDelete: false
    }, function(q) {

      /**
       * Bind the queue to the exchange with a routing key
       */
      let bindExpr = `v${VERSION}.api`;
      q.bind(exchange, bindExpr);
      console.log(` Queue '${QUEUE_NAME}' bound to Exchange ` +
        `'${EXCHANGE_NAME}' with '${bindExpr}'`);

      /**
       * Now that RabbitMQ is initialized, let's start the REST server
       */
      let port = program.port || 9090;
      server.listen({
        host: '0.0.0.0',
        port: port
      }, () => {
        console.log('-----------------------------------------');
        console.log(` ${pkg.name}-${pkg.version} listening on: ` + port);
        console.log('-----------------------------------------');
      });
    });
  });

  /**
   * Connect to the RESPONSE queue
   */
  connection.queue(RESPONSE_QUEUE, {
    autoDelete: false,
    arguments: {
      'x-message-ttl': 10000
    }
  }, (q) => {
    console.log(' Connected to response queue');

    /**
     * Subscribe to messages on the RESPONSE queue
     */
    q.subscribe({
      ack: true
    }, (message, headers, deliveryInfo, messageObject) => {
      /**
       * Lookup response handle for this message
       */
      if (!Object.keys(cache).includes(deliveryInfo.correlationId)) {
        /**
         * If not found reject and requeue
         */
        return q.shift(true, true)
      }

      /**
       * Get the cached objects
       */
      let {response, next, timeoutId} = cache[deliveryInfo.correlationId];

      /**
       * Cancel the timeout
       */
      clearTimeout(timeoutId);

      /**
       * Clean up the cache
       */
      delete cache[deliveryInfo.correlationId];

      /**
       * Acknowledge the message
       */
      q.shift();

      /**
       * Send the response
       */
      response.send(message);
      return next();

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
  process.exit();
})
