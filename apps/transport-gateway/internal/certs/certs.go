// Package certs serves the TLS certificate from files and picks up new ones
// (Let's Encrypt renewals in production, the certificate Node rewrites in
// development) without a restart: each handshake reads the current pair.
package certs

import (
	"context"
	"crypto/tls"
	"os"
	"strconv"
	"sync/atomic"
	"time"
)

// Source holds the certificate the next handshake gets.
type Source struct {
	certFile string
	keyFile  string
	current  atomic.Pointer[tls.Certificate]
	stamp    string
}

// Load reads the pair once; it fails when the files are missing or do not match.
func Load(certFile, keyFile string) (*Source, error) {
	source := &Source{certFile: certFile, keyFile: keyFile}
	if err := source.reload(); err != nil {
		return nil, err
	}
	return source, nil
}

// GetCertificate is the tls.Config hook.
func (s *Source) GetCertificate(*tls.ClientHelloInfo) (*tls.Certificate, error) {
	return s.current.Load(), nil
}

// Watch re-reads the pair whenever either file changes, until ctx ends. A
// half-written pair fails to load and is retried on the next tick; the old
// certificate keeps serving meanwhile.
func (s *Source) Watch(ctx context.Context, interval time.Duration, onReload func(error)) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if stamp, err := s.fileStamp(); err == nil && stamp == s.stamp {
				continue
			}
			onReload(s.reload())
		}
	}
}

func (s *Source) reload() error {
	stamp, err := s.fileStamp()
	if err != nil {
		return err
	}
	pair, err := tls.LoadX509KeyPair(s.certFile, s.keyFile)
	if err != nil {
		return err
	}
	s.current.Store(&pair)
	s.stamp = stamp
	return nil
}

func (s *Source) fileStamp() (string, error) {
	stamp := ""
	for _, path := range []string{s.certFile, s.keyFile} {
		info, err := os.Stat(path)
		if err != nil {
			return "", err
		}
		stamp += info.ModTime().String() + "/" + strconv.FormatInt(info.Size(), 10) + ";"
	}
	return stamp, nil
}
