//go:build e2e

// End to end: a browser-like HTTP/3 client, this gateway, and the real Node
// server of apps/communication, run from its sources as `pnpm dev` does.
// The client speaks the tunnel's frames (libs/transport/src/frame) directly.
package e2e

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"math/big"
	"net"
	"net/http"
	"os"
	"os/exec"
	"sync/atomic"
	"syscall"
	"testing"
	"time"

	"github.com/quic-go/quic-go"
	"github.com/quic-go/quic-go/http3"
	"github.com/quic-go/webtransport-go"

	"github.com/frozik/portfolio/apps/transport-gateway/internal/metrics"
	"github.com/frozik/portfolio/apps/transport-gateway/internal/server"
	"github.com/frozik/portfolio/apps/transport-gateway/internal/upstream"
)

const (
	secret       = "e2e-gateway-secret-long-enough"
	origin       = "http://localhost:5173"
	windowBytes  = 256 * 1024
	tunnelOrigin = "https://transport.invalid"

	frameHead = 1
	frameData = 2
	frameEnd  = 3

	chunkBytes   = 32 * 1024
	stallWait    = 300 * time.Millisecond
	settleRounds = 10
	startTimeout = 30 * time.Second
)

func freePort(t *testing.T) int {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	return listener.Addr().(*net.TCPAddr).Port
}

// startNode runs the built server with its gateway listener on a free port.
func startNode(t *testing.T) int {
	t.Helper()
	gatewayPort := freePort(t)
	overrides, _ := json.Marshal(map[string]any{
		"server":    map[string]any{"port": freePort(t), "host": "127.0.0.1", "cors_allowed_origins": []string{origin}},
		"admin":     map[string]any{"port": freePort(t)},
		"logging":   map[string]any{"level": "warn", "pretty": false},
		"transport": map[string]any{"enabled": true, "dev_certificate_dir": t.TempDir(), "gateway": map[string]any{"enabled": true, "host": "127.0.0.1", "port": gatewayPort, "secret": secret}},
	})
	node := exec.Command("node_modules/.bin/tsx", "src/main.ts")
	node.Dir = "../../communication"
	node.Env = append(os.Environ(), "NODE_CONFIG_DIR=./config", "NODE_CONFIG_ENV=test", "NODE_CONFIG="+string(overrides))
	var output bytes.Buffer
	node.Stdout, node.Stderr = &output, &output
	if err := node.Start(); err != nil {
		t.Fatalf("start node: %v", err)
	}
	t.Cleanup(func() {
		node.Process.Signal(syscall.SIGTERM)
		node.Wait()
		if t.Failed() {
			t.Logf("node output:\n%s", output.String())
		}
	})
	deadline := time.Now().Add(startTimeout)
	for {
		conn, err := net.Dial("tcp", fmt.Sprintf("127.0.0.1:%d", gatewayPort))
		if err == nil {
			conn.Close()
			return gatewayPort
		}
		if time.Now().After(deadline) {
			t.Fatalf("node did not open its gateway listener:\n%s", output.String())
		}
		time.Sleep(200 * time.Millisecond)
	}
}

func selfSigned() (tls.Certificate, *x509.CertPool) {
	key, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	template := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: "127.0.0.1"},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(time.Hour),
		IPAddresses:  []net.IP{net.ParseIP("127.0.0.1")},
	}
	der, _ := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	parsed, _ := x509.ParseCertificate(der)
	pool := x509.NewCertPool()
	pool.AddCert(parsed)
	return tls.Certificate{Certificate: [][]byte{der}, PrivateKey: key}, pool
}

// session opens a browser-like WebTransport session through a gateway in front of a fresh Node.
func session(t *testing.T) *webtransport.Session {
	t.Helper()
	gatewayPort := startNode(t)
	certificate, pool := selfSigned()
	gateway := server.New(server.Options{
		Path:                 "/transport",
		MaxStreamsPerSession: 16,
		StreamWindowBytes:    windowBytes,
		SessionWindowBytes:   4 * windowBytes,
		GetCertificate:       func(*tls.ClientHelloInfo) (*tls.Certificate, error) { return &certificate, nil },
		Upstream:             upstream.Dialer{URL: fmt.Sprintf("ws://127.0.0.1:%d/transport", gatewayPort), Secret: secret},
		Metrics:              metrics.New(),
		Logger:               slog.New(slog.DiscardHandler),
	})
	udp, err := net.ListenPacket("udp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	go gateway.Serve(udp)
	client := &webtransport.Transport{
		TLSClientConfig: &tls.Config{RootCAs: pool, NextProtos: []string{http3.NextProtoH3}},
		QUICConfig:      &quic.Config{EnableDatagrams: true, EnableStreamResetPartialDelivery: true},
	}
	t.Cleanup(func() {
		client.Close()
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		gateway.Drain(ctx)
	})
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	header := http.Header{}
	header.Set("Origin", origin)
	_, browser, err := client.Dial(ctx, "https://"+udp.LocalAddr().String()+"/transport", header)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	return browser
}

func frame(kind byte, payload []byte) []byte {
	encoded := make([]byte, 5+len(payload))
	encoded[0] = kind
	binary.BigEndian.PutUint32(encoded[1:5], uint32(len(payload)))
	copy(encoded[5:], payload)
	return encoded
}

func jsonFrame(kind byte, value any) []byte {
	payload, _ := json.Marshal(value)
	return frame(kind, payload)
}

func head(method, contentType string) []byte {
	return jsonFrame(frameHead, map[string]any{
		"method": "POST",
		"url":    tunnelOrigin + "/" + method,
		"header": [][2]string{{"content-type", contentType}, {"connect-protocol-version", "1"}},
	})
}

// readFrames splits a whole response into (type, payload) pairs.
func readFrames(t *testing.T, raw []byte) [][2]any {
	t.Helper()
	var frames [][2]any
	for len(raw) >= 5 {
		length := int(binary.BigEndian.Uint32(raw[1:5]))
		frames = append(frames, [2]any{raw[0], raw[5 : 5+length]})
		raw = raw[5+length:]
	}
	return frames
}

func TestAnswersAConnectCallFromNodeOverHTTP3(t *testing.T) {
	stream, err := session(t).OpenStream()
	if err != nil {
		t.Fatal(err)
	}
	callPlotLimits(t, stream)
}

// More calls than Node allows streams at once, one after another: each
// finished call must give its slot back (a Connect handler stops reading at
// its END frame, and the slot used to stay taken).
func TestAnswersManyMoreCallsThanTheStreamLimitOneAfterAnother(t *testing.T) {
	browser := session(t)
	for call := range 24 {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		stream, err := browser.OpenStreamSync(ctx)
		cancel()
		if err != nil {
			t.Fatalf("call %d: %v", call, err)
		}
		callPlotLimits(t, stream)
	}
}

func callPlotLimits(t *testing.T, stream *webtransport.Stream) {
	t.Helper()
	stream.Write(head("frozik.transport.v1.PlotService/GetPlotLimits", "application/json"))
	stream.Write(frame(frameData, []byte("{}")))
	stream.Write(jsonFrame(frameEnd, map[string]any{"trailer": [][2]string{}}))
	stream.Close()

	raw, err := io.ReadAll(stream)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	frames := readFrames(t, raw)
	var answer struct {
		Status int `json:"status"`
	}
	json.Unmarshal(frames[0][1].([]byte), &answer)
	if frames[0][0] != byte(frameHead) || answer.Status != http.StatusOK {
		t.Fatalf("response head: %s", frames[0][1])
	}
	if body := frames[1][1].([]byte); !bytes.Contains(body, []byte("sampleMaxPoints")) {
		t.Fatalf("response body: %s", body)
	}
}

// envelope is one Connect streaming message: flags, big-endian length, protobuf.
func envelope(message []byte) []byte {
	encoded := make([]byte, 5+len(message))
	binary.BigEndian.PutUint32(encoded[1:5], uint32(len(message)))
	copy(encoded[5:], message)
	return encoded
}

func protoBytes(field byte, value []byte) []byte {
	return append(binary.AppendUvarint([]byte{field<<3 | 2}, uint64(len(value))), value...)
}

func TestHoldsABrowserThatNeverReadsTheEchoToAFewWindowsThroughTheWholeChain(t *testing.T) {
	stream, err := session(t).OpenStream()
	if err != nil {
		t.Fatal(err)
	}
	const declared = 512 << 20
	fileHeader := append(protoBytes(1, []byte("e2e.bin")), binary.AppendUvarint([]byte{2 << 3}, declared)...)
	stream.Write(head("frozik.transport.v1.FileService/Echo", "application/connect+proto"))
	stream.Write(frame(frameData, envelope(protoBytes(1, fileHeader))))

	var sent atomic.Int64
	chunk := frame(frameData, envelope(protoBytes(2, make([]byte, chunkBytes))))
	go func() {
		for {
			if _, err := stream.Write(chunk); err != nil {
				return
			}
			sent.Add(chunkBytes)
		}
	}()

	previous := sent.Load()
	for round := 0; ; round++ {
		time.Sleep(stallWait)
		current := sent.Load()
		if current == previous {
			break
		}
		if round == settleRounds {
			t.Fatalf("still sending after %d rounds, at %d bytes", settleRounds, current)
		}
		previous = current
	}
	// Windows on the way: QUIC both ways, the mux credit both ways, Node's
	// in-flight messages; far below the 512 MiB the file declares.
	if bound := int64(16 * windowBytes); previous > bound {
		t.Fatalf("sent %d bytes into an echo nobody reads (bound %d)", previous, bound)
	}
}
