package mux

import (
	"errors"
	"fmt"
	"io"
	"sync"
)

var (
	// ErrReset is returned once either side has reset the stream.
	ErrReset = errors.New("mux stream reset")
	// ErrWriteClosed is returned by Write after CloseWrite.
	ErrWriteClosed = errors.New("mux stream closed for writing")
)

// grantThreshold batches CREDIT: the receiver grants once half a window has been read.
const grantThreshold = InitialCredit / 2

// Stream is one byte stream of a session: Read and Write follow io semantics,
// CloseWrite sends FIN, Reset aborts both directions.
type Stream struct {
	id      uint32
	session *Session

	mu   sync.Mutex
	cond *sync.Cond

	inbox              [][]byte
	received           int64
	granted            int64
	consumedSinceGrant int64
	remoteFin          bool

	sendCredit int64
	localFin   bool

	failure error
	failed  chan struct{}
}

func newStream(id uint32, session *Session) *Stream {
	stream := &Stream{
		id:         id,
		session:    session,
		granted:    InitialCredit,
		sendCredit: InitialCredit,
		failed:     make(chan struct{}),
	}
	stream.cond = sync.NewCond(&stream.mu)
	return stream
}

// ID is the stream id on the wire.
func (s *Stream) ID() uint32 { return s.id }

// Failed is closed once the stream is reset or its session ended, so a party
// blocked elsewhere can react without a pending Read or Write.
func (s *Stream) Failed() <-chan struct{} { return s.failed }

// Read returns bytes in order; io.EOF after the peer's FIN; credit is granted
// only for what has been read here.
func (s *Stream) Read(buffer []byte) (int, error) {
	s.mu.Lock()
	for len(s.inbox) == 0 && !s.remoteFin && s.failure == nil {
		s.cond.Wait()
	}
	if s.failure != nil {
		s.mu.Unlock()
		return 0, s.failure
	}
	if len(s.inbox) == 0 {
		s.mu.Unlock()
		return 0, io.EOF
	}
	read := 0
	for len(s.inbox) > 0 && read < len(buffer) {
		copied := copy(buffer[read:], s.inbox[0])
		read += copied
		if copied == len(s.inbox[0]) {
			s.inbox = s.inbox[1:]
		} else {
			s.inbox[0] = s.inbox[0][copied:]
		}
	}
	s.consumedSinceGrant += int64(read)
	grant := int64(0)
	if s.consumedSinceGrant >= grantThreshold && !s.remoteFin {
		grant = s.consumedSinceGrant
		s.consumedSinceGrant = 0
		s.granted += grant
	}
	s.mu.Unlock()
	if grant > 0 {
		s.session.send(Message{Type: TypeCredit, StreamID: s.id, Credit: uint32(grant)})
	}
	return read, nil
}

// Write sends everything, blocking while the peer has granted no credit.
func (s *Stream) Write(data []byte) (int, error) {
	written := 0
	for len(data) > 0 {
		s.mu.Lock()
		for s.sendCredit == 0 && s.failure == nil && !s.localFin {
			s.cond.Wait()
		}
		if s.failure != nil {
			s.mu.Unlock()
			return written, s.failure
		}
		if s.localFin {
			s.mu.Unlock()
			return written, ErrWriteClosed
		}
		chunk := min(int64(len(data)), s.sendCredit, MaxDataBytes)
		s.sendCredit -= chunk
		s.mu.Unlock()
		if err := s.session.send(Message{Type: TypeData, StreamID: s.id, Data: data[:chunk]}); err != nil {
			return written, err
		}
		data = data[chunk:]
		written += int(chunk)
	}
	return written, nil
}

// CloseWrite ends this side's direction (FIN); reading goes on.
func (s *Stream) CloseWrite() error {
	s.mu.Lock()
	if s.failure != nil || s.localFin {
		s.mu.Unlock()
		return s.failure
	}
	s.localFin = true
	release := s.remoteFin
	s.cond.Broadcast()
	s.mu.Unlock()
	err := s.session.send(Message{Type: TypeFin, StreamID: s.id})
	if release {
		s.session.release(s.id)
	}
	return err
}

// Reset aborts both directions and tells the peer.
func (s *Stream) Reset() {
	if s.fail(ErrReset) {
		s.session.send(Message{Type: TypeReset, StreamID: s.id})
	}
	s.session.release(s.id)
}

func (s *Stream) receiveData(data []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.failure != nil {
		return nil
	}
	if s.remoteFin {
		return fmt.Errorf("%w: DATA after FIN on stream %d", ErrProtocol, s.id)
	}
	s.received += int64(len(data))
	if s.received > s.granted {
		return fmt.Errorf("%w: stream %d sent %d bytes past its credit", ErrProtocol, s.id, s.received-s.granted)
	}
	if len(data) > 0 {
		s.inbox = append(s.inbox, append([]byte(nil), data...))
	}
	s.cond.Broadcast()
	return nil
}

// receiveFin reports whether both directions have now ended.
func (s *Stream) receiveFin() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.remoteFin = true
	s.cond.Broadcast()
	return s.localFin
}

func (s *Stream) receiveCredit(bytes uint32) {
	s.mu.Lock()
	s.sendCredit += int64(bytes)
	s.cond.Broadcast()
	s.mu.Unlock()
}

// fail reports whether this call was the one that failed the stream.
func (s *Stream) fail(err error) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.failure != nil {
		return false
	}
	s.failure = err
	s.inbox = nil
	close(s.failed)
	s.cond.Broadcast()
	return true
}
