FROM node:4.2

ADD app /opt/example
WORKDIR /opt/example
RUN npm install

CMD node_modules/.bin/babel-node producer.js --rabbit $RABBITMQ_HOST --api $API_VERSION
