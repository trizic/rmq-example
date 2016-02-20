build:
	make -C docker/producer
	make -C docker/consumer
	make -C docker/api
	make -C docker/api-worker
