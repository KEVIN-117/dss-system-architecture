FROM golang:1.26.5 AS builder
WORKDIR /src/etl-layer/loadmanager
COPY etl-layer/loadmanager/go.mod etl-layer/loadmanager/go.sum ./
RUN go mod download
COPY etl-layer/loadmanager/ .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/loadmanager ./cmd/loadmanager

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=builder /out/loadmanager /app/loadmanager
COPY etl-layer/loadmanager/configs/loadmanager.example.yaml /app/configs/loadmanager.yaml
COPY infra/postgres-tx/extract/ /app/queries/
ENV LOADMANAGER_CONFIG=/app/configs/loadmanager.yaml
ENV LOADMANAGER_QUERY_DIR=/app/queries
USER nonroot:nonroot
EXPOSE 8088
ENTRYPOINT ["/app/loadmanager"]
