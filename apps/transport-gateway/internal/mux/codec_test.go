package mux

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"os"
	"testing"
)

// The same vectors run in libs/transport/src/mux/mux-message.test.ts.
const vectorsPath = "../../../../libs/transport/src/mux/mux-vectors.json"

type vectorMessage struct {
	Type     string `json:"type"`
	StreamID uint32 `json:"streamId"`
	Hex      string `json:"hex"`
	Bytes    uint32 `json:"bytes"`
}

type vectors struct {
	MaxDataBytes int `json:"maxDataBytes"`
	Valid        []struct {
		Name    string        `json:"name"`
		Hex     string        `json:"hex"`
		Message vectorMessage `json:"message"`
	} `json:"valid"`
	Invalid []struct {
		Name         string `json:"name"`
		Hex          string `json:"hex"`
		PayloadBytes int    `json:"payloadBytes"`
	} `json:"invalid"`
}

func loadVectors(t *testing.T) vectors {
	t.Helper()
	raw, err := os.ReadFile(vectorsPath)
	if err != nil {
		t.Fatalf("read vectors: %v", err)
	}
	var loaded vectors
	if err := json.Unmarshal(raw, &loaded); err != nil {
		t.Fatalf("parse vectors: %v", err)
	}
	return loaded
}

func mustHex(t *testing.T, text string) []byte {
	t.Helper()
	decoded, err := hex.DecodeString(text)
	if err != nil {
		t.Fatalf("bad hex %q: %v", text, err)
	}
	return decoded
}

func messageOf(t *testing.T, vector vectorMessage) Message {
	t.Helper()
	types := map[string]Type{"open": TypeOpen, "data": TypeData, "fin": TypeFin, "reset": TypeReset, "credit": TypeCredit}
	kind, known := types[vector.Type]
	if !known {
		t.Fatalf("unknown vector type %q", vector.Type)
	}
	message := Message{Type: kind, StreamID: vector.StreamID}
	switch kind {
	case TypeData:
		message.Data = mustHex(t, vector.Hex)
	case TypeCredit:
		message.Credit = vector.Bytes
	}
	return message
}

func TestEncodesAndDecodesEveryValidVector(t *testing.T) {
	loaded := loadVectors(t)
	for _, vector := range loaded.Valid {
		t.Run(vector.Name, func(t *testing.T) {
			expected := messageOf(t, vector.Message)
			wire := mustHex(t, vector.Hex)

			if encoded := Encode(expected); !bytes.Equal(encoded, wire) {
				t.Fatalf("encode: got %x, want %x", encoded, wire)
			}
			decoded, err := Decode(wire, loaded.MaxDataBytes)
			if err != nil {
				t.Fatalf("decode: %v", err)
			}
			if decoded.Type != expected.Type || decoded.StreamID != expected.StreamID ||
				decoded.Credit != expected.Credit || !bytes.Equal(decoded.Data, expected.Data) {
				t.Fatalf("decode: got %+v, want %+v", decoded, expected)
			}
		})
	}
}

func TestRejectsEveryInvalidVector(t *testing.T) {
	loaded := loadVectors(t)
	for _, vector := range loaded.Invalid {
		t.Run(vector.Name, func(t *testing.T) {
			encoded := append(mustHex(t, vector.Hex), make([]byte, vector.PayloadBytes)...)

			if _, err := Decode(encoded, loaded.MaxDataBytes); err == nil {
				t.Fatal("decoded a message the protocol forbids")
			}
		})
	}
}
