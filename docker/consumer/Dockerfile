FROM node:4.2

ADD app /opt/example
RUN cd /opt/example && npm install

WORKDIR /opt/example

CMD node_modules/.bin/babel-node consumer.js --rabbit $RABBITMQ_HOST --api $API_VERSION
