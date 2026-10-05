package mux

import (
	"bytes"
	"context"
	"errors"
	"io"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

const stallWait = 100 * time.Millisecond

// memoryConn is one end of an in-memory message pipe.
type memoryConn struct {
	in        chan []byte
	out       chan []byte
	closed    chan struct{}
	closeOnce *sync.Once
	closeCode atomic.Int32
}

func memoryPair() (*memoryConn, *memoryConn) {
	ab, ba := make(chan []byte, 1024), make(chan []byte, 1024)
	closed, once := make(chan struct{}), &sync.Once{}
	return &memoryConn{in: ba, out: ab, closed: closed, closeOnce: once},
		&memoryConn{in: ab, out: ba, closed: closed, closeOnce: once}
}

func (c *memoryConn) Read(ctx context.Context) ([]byte, error) {
	select {
	case message := <-c.in:
		return message, nil
	case <-c.closed:
		return nil, io.EOF
	}
}

func (c *memoryConn) Write(_ context.Context, message []byte) error {
	select {
	case c.out <- message:
		return nil
	case <-c.closed:
		return io.ErrClosedPipe
	}
}

func (c *memoryConn) Close(code int, _ string) error {
	c.closeCode.Store(int32(code))
	c.closeOnce.Do(func() { close(c.closed) })
	return nil
}

func sessionPair(t *testing.T, maxIncoming int) (*Session, *Session) {
	t.Helper()
	clientConn, serverConn := memoryPair()
	client := NewSession(clientConn, RoleClient, 0)
	server := NewSession(serverConn, RoleServer, maxIncoming)
	t.Cleanup(func() {
		client.Close(CloseNormal, "test over")
		server.Close(CloseNormal, "test over")
	})
	return client, server
}

func accept(t *testing.T, session *Session) *Stream {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	stream, err := session.AcceptStream(ctx)
	if err != nil {
		t.Fatalf("accept: %v", err)
	}
	return stream
}

func TestDeliversEachStreamIntactAndInOrderWhileSeveralRunAtOnce(t *testing.T) {
	client, server := sessionPair(t, 8)
	payloads := [][]byte{bytes.Repeat([]byte{1}, 300_000), bytes.Repeat([]byte{2}, 70_000), []byte("short")}

	var writers sync.WaitGroup
	for _, payload := range payloads {
		stream, err := client.OpenStream()
		if err != nil {
			t.Fatal(err)
		}
		writers.Go(func() {
			stream.Write(payload)
			stream.CloseWrite()
		})
	}
	for range payloads {
		stream := accept(t, server)
		received, err := io.ReadAll(stream)
		if err != nil {
			t.Fatalf("read: %v", err)
		}
		if !bytes.Equal(received, payloads[(stream.ID()-1)/2]) {
			t.Fatalf("stream %d delivered %d bytes, want %d", stream.ID(), len(received), len(payloads[(stream.ID()-1)/2]))
		}
	}
	writers.Wait()
}

func TestStopsTheSenderOnceTheCreditIsSpentAndResumesWhenTheReceiverReads(t *testing.T) {
	client, server := sessionPair(t, 8)
	stream, _ := client.OpenStream()
	var written atomic.Int64
	go func() {
		chunk := make([]byte, 16*1024)
		for {
			n, err := stream.Write(chunk)
			written.Add(int64(n))
			if err != nil {
				return
			}
		}
	}()
	time.Sleep(stallWait)
	stalledAt := written.Load()
	time.Sleep(stallWait)

	if written.Load() != stalledAt || stalledAt > InitialCredit {
		t.Fatalf("sender ran on: %d then %d bytes, credit %d", stalledAt, written.Load(), InitialCredit)
	}

	peer := accept(t, server)
	io.ReadFull(peer, make([]byte, InitialCredit))
	time.Sleep(stallWait)
	if written.Load() <= stalledAt {
		t.Fatal("sender did not resume after the receiver read")
	}
}

func TestDropsTheSessionWhenThePeerSendsPastItsCredit(t *testing.T) {
	rawConn, serverConn := memoryPair()
	server := NewSession(serverConn, RoleServer, 8)
	defer server.Close(CloseNormal, "")

	rawConn.Write(context.Background(), Encode(Message{Type: TypeOpen, StreamID: 1}))
	for sent := 0; sent <= InitialCredit; sent += MaxDataBytes {
		rawConn.Write(context.Background(), Encode(Message{Type: TypeData, StreamID: 1, Data: make([]byte, MaxDataBytes)}))
	}

	select {
	case <-server.Done():
	case <-time.After(time.Second):
		t.Fatal("session survived a credit overrun")
	}
	if !errors.Is(server.Err(), ErrProtocol) || serverConn.closeCode.Load() != CloseProtocolError {
		t.Fatalf("got %v / close %d, want a protocol violation closed with %d", server.Err(), serverConn.closeCode.Load(), CloseProtocolError)
	}
}

func TestResetsStreamsBeyondTheLimitWithoutDroppingTheSession(t *testing.T) {
	client, server := sessionPair(t, 1)
	first, _ := client.OpenStream()
	second, _ := client.OpenStream()
	accept(t, server)

	if _, err := second.Read(make([]byte, 1)); !errors.Is(err, ErrReset) {
		t.Fatalf("stream past the limit: got %v, want a reset", err)
	}
	if _, err := first.Write([]byte("still open")); err != nil {
		t.Fatalf("the open stream suffered: %v", err)
	}
}

func TestEndsTheReaderAtFinAndFailsBothSidesOnReset(t *testing.T) {
	client, server := sessionPair(t, 8)
	finished, _ := client.OpenStream()
	finished.Write([]byte("done"))
	finished.CloseWrite()
	if received, err := io.ReadAll(accept(t, server)); err != nil || string(received) != "done" {
		t.Fatalf("got %q, %v", received, err)
	}

	aborted, _ := client.OpenStream()
	peer := accept(t, server)
	aborted.Reset()
	if _, err := peer.Read(make([]byte, 1)); !errors.Is(err, ErrReset) {
		t.Fatalf("peer read after reset: %v", err)
	}
	if _, err := aborted.Write([]byte("x")); !errors.Is(err, ErrReset) {
		t.Fatalf("own write after reset: %v", err)
	}
}

func TestFailsEveryOpenStreamWhenTheConnectionCloses(t *testing.T) {
	client, server := sessionPair(t, 8)
	stream, _ := client.OpenStream()
	accept(t, server)

	server.Close(CloseNormal, "bye")

	if _, err := stream.Read(make([]byte, 1)); !errors.Is(err, ErrSessionClosed) {
		t.Fatalf("got %v, want the session's end", err)
	}
}
