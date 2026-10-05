package server

import "sync"

// liveSessions counts bridged sessions and refuses new ones once draining began.
type liveSessions struct {
	mu       sync.Mutex
	count    int
	draining bool
	idle     chan struct{}
}

func newLiveSessions() *liveSessions {
	return &liveSessions{idle: make(chan struct{})}
}

// enter reports whether a new session may start.
func (l *liveSessions) enter() bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.draining {
		return false
	}
	l.count++
	return true
}

func (l *liveSessions) leave() {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.count--
	if l.draining && l.count == 0 {
		close(l.idle)
	}
}

// drain stops admissions; the channel closes once no session is left.
func (l *liveSessions) drain() <-chan struct{} {
	l.mu.Lock()
	defer l.mu.Unlock()
	if !l.draining {
		l.draining = true
		if l.count == 0 {
			close(l.idle)
		}
	}
	return l.idle
}
