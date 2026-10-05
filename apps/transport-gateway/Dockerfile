# syntax=docker/dockerfile:1.7
#
# HTTP/3 gateway — a static Go binary on distroless. Build context: this directory.
# The compiler runs natively and cross-compiles, instead of under emulation.
FROM --platform=$BUILDPLATFORM golang:1.26.8 AS builder
ARG TARGETOS
ARG TARGETARCH

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cmd cmd
COPY internal internal
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -trimpath -ldflags='-s -w' -o /out/gateway ./cmd/gateway

FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=builder /out/gateway /gateway

# 4447/udp: HTTP/3 WebTransport, published to the host's UDP 443 in production.
EXPOSE 4447/udp

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD ["/gateway", "-healthcheck"]

ENTRYPOINT ["/gateway"]
