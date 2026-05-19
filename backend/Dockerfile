FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY . .
ENV GONOSUMDB=*
RUN go mod tidy && CGO_ENABLED=0 GOOS=linux go build -o youit-backend ./cmd/main.go

FROM alpine:3.19
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /root/
COPY --from=builder /app/youit-backend .
EXPOSE 8080
CMD ["./youit-backend"]
