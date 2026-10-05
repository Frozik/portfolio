// Package upstream dials the Node transport server's gateway listener: one
// multiplexed WebSocket per browser session, carrying the browser's address
// and Origin, proven by the shared secret.
package upstream

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/coder/websocket"

	"github.com/frozik/portfolio/apps/transport-gateway/internal/mux"
)

// ClientAddressHeader names the browser's address; Node reads it only on the gateway listener.
const ClientAddressHeader = "X-Transport-Client-Address"

// RefusedError is Node's answer when it would not admit the session (origin, per-address limits).
type RefusedError struct{ Status int }

func (e *RefusedError) Error() string {
	return fmt.Sprintf("upstream refused the session: %d", e.Status)
}

// Dialer opens upstream sessions.
type Dialer struct {
	URL    string
	Secret string
}

// Dial opens one session for one browser; the caller closes it.
func (d Dialer) Dial(ctx context.Context, clientAddress, origin string) (*mux.Session, error) {
	header := http.Header{}
	header.Set("Authorization", "Bearer "+d.Secret)
	header.Set(ClientAddressHeader, clientAddress)
	if origin != "" {
		header.Set("Origin", origin)
	}
	conn, response, err := websocket.Dial(ctx, d.URL, &websocket.DialOptions{
		HTTPHeader:   header,
		Subprotocols: []string{mux.Subprotocol},
	})
	if err != nil {
		if response != nil && response.StatusCode != http.StatusSwitchingProtocols {
			return nil, &RefusedError{Status: response.StatusCode}
		}
		return nil, err
	}
	if conn.Subprotocol() != mux.Subprotocol {
		conn.Close(websocket.StatusPolicyViolation, "unexpected subprotocol")
		return nil, errors.New("upstream does not speak " + mux.Subprotocol)
	}
	conn.SetReadLimit(mux.HeaderBytes + mux.MaxDataBytes)
	return mux.NewSession(messageConn{conn}, mux.RoleClient, 0), nil
}

// messageConn adapts a WebSocket to the mux's whole-message Conn.
type messageConn struct{ conn *websocket.Conn }

func (c messageConn) Read(ctx context.Context) ([]byte, error) {
	kind, message, err := c.conn.Read(ctx)
	if err != nil {
		return nil, err
	}
	if kind != websocket.MessageBinary {
		return nil, fmt.Errorf("%w: text message", mux.ErrProtocol)
	}
	return message, nil
}

func (c messageConn) Write(ctx context.Context, message []byte) error {
	return c.conn.Write(ctx, websocket.MessageBinary, message)
}

func (c messageConn) Close(code int, reason string) error {
	return c.conn.Close(websocket.StatusCode(code), reason)
}
