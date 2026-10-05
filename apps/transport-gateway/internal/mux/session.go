package mux

import (
	"context"
	"errors"
	"fmt"
	"sync"
)

// Close codes on the WebSocket.
const (
	CloseNormal        = 1000
	CloseProtocolError = 4002
)

// ErrSessionClosed is returned by streams and calls after the session ended.
var ErrSessionClosed = errors.New("mux session closed")

// Conn carries whole binary messages; a WebSocket in production.
type Conn interface {
	Read(ctx context.Context) ([]byte, error)
	Write(ctx context.Context, message []byte) error
	Close(code int, reason string) error
}

// Role decides which stream ids a side opens: the dialler odd, the listener even.
type Role int

const (
	RoleClient Role = iota
	RoleServer
)

// Session multiplexes streams over one Conn.
type Session struct {
	conn        Conn
	role        Role
	maxIncoming int

	writeMu sync.Mutex

	mu       sync.Mutex
	streams  map[uint32]*Stream
	incoming int
	nextID   uint32
	accepted chan *Stream
	failure  error

	done chan struct{}
}

// NewSession starts reading conn at once. maxIncoming bounds live streams the peer may open.
func NewSession(conn Conn, role Role, maxIncoming int) *Session {
	session := &Session{
		conn:        conn,
		role:        role,
		maxIncoming: maxIncoming,
		streams:     make(map[uint32]*Stream),
		nextID:      1,
		accepted:    make(chan *Stream, max(maxIncoming, 1)),
		done:        make(chan struct{}),
	}
	if role == RoleServer {
		session.nextID = 2
	}
	go session.readLoop()
	return session
}

// Done is closed once the session has ended.
func (s *Session) Done() <-chan struct{} { return s.done }

// Err tells why the session ended.
func (s *Session) Err() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.failure
}

// OpenStream opens a stream; DATA may follow at once.
func (s *Session) OpenStream() (*Stream, error) {
	s.mu.Lock()
	if s.failure != nil {
		s.mu.Unlock()
		return nil, s.failure
	}
	id := s.nextID
	s.nextID += 2
	stream := newStream(id, s)
	s.streams[id] = stream
	s.mu.Unlock()
	if err := s.send(Message{Type: TypeOpen, StreamID: id}); err != nil {
		return nil, err
	}
	return stream, nil
}

// AcceptStream waits for a stream the peer opened.
func (s *Session) AcceptStream(ctx context.Context) (*Stream, error) {
	select {
	case stream := <-s.accepted:
		return stream, nil
	case <-s.done:
		return nil, s.Err()
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

// Close ends the session and fails every stream.
func (s *Session) Close(code int, reason string) {
	s.terminate(fmt.Errorf("%w: %s", ErrSessionClosed, reason), code, reason)
}

func (s *Session) send(message Message) error {
	s.writeMu.Lock()
	defer s.writeMu.Unlock()
	select {
	case <-s.done:
		return s.Err()
	default:
	}
	if err := s.conn.Write(context.Background(), Encode(message)); err != nil {
		s.terminate(fmt.Errorf("%w: %v", ErrSessionClosed, err), CloseNormal, "write failed")
		return err
	}
	return nil
}

func (s *Session) readLoop() {
	for {
		raw, err := s.conn.Read(context.Background())
		if err != nil {
			s.terminate(fmt.Errorf("%w: %v", ErrSessionClosed, err), CloseNormal, "")
			return
		}
		message, err := Decode(raw, MaxDataBytes)
		if err == nil {
			err = s.receive(message)
		}
		if err != nil {
			s.terminate(err, CloseProtocolError, err.Error())
			return
		}
	}
}

func (s *Session) receive(message Message) error {
	if message.Type == TypeOpen {
		return s.receiveOpen(message.StreamID)
	}
	s.mu.Lock()
	stream := s.streams[message.StreamID]
	s.mu.Unlock()
	if stream == nil {
		// A stream just reset or released may still have messages in flight.
		return nil
	}
	switch message.Type {
	case TypeData:
		return stream.receiveData(message.Data)
	case TypeFin:
		if stream.receiveFin() {
			s.release(stream.id)
		}
	case TypeReset:
		stream.fail(ErrReset)
		s.release(stream.id)
	case TypeCredit:
		stream.receiveCredit(message.Credit)
	}
	return nil
}

func (s *Session) receiveOpen(id uint32) error {
	ownParity := s.nextID % 2
	s.mu.Lock()
	if id == 0 || id%2 == ownParity || s.streams[id] != nil {
		s.mu.Unlock()
		return fmt.Errorf("%w: OPEN of stream %d", ErrProtocol, id)
	}
	if s.incoming >= s.maxIncoming {
		s.mu.Unlock()
		s.send(Message{Type: TypeReset, StreamID: id})
		return nil
	}
	stream := newStream(id, s)
	s.streams[id] = stream
	s.incoming++
	s.mu.Unlock()
	s.accepted <- stream
	return nil
}

func (s *Session) release(id uint32) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, live := s.streams[id]; !live {
		return
	}
	delete(s.streams, id)
	if id%2 != s.nextID%2 {
		s.incoming--
	}
}

func (s *Session) terminate(cause error, code int, reason string) {
	s.mu.Lock()
	if s.failure != nil {
		s.mu.Unlock()
		return
	}
	s.failure = cause
	streams := s.streams
	s.streams = make(map[uint32]*Stream)
	close(s.done)
	s.mu.Unlock()
	for _, stream := range streams {
		stream.fail(cause)
	}
	s.conn.Close(code, reason)
}
