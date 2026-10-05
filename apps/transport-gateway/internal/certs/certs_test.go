package certs

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func writePair(t *testing.T, dir, commonName string) {
	t.Helper()
	key, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	template := &x509.Certificate{
		SerialNumber: big.NewInt(time.Now().UnixNano()),
		Subject:      pkix.Name{CommonName: commonName},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(time.Hour),
	}
	der, _ := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	keyDER, _ := x509.MarshalECPrivateKey(key)
	os.WriteFile(filepath.Join(dir, "key.pem"), pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER}), 0o600)
	os.WriteFile(filepath.Join(dir, "cert.pem"), pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}), 0o600)
}

func servedName(t *testing.T, source *Source) string {
	t.Helper()
	certificate, _ := source.GetCertificate(nil)
	leaf, err := x509.ParseCertificate(certificate.Certificate[0])
	if err != nil {
		t.Fatal(err)
	}
	return leaf.Subject.CommonName
}

func TestServesARenewedPairWithoutARestart(t *testing.T) {
	dir := t.TempDir()
	writePair(t, dir, "first")
	source, err := Load(filepath.Join(dir, "cert.pem"), filepath.Join(dir, "key.pem"))
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	reloaded := make(chan error, 4)
	go source.Watch(ctx, 20*time.Millisecond, func(err error) { reloaded <- err })

	time.Sleep(50 * time.Millisecond)
	writePair(t, dir, "renewed")

	select {
	case err := <-reloaded:
		if err != nil {
			t.Fatalf("reload: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("the renewed pair was never picked up")
	}
	if name := servedName(t, source); name != "renewed" {
		t.Fatalf("serving %q, want the renewed certificate", name)
	}
}

func TestKeepsServingTheOldPairWhileTheNewOneIsHalfWritten(t *testing.T) {
	dir := t.TempDir()
	writePair(t, dir, "first")
	source, _ := Load(filepath.Join(dir, "cert.pem"), filepath.Join(dir, "key.pem"))
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	reloaded := make(chan error, 4)
	go source.Watch(ctx, 20*time.Millisecond, func(err error) { reloaded <- err })

	time.Sleep(50 * time.Millisecond)
	os.WriteFile(filepath.Join(dir, "cert.pem"), []byte("-----BEGIN CERTIFICATE-----\ntruncated"), 0o600)

	if err := <-reloaded; err == nil {
		t.Fatal("a broken pair loaded")
	}
	if name := servedName(t, source); name != "first" {
		t.Fatalf("serving %q, want the old certificate kept", name)
	}
}
