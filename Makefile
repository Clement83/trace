.PHONY: help build up down restart logs clean rebuild shell

# Variables
DOCKER_COMPOSE = docker-compose
CONTAINER_NAME = klmtovideo-app

help:
	@echo "Available commands:"
	@echo "  make build      - Build Docker image"
	@echo "  make up         - Start containers in detached mode"
	@echo "  make down       - Stop and remove containers"
	@echo "  make restart    - Restart containers"
	@echo "  make logs       - Show container logs (follow mode)"
	@echo "  make clean      - Remove containers, images, and volumes"
	@echo "  make rebuild    - Clean and rebuild everything"
	@echo "  make shell      - Open shell in running container"
	@echo "  make health     - Check container health status"

build:
	@echo "Building Docker image..."
	$(DOCKER_COMPOSE) build

up:
	@echo "Starting containers..."
	$(DOCKER_COMPOSE) up -d
	@echo "Application running at http://localhost:3001"

down:
	@echo "Stopping containers..."
	$(DOCKER_COMPOSE) down

restart:
	@echo "Restarting containers..."
	$(DOCKER_COMPOSE) restart

logs:
	@echo "Showing logs (Ctrl+C to exit)..."
	$(DOCKER_COMPOSE) logs -f

clean:
	@echo "Cleaning up containers, images, and volumes..."
	$(DOCKER_COMPOSE) down -v --rmi all
	@echo "Cleanup complete"

rebuild: clean build up
	@echo "Rebuild complete"

shell:
	@echo "Opening shell in container..."
	docker exec -it $(CONTAINER_NAME) /bin/bash

health:
	@echo "Checking container health..."
	@docker ps --filter "name=$(CONTAINER_NAME)" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
