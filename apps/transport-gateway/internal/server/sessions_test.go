package server

import (
	"testing"
	"time"
)

func TestDrainWaitsForLiveSessionsAndRefusesNewOnes(t *testing.T) {
	sessions := newLiveSessions()
	if !sessions.enter() {
		t.Fatal("refused a session before draining")
	}

	idle := sessions.drain()

	if sessions.enter() {
		t.Fatal("admitted a session while draining")
	}
	select {
	case <-idle:
		t.Fatal("drained with a session still live")
	case <-time.After(50 * time.Millisecond):
	}
	sessions.leave()
	select {
	case <-idle:
	case <-time.After(time.Second):
		t.Fatal("never drained after the last session left")
	}
}

func TestDrainsAtOnceWhenNothingIsLive(t *testing.T) {
	select {
	case <-newLiveSessions().drain():
	case <-time.After(time.Second):
		t.Fatal("an idle server did not drain")
	}
}
