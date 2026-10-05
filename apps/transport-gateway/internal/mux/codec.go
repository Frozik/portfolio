// Package mux implements the multiplexer protocol frozik-mux.v1
// (libs/transport/MUX.md): many byte streams over one WebSocket, each with
// per-stream credit so a reader that stops reading stops the writer.
package mux

import (
	"encoding/binary"
	"errors"
	"fmt"
)

// Type is the first byte of every message.
type Type uint8

const (
	TypeOpen   Type = 1
	TypeData   Type = 2
	TypeFin    Type = 3
	TypeReset  Type = 4
	TypeCredit Type = 5
)

const (
	// Subprotocol names the wire format and its version during the WebSocket upgrade.
	Subprotocol = "frozik-mux.v1"
	// HeaderBytes is the type byte plus the big-endian stream id.
	HeaderBytes = 5
	// MaxDataBytes bounds one DATA payload.
	MaxDataBytes = 64 * 1024
	// InitialCredit is what each stream may send each way before any CREDIT; both ends assume it.
	InitialCredit = 256 * 1024

	creditPayloadBytes = 4
)

// ErrProtocol marks a peer that broke the protocol; the session closes with CloseProtocolError.
var ErrProtocol = errors.New("mux protocol violation")

// Message is one decoded mux message. Data is set for DATA, Credit for CREDIT.
type Message struct {
	Type     Type
	StreamID uint32
	Data     []byte
	Credit   uint32
}

// Encode lays a message out as one binary WebSocket message.
func Encode(message Message) []byte {
	payload := 0
	switch message.Type {
	case TypeData:
		payload = len(message.Data)
	case TypeCredit:
		payload = creditPayloadBytes
	}
	encoded := make([]byte, HeaderBytes+payload)
	encoded[0] = byte(message.Type)
	binary.BigEndian.PutUint32(encoded[1:HeaderBytes], message.StreamID)
	switch message.Type {
	case TypeData:
		copy(encoded[HeaderBytes:], message.Data)
	case TypeCredit:
		binary.BigEndian.PutUint32(encoded[HeaderBytes:], message.Credit)
	}
	return encoded
}

// Decode reads one message, refusing anything the protocol does not allow.
// DATA aliases the input; callers that keep it must copy.
func Decode(encoded []byte, maxDataBytes int) (Message, error) {
	if len(encoded) < HeaderBytes {
		return Message{}, fmt.Errorf("%w: message shorter than its header", ErrProtocol)
	}
	message := Message{
		Type:     Type(encoded[0]),
		StreamID: binary.BigEndian.Uint32(encoded[1:HeaderBytes]),
	}
	payload := encoded[HeaderBytes:]
	switch message.Type {
	case TypeData:
		if len(payload) > maxDataBytes {
			return Message{}, fmt.Errorf("%w: DATA of %d bytes exceeds %d", ErrProtocol, len(payload), maxDataBytes)
		}
		message.Data = payload
	case TypeCredit:
		if len(payload) != creditPayloadBytes {
			return Message{}, fmt.Errorf("%w: malformed CREDIT", ErrProtocol)
		}
		message.Credit = binary.BigEndian.Uint32(payload)
	case TypeOpen, TypeFin, TypeReset:
		if len(payload) != 0 {
			return Message{}, fmt.Errorf("%w: message type %d carries no payload", ErrProtocol, message.Type)
		}
	default:
		return Message{}, fmt.Errorf("%w: unknown message type %d", ErrProtocol, message.Type)
	}
	return message, nil
}
