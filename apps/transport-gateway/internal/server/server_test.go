package server

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"errors"
	"io"
	"log/slog"
	"math/big"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/quic-go/quic-go"
	"github.com/quic-go/quic-go/http3"
	"github.com/quic-go/webtransport-go"

	"github.com/frozik/portfolio/apps/transport-gateway/internal/metrics"
	"github.com/frozik/portfolio/apps/transport-gateway/internal/mux"
	"github.com/frozik/portfolio/apps/transport-gateway/internal/upstream"
)

const (
	testSecret   = "a-secret-long-enough"
	testOrigin   = "https://site.example"
	windowBytes  = 256 * 1024
	chunkBytes   = 16 * 1024
	stallWait    = 300 * time.Millisecond
	settleRounds = 10
	// Short so a vanished client is noticed within the test.
	testIdleTimeout = time.Second
)

// fakeNode stands in for Node's gateway listener: it checks what the gateway
// sends and runs serve on every stream the gateway opens.
type fakeNode struct {
	server   *httptest.Server
	refuse   int
	serve    func(stream *mux.Stream)
	address  atomic.Value
	origin   atomic.Value
	sessions chan *mux.Session
	live     atomic.Int32
}

func startFakeNode(t *testing.T, serve func(stream *mux.Stream)) *fakeNode {
	t.Helper()
	node := &fakeNode{serve: serve, sessions: make(chan *mux.Session, 8)}
	node.server = httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if node.refuse != 0 || request.Header.Get("Authorization") != "Bearer "+testSecret {
			response.WriteHeader(max(node.refuse, http.StatusForbidden))
			return
		}
		node.address.Store(request.Header.Get(upstream.ClientAddressHeader))
		node.origin.Store(request.Header.Get("Origin"))
		// Like Node's ws, check nothing about the Origin here: Node matches it against its own list.
		conn, err := websocket.Accept(response, request, &websocket.AcceptOptions{
			Subprotocols:       []string{mux.Subprotocol},
			InsecureSkipVerify: true,
		})
		if err != nil {
			return
		}
		conn.SetReadLimit(mux.HeaderBytes + mux.MaxDataBytes)
		session := mux.NewSession(wsConn{conn}, mux.RoleServer, 8)
		node.sessions <- session
		node.live.Add(1)
		go func() {
			<-session.Done()
			node.live.Add(-1)
		}()
		for {
			stream, err := session.AcceptStream(context.Background())
			if err != nil {
				return
			}
			go node.serve(stream)
		}
	}))
	t.Cleanup(node.server.Close)
	return node
}

type wsConn struct{ conn *websocket.Conn }

func (c wsConn) Read(ctx context.Context) ([]byte, error) {
	_, message, err := c.conn.Read(ctx)
	return message, err
}
func (c wsConn) Write(ctx context.Context, message []byte) error {
	return c.conn.Write(ctx, websocket.MessageBinary, message)
}
func (c wsConn) Close(code int, reason string) error {
	return c.conn.Close(websocket.StatusCode(code), reason)
}

func echo(stream *mux.Stream) {
	io.Copy(stream, stream)
	stream.CloseWrite()
}

func selfSigned(t *testing.T) (tls.Certificate, *x509.CertPool) {
	t.Helper()
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

// startGateway runs the real HTTP/3 server in front of node; it returns the
// URL and the pool that trusts its certificate.
func startGateway(t *testing.T, node *fakeNode) (string, *x509.CertPool) {
	t.Helper()
	certificate, pool := selfSigned(t)
	gateway := New(Options{
		Path:                 "/transport",
		MaxStreamsPerSession: 8,
		StreamWindowBytes:    windowBytes,
		SessionWindowBytes:   4 * windowBytes,
		IdleTimeout:          testIdleTimeout,
		GetCertificate:       func(*tls.ClientHelloInfo) (*tls.Certificate, error) { return &certificate, nil },
		Upstream:             upstream.Dialer{URL: "ws" + strings.TrimPrefix(node.server.URL, "http") + "/transport", Secret: testSecret},
		Metrics:              metrics.New(),
		Logger:               slog.New(slog.DiscardHandler),
	})
	udp, err := net.ListenPacket("udp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	go gateway.Serve(udp)
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		gateway.Drain(ctx)
	})
	return "https://" + udp.LocalAddr().String() + "/transport", pool
}

// webTransportClient is a browser stand-in with a browser-sized receive window.
func webTransportClient(t *testing.T, pool *x509.CertPool) *webtransport.Transport {
	t.Helper()
	client := &webtransport.Transport{
		TLSClientConfig: &tls.Config{RootCAs: pool, NextProtos: []string{http3.NextProtoH3}},
		QUICConfig: &quic.Config{
			EnableDatagrams:                  true,
			EnableStreamResetPartialDelivery: true,
			InitialStreamReceiveWindow:       windowBytes,
			MaxStreamReceiveWindow:           windowBytes,
		},
	}
	t.Cleanup(func() { client.Close() })
	return client
}

func dial(t *testing.T, url string, client *webtransport.Transport) (*http.Response, *webtransport.Session, error) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	header := http.Header{}
	header.Set("Origin", testOrigin)
	return client.Dial(ctx, url, header)
}

func openSession(t *testing.T, node *fakeNode) *webtransport.Session {
	t.Helper()
	url, pool := startGateway(t, node)
	_, session, err := dial(t, url, webTransportClient(t, pool))
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	t.Cleanup(func() { session.CloseWithError(0, "") })
	return session
}

// settledAt waits until the counter stops moving and returns where it stopped.
func settledAt(t *testing.T, counter *atomic.Int64) int64 {
	t.Helper()
	previous := counter.Load()
	for range settleRounds {
		time.Sleep(stallWait)
		current := counter.Load()
		if current == previous {
			return current
		}
		previous = current
	}
	t.Fatalf("still moving after %d rounds, at %d bytes", settleRounds, previous)
	return 0
}

func TestEchoesStreamsThroughNodeAndForwardsTheBrowsersAddressAndOrigin(t *testing.T) {
	node := startFakeNode(t, echo)
	session := openSession(t, node)

	for _, size := range []int{5, 300_000} {
		stream, err := session.OpenStream()
		if err != nil {
			t.Fatal(err)
		}
		payload := bytes.Repeat([]byte{byte(size)}, size)
		go func() {
			stream.Write(payload)
			stream.Close()
		}()
		received, err := io.ReadAll(stream)
		if err != nil || !bytes.Equal(received, payload) {
			t.Fatalf("echo of %d bytes: got %d, %v", size, len(received), err)
		}
	}
	if node.address.Load() != "127.0.0.1" || node.origin.Load() != testOrigin {
		t.Fatalf("node saw address %v, origin %v", node.address.Load(), node.origin.Load())
	}
}

func TestAnswersNodesRefusalBeforeAnySessionExists(t *testing.T) {
	node := startFakeNode(t, echo)
	node.refuse = http.StatusForbidden
	url, pool := startGateway(t, node)

	response, _, err := dial(t, url, webTransportClient(t, pool))

	if err == nil || response == nil || response.StatusCode != http.StatusForbidden {
		t.Fatalf("got %v, %v; want the refusal as 403", response, err)
	}
}

func TestStopsTheBrowserSendingWhenNodeDoesNotRead(t *testing.T) {
	node := startFakeNode(t, func(*mux.Stream) {})
	session := openSession(t, node)
	stream, _ := session.OpenStream()
	var sent atomic.Int64
	go func() {
		chunk := make([]byte, chunkBytes)
		for {
			n, err := stream.Write(chunk)
			sent.Add(int64(n))
			if err != nil {
				return
			}
		}
	}()

	// The mux credit, one copy buffer, the gateway's QUIC window and the client's send buffer.
	if stalled := settledAt(t, &sent); stalled > 3*windowBytes+2*mux.MaxDataBytes {
		t.Fatalf("browser sent %d bytes into a reader that never reads", stalled)
	}
}

func TestStopsNodeSendingWhenTheBrowserDoesNotRead(t *testing.T) {
	var produced atomic.Int64
	node := startFakeNode(t, func(stream *mux.Stream) {
		chunk := make([]byte, chunkBytes)
		for {
			n, err := stream.Write(chunk)
			produced.Add(int64(n))
			if err != nil {
				return
			}
		}
	})
	session := openSession(t, node)
	stream, _ := session.OpenStream()
	stream.Write([]byte("go"))

	if stalled := settledAt(t, &produced); stalled > 3*windowBytes+2*mux.MaxDataBytes {
		t.Fatalf("node produced %d bytes for a browser that never reads", stalled)
	}
}

func TestResetsNodesStreamWhenTheBrowserAbortsIt(t *testing.T) {
	arrived, aborted := make(chan struct{}), make(chan error, 1)
	node := startFakeNode(t, func(stream *mux.Stream) {
		stream.Read(make([]byte, 1))
		close(arrived)
		_, err := io.Copy(io.Discard, stream)
		aborted <- err
	})
	session := openSession(t, node)
	stream, _ := session.OpenStream()
	stream.Write([]byte("partial"))
	<-arrived

	stream.CancelWrite(1)

	select {
	case err := <-aborted:
		if !errors.Is(err, mux.ErrReset) {
			t.Fatalf("node's stream ended with %v, want a reset", err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("node's stream was never reset")
	}
}

func TestEndsTheBrowserSessionWhenNodeGoesAway(t *testing.T) {
	node := startFakeNode(t, echo)
	session := openSession(t, node)

	(<-node.sessions).Close(mux.CloseNormal, "node restarts")

	select {
	case <-session.Context().Done():
	case <-time.After(3 * time.Second):
		t.Fatal("browser session outlived its upstream")
	}
}

func TestResetsTheBrowserStreamWhenNodeResetsItWhileTheBrowserIsNotReading(t *testing.T) {
	reset := make(chan struct{})
	node := startFakeNode(t, func(stream *mux.Stream) {
		stream.Read(make([]byte, 1))
		chunk := make([]byte, chunkBytes)
		go func() {
			for {
				if _, err := stream.Write(chunk); err != nil {
					return
				}
			}
		}()
		time.Sleep(stallWait)
		stream.Reset()
		close(reset)
	})
	session := openSession(t, node)
	stream, _ := session.OpenStream()
	stream.Write([]byte("go"))
	stream.Close()
	<-reset
	time.Sleep(stallWait)

	// What piled up while nobody read is void once Node reset the stream: the
	// very next read must fail rather than hand out the stale response.
	if n, err := stream.Read(make([]byte, chunkBytes)); err == nil {
		t.Fatalf("read %d stale bytes from a stream Node had reset", n)
	}
}

func TestRefusesAPlainHTTP3RequestWithoutSpendingAnUpstreamSession(t *testing.T) {
	node := startFakeNode(t, echo)
	url, pool := startGateway(t, node)
	client := &http.Client{Transport: &http3.Transport{TLSClientConfig: &tls.Config{RootCAs: pool}}}

	response, err := client.Get(url)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	response.Body.Close()

	if response.StatusCode != http.StatusBadRequest {
		t.Fatalf("plain request answered %d, want %d", response.StatusCode, http.StatusBadRequest)
	}
	if node.address.Load() != nil {
		t.Fatal("a plain request opened a session on Node")
	}
}

func TestFreesNodesSessionWhenTheBrowserVanishesWithoutClosing(t *testing.T) {
	node := startFakeNode(t, echo)
	url, pool := startGateway(t, node)
	socket, err := net.ListenPacket("udp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	client := webTransportClient(t, pool)
	client.DialAddr = func(ctx context.Context, addr string, tlsConfig *tls.Config, config *quic.Config) (*quic.Conn, error) {
		remote, err := net.ResolveUDPAddr("udp", addr)
		if err != nil {
			return nil, err
		}
		return (&quic.Transport{Conn: socket}).DialEarly(ctx, remote, tlsConfig, config)
	}
	if _, _, err := dial(t, url, client); err != nil {
		t.Fatalf("dial: %v", err)
	}
	if node.live.Load() != 1 {
		t.Fatalf("node holds %d sessions, want 1", node.live.Load())
	}

	// A browser process killed outright: no CONNECTION_CLOSE, just silence.
	socket.Close()

	deadline := time.Now().Add(3 * testIdleTimeout)
	for node.live.Load() != 0 {
		if time.Now().After(deadline) {
			t.Fatalf("node still holds %d sessions after the browser vanished", node.live.Load())
		}
		time.Sleep(50 * time.Millisecond)
	}
}

func TestKeepsServingAfterManyCallsWereAbortedMidway(t *testing.T) {
	node := startFakeNode(t, func(stream *mux.Stream) {
		chunk := make([]byte, chunkBytes)
		for range 4 {
			if _, err := stream.Write(chunk); err != nil {
				return
			}
		}
		io.Copy(io.Discard, stream)
		stream.CloseWrite()
	})
	session := openSession(t, node)

	// What a chart does while zooming: each superseded request is aborted both ways.
	for range 40 {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		stream, err := session.OpenStreamSync(ctx)
		cancel()
		if err != nil {
			t.Fatalf("no stream left after aborted calls: %v", err)
		}
		stream.Write([]byte("request"))
		stream.Read(make([]byte, 100))
		stream.CancelRead(1)
		stream.CancelWrite(1)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	stream, err := session.OpenStreamSync(ctx)
	if err != nil {
		t.Fatalf("no stream for a fresh call: %v", err)
	}
	stream.Write([]byte("request"))
	stream.Close()
	if received, err := io.ReadAll(stream); err != nil || len(received) != 4*chunkBytes {
		t.Fatalf("fresh call got %d bytes, %v", len(received), err)
	}
}

func TestNeverOpensMoreUpstreamStreamsThanNodeAllowsWhileCallsAreReplaced(t *testing.T) {
	node := startFakeNode(t, func(stream *mux.Stream) {
		request := make([]byte, 1)
		if _, err := stream.Read(request); err != nil {
			return
		}
		stream.Write(request)
		io.Copy(io.Discard, stream)
	})
	session := openSession(t, node)
	call := func() (*webtransport.Stream, error) {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		stream, err := session.OpenStreamSync(ctx)
		if err != nil {
			return nil, err
		}
		stream.Write([]byte("x"))
		stream.SetReadDeadline(time.Now().Add(2 * time.Second))
		_, err = io.ReadFull(stream, make([]byte, 1))
		return stream, err
	}

	// Every slot Node allows is busy; then, like a chart zooming, each new call
	// replaces the oldest one, which is aborted the moment the new one starts.
	var live []*webtransport.Stream
	for range 8 {
		stream, err := call()
		if err != nil {
			t.Fatalf("filling the slots: %v", err)
		}
		live = append(live, stream)
	}
	for round := range 60 {
		oldest := live[0]
		live = live[1:]
		oldest.CancelRead(1)
		oldest.CancelWrite(1)
		stream, err := call()
		if err != nil {
			t.Fatalf("round %d: the call that replaced an aborted one failed: %v", round, err)
		}
		live = append(live, stream)
	}
}
