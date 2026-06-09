importScripts('https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js');
importScripts('core.js');

self.onmessage = function(e) {
  const { fileBytes, compressOn } = e.data;
  try {
    self.postMessage({ type: 'status', msg: 'compressing…' });
    const bytes   = new Uint8Array(fileBytes);
    const payload = compressOn ? pako.deflate(bytes) : bytes;

    const sz   = `${payload.length} B`;
    const base = bytesToBigInt(payload) << METADATA_BITS;
    let prime, metadata, lastUpdate = 0, tick = 0;

    self.postMessage({ type: 'status', msg: `searching for prime (${sz})…` });

    // base has bit 0 clear (left-shifted 32 bits), so even m → even candidate → not prime.
    // start at 1 and step by 2 to test only odd candidates — halves the search space.
    for (let m = 1n; m < (1n << METADATA_BITS); m += 2n) {
      const c = base | m;
      if (isPrime(c)) { prime = c; metadata = m; break; }
      // check Date.now() only every 1000 iterations to avoid syscall overhead
      if (++tick === 1000) {
        tick = 0;
        const now = Date.now();
        if (now - lastUpdate >= 120) {
          self.postMessage({ type: 'status', msg: `searching for prime (${sz})… ${m} tested` });
          lastUpdate = now;
        }
      }
    }

    self.postMessage({
      type:          'result',
      prime:         prime.toString(),
      metadata:      metadata.toString(),
      payloadLength: payload.length,
    });
  } catch (err) {
    self.postMessage({ type: 'error', msg: err.message });
  }
};
