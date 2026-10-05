// Package bridge joins one browser WebTransport session to one upstream mux
// session, stream by stream, without reading the bytes.
//
// Backpressure holds end to end because nothing here queues: a byte is read
// from one side only when the other side has taken the previous ones — the
// mux's credit stops reads from QUIC, and QUIC's flow control stops reads
// from the mux. Per stream the gateway holds at most one copy buffer each way
// plus the mux window it granted.
package bridge

import (
	"errors"
	"io"
	"log/slog"
	"sync/atomic"

	"github.com/quic-go/webtransport-go"

	"github.com/frozik/portfolio/apps/transport-gateway/internal/mux"
)

const (
	streamAborted webtransport.StreamErrorCode  = 0
	upstreamGone  webtransport.SessionErrorCode = 0
)

// Counters observes the traffic.
type Counters interface {
	StreamOpened()
	BytesUp(bytes int64)
	BytesDown(bytes int64)
}

// Run serves the session until either side ends; then it ends the other.
//
// At most maxStreams streams are open upstream at once, and a slot is given
// back only after both directions of a stream ended. The browser aborts a call
// and opens the next on two QUIC streams that arrive in any order; without the
// slots the new OPEN could overtake the old RESET and Node — which allows
// maxStreams per session — would refuse it.
func Run(browser *webtransport.Session, upstream *mux.Session, maxStreams int, counters Counters, logger *slog.Logger) {
	ctx := browser.Context()
	slots := make(chan struct{}, maxStreams)
	go func() {
		select {
		case <-upstream.Done():
			browser.CloseWithError(upstreamGone, "upstream closed")
		case <-ctx.Done():
			upstream.Close(mux.CloseNormal, "browser session ended")
		}
	}()
	for {
		browserStream, err := browser.AcceptStream(ctx)
		if err != nil {
			upstream.Close(mux.CloseNormal, "browser session ended")
			return
		}
		select {
		case slots <- struct{}{}:
		case <-ctx.Done():
			upstream.Close(mux.CloseNormal, "browser session ended")
			return
		}
		upstreamStream, err := upstream.OpenStream()
		if err != nil {
			<-slots
			browserStream.CancelRead(streamAborted)
			browserStream.CancelWrite(streamAborted)
			continue
		}
		counters.StreamOpened()
		go func() {
			pipe(browserStream, upstreamStream, counters, logger)
			<-slots
		}()
	}
}

// pipe copies both directions and returns once both ended; FIN maps to FIN,
// any failure resets both sides.
func pipe(browser *webtransport.Stream, upstream *mux.Stream, counters Counters, logger *slog.Logger) {
	var upErr, downErr error
	var resetByNode atomic.Bool
	defer func() {
		logger.Debug("stream ended", "stream", upstream.ID(), "up", upErr, "down", downErr, "nodeFailed", resetByNode.Load())
	}()
	// A reset from Node must reach the browser even while the down copy is
	// stuck writing to a browser that stopped reading.
	finished := make(chan struct{})
	defer close(finished)
	go func() {
		select {
		case <-upstream.Failed():
			resetByNode.Store(true)
			browser.CancelWrite(streamAborted)
			browser.CancelRead(streamAborted)
		case <-finished:
		}
	}()
	upDone := make(chan struct{})
	defer func() { <-upDone }()
	go func() {
		defer close(upDone)
		sent, err := io.Copy(upstream, browser)
		counters.BytesUp(sent)
		upErr = err
		if err != nil {
			upstream.Reset()
			browser.CancelWrite(streamAborted)
			return
		}
		upstream.CloseWrite()
	}()
	received, err := io.Copy(browser, upstream)
	counters.BytesDown(received)
	downErr = err
	if err != nil {
		browser.CancelWrite(streamAborted)
		browser.CancelRead(streamAborted)
		if !errors.Is(err, mux.ErrReset) {
			upstream.Reset()
		}
		return
	}
	browser.Close()
}
